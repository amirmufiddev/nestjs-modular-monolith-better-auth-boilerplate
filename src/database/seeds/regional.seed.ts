/**
 * Regional master-data seeder.
 *
 * Downloads full Indonesian regional dataset from cahyadsn/wilayah repository,
 * parses tuple lines into a temporary raw table — preserving the dot-separated
 * code form (`11.01.01.2001`) — then projects into the typed
 * `regional_addresses` table. The projection strips the dot separators on its
 * way in so the canonical column is a plain `bigint` for joins/queries.
 *
 * As a third step, downloads the postal-code companion dataset
 * (`cahyadsn/wilayah_kodepos`) and joins it back to the master table to fill
 * `regional_addresses.postal_code` for village-level rows only.
 *
 * Run with: `bun run db:seed:regional`
 *
 * Strategy: three-step (raw staging table → typed table → postal codes).
 * Idempotent: uses `ON CONFLICT (code) DO UPDATE` for the projection and
 * `UPDATE ... FROM` for postal codes, so each run resets `name`, `level`,
 * `parent_code`, and `postal_code` to the values from the source.
 * All operations run on a single dedicated client (`pool.connect()`) inside a
 * single transaction so the staging tables are visible across the loader and
 * the project step, and are automatically dropped at COMMIT/ROLLBACK.
 */
import { Pool, type PoolClient } from 'pg';
import { env } from '@/config/env.validation';

export type Level = 'province' | 'regency' | 'district' | 'village';

export const WILAYAH_SQL_URL =
  'https://raw.githubusercontent.com/cahyadsn/wilayah/refs/heads/master/db/wilayah.sql';

export const WILAYAH_KODEPOS_SQL_URL =
  'https://raw.githubusercontent.com/cahyadsn/wilayah_kodepos/master/db/wilayah_kodepos.sql';

const TMP_TABLE = 'regional_addresses_tmp';
const POSTAL_TMP_TABLE = 'regional_postal_codes_tmp';

function parseSqlStringLiteral(
  input: string,
  startIndex: number,
): { value: string; nextIndex: number } | null {
  if (input[startIndex] !== "'") return null;

  let value = '';
  let i = startIndex + 1;

  while (i < input.length) {
    const char = input[i];
    if (char === "'") {
      if (input[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      return { value, nextIndex: i + 1 };
    }
    value += char;
    i += 1;
  }

  return null;
}

export function parseWilayahTuple(
  tupleStr: string,
): { code: string; name: string } | null {
  const trimmed = tupleStr.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return null;

  const inner = trimmed.slice(1, -1);
  const codeParsed = parseSqlStringLiteral(inner, 0);
  if (!codeParsed) return null;

  let i = codeParsed.nextIndex;
  while (i < inner.length && (inner[i] === ',' || inner[i] === ' ')) {
    i += 1;
  }

  const nameParsed = parseSqlStringLiteral(inner, i);
  if (!nameParsed) return null;

  const rawCode = codeParsed.value;
  // The upstream dataset uses dot separators (`11.01.01.2001`) which we keep
  // verbatim in the staging table so the raw dump is preserved for inspection.
  // The dot is stripped during the projection step that inserts into
  // `regional_addresses.code` (a `bigint`).
  if (!/^[\d.]+$/.test(rawCode)) return null;

  return {
    code: rawCode,
    name: nameParsed.value,
  };
}

export function parseWilayahSqlContent(
  sqlContent: string,
): Array<{ code: string; name: string }> {
  const lines = sqlContent.split('\n');
  const items: Array<{ code: string; name: string }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('(')) continue;

    const cleanTuple = line.replace(/[,;]$/, '').trim();
    const parsed = parseWilayahTuple(cleanTuple);
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
}

async function insertBatch(
  client: PoolClient,
  values: Array<{ code: string; name: string }>,
): Promise<void> {
  if (values.length === 0) return;

  const placeholders = values
    .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
    .join(',');
  const params: Array<string | number> = [];
  for (const v of values) {
    params.push(v.code, v.name);
  }

  await client.query(
    `INSERT INTO ${TMP_TABLE} (kode, nama) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    params,
  );
}

async function insertPostalBatch(
  client: PoolClient,
  values: Array<{ code: string; name: string }>,
): Promise<void> {
  if (values.length === 0) return;

  const placeholders = values
    .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
    .join(',');
  const params: Array<string> = [];
  for (const v of values) {
    // `name` here carries the kodepos string from the parsed tuple.
    params.push(v.code, v.name);
  }

  await client.query(
    `INSERT INTO ${POSTAL_TMP_TABLE} (kode, kodepos) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    params,
  );
}

/**
 * Loads the postal-code companion dataset and joins it to the master table.
 *
 * The upstream `wilayah_kodepos.sql` exposes `(kode, kodepos)` rows where the
 * `kode` uses the same dot-separated form as the master dataset. After the
 * rows are staged in `regional_postal_codes_tmp`, we run an `UPDATE ... FROM`
 * that joins on the dot-stripped numeric code (the canonical `bigint` form
 * stored in `regional_addresses.code`). The `WHERE r.level = 'village'`
 * guard means only village rows get a postal code — the upstream dataset
 * only carries postal codes at that level, so no fallback propagation is
 * needed for parent rows.
 *
 * The update is idempotent: re-running simply reapplies the same values.
 */
async function applyPostalCodes(client: PoolClient): Promise<number> {
  console.log(
    `[3/3] Importing postal codes from ${WILAYAH_KODEPOS_SQL_URL}...`,
  );

  const response = await fetch(WILAYAH_KODEPOS_SQL_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch wilayah_kodepos.sql: ${response.status} ${response.statusText}`,
    );
  }

  const sqlContent = await response.text();
  const items = parseWilayahSqlContent(sqlContent);
  console.log(`Parsed ${items.length} (kode, kodepos) tuples.`);

  await client.query(`DROP TABLE IF EXISTS ${POSTAL_TMP_TABLE}`);
  await client.query(
    `CREATE TABLE ${POSTAL_TMP_TABLE} (kode TEXT PRIMARY KEY, kodepos TEXT)`,
  );

  const BATCH_SIZE = 1000;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await insertPostalBatch(client, batch);
    if ((i + batch.length) % 10000 === 0 || i + batch.length === items.length) {
      console.log(
        `  Loaded ${i + batch.length} / ${items.length} postal rows...`,
      );
    }
  }

  const loadedCount = await client.query(
    `SELECT COUNT(*)::int AS c FROM ${POSTAL_TMP_TABLE}`,
  );
  console.log(`Postal staging table loaded: ${loadedCount.rows[0].c} rows.`);

  const result = await client.query(
    `UPDATE regional_addresses r
        SET postal_code = p.kodepos
       FROM ${POSTAL_TMP_TABLE} p
      WHERE r.code = (regexp_replace(p.kode, '[^0-9]', '', 'g'))::bigint
        AND r.level = 'village'`,
  );
  console.log(
    `Updated ${result.rowCount} regional_addresses.postal_code rows.`,
  );
  return result.rowCount ?? 0;
}

async function seed() {
  console.log(`Fetching wilayah.sql from ${WILAYAH_SQL_URL}...`);
  const response = await fetch(WILAYAH_SQL_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch wilayah.sql: ${response.status} ${response.statusText}`,
    );
  }

  const sqlContent = await response.text();
  console.log('Parsing SQL content into raw tuples...');
  const items = parseWilayahSqlContent(sqlContent);
  console.log(`Parsed ${items.length} raw tuples.`);

  const start = Date.now();
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  const client = await pool.connect();
  try {
    console.log(`[1/2] Loading raw tuples into staging table ${TMP_TABLE}...`);
    // Staging table keeps the dot-separated form as `TEXT` so the raw dump
    // is preserved verbatim for inspection/debugging. The projection step
    // is the only place where the dots are stripped to fit `regional_addresses.code`.
    await client.query('BEGIN');
    await client.query(`DROP TABLE IF EXISTS ${TMP_TABLE}`);
    await client.query(
      `CREATE TABLE ${TMP_TABLE} (kode TEXT PRIMARY KEY, nama TEXT NOT NULL)`,
    );

    const BATCH_SIZE = 1000;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await insertBatch(client, batch);
      if (
        (i + batch.length) % 10000 === 0 ||
        i + batch.length === items.length
      ) {
        console.log(`  Loaded ${i + batch.length} / ${items.length} rows...`);
      }
    }

    const loadedCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM ${TMP_TABLE}`,
    );
    console.log(`Staging table loaded: ${loadedCount.rows[0].c} rows.`);

    console.log(
      `[2/2] Projecting into regional_addresses (level/parent computed by SQL)...`,
    );
    // Staging rows are dot-separated strings (`11.01.01.2001`). Strip the
    // dots and cast to `bigint` for the canonical `code` column. The level
    // and parent_code columns are derived purely from the digit count of
    // the stripped form — no input string parsing required at this stage.
    //
    // Digit-count conventions (matches the upstream `wilayah.sql` dataset):
    //   province = 2, regency = 4, district = 6, village = 10
    // Parent-code derivation (strip dots first, then integer-divide):
    //   regency  (4 digit) → / 100       → 2-digit province  (1101 / 100 = 11)
    //   district (6 digit) → / 100       → 4-digit regency   (110907 / 100 = 1109)
    //   village  (10 digit) → / 10000    → 6-digit district  (1101012001 / 10000 = 110101)
    const result = await client.query(
      `INSERT INTO regional_addresses (code, name, level, parent_code)
       SELECT
         (regexp_replace(kode, '[^0-9]', '', 'g'))::bigint,
         nama,
         CASE
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 2  THEN 'province'::regional_level
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 4  THEN 'regency'::regional_level
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 6  THEN 'district'::regional_level
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 10 THEN 'village'::regional_level
           ELSE NULL
         END,
         CASE
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 2  THEN NULL
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 4  THEN (regexp_replace(kode, '[^0-9]', '', 'g'))::bigint / 100
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 6  THEN (regexp_replace(kode, '[^0-9]', '', 'g'))::bigint / 100
           WHEN LENGTH(regexp_replace(kode, '[^0-9]', '', 'g')) = 10 THEN (regexp_replace(kode, '[^0-9]', '', 'g'))::bigint / 10000
           ELSE NULL
         END
       FROM ${TMP_TABLE}
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             level = EXCLUDED.level,
             parent_code = EXCLUDED.parent_code`,
    );
    console.log(`Upserted ${result.rowCount} rows into regional_addresses.`);

    await applyPostalCodes(client);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  const totalSec = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\nDone in ${totalSec}s — full regional dataset + postal codes projected into regional_addresses.`,
  );
}

function isDirectExecution(): boolean {
  // CommonJS entrypoint (Nest/tsc watch, ts-node)
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    return require.main === module;
  }

  // Bun direct execution fallback (avoid import.meta — incompatible with module: commonjs)
  const scriptPath = process.argv[1]?.replace(/\\/g, '/');
  return Boolean(scriptPath?.endsWith('regional.seed.ts'));
}

if (isDirectExecution()) {
  seed().catch((err) => {
    console.error('Regional seeding failed:', err);
    process.exit(1);
  });
}
