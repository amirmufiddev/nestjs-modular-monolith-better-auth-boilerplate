# Database Seeder System (Admin, RBAC, Regional) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun sistem seeder database modular untuk User Admin, RBAC, dan Regional dengan pelacakan tabel ledger `_seeds` agar seed yang sudah dieksekusi tidak dijalankan ulang saat `bun run db:seed`.

**Architecture:** Database runner (`seed.ts`) memelihara tabel ledger `_seeds` untuk mencatat identifier seed yang berhasil dieksekusi per batch. Modul seeder (`admin`, `rbac`, `regional`) mengimplementasikan interface `Seeder`, dipanggil secara sekuensial berdasarkan dependency order, dan mendukung override flag `--force` serta penargetan nama seeder spesifik.

**Tech Stack:** TypeScript, Bun test runner, Drizzle ORM, `pg` (node-postgres), Argon2, Better Auth schema.

## Global Constraints

- Standar arsitektur modular monolith: Seeder tidak boleh membocorkan query acak; pemisahan tanggung jawab jelas (SRP).
- Ledger table: `_seeds` (kolom `id`, `name`, `batch`, `executed_at`).
- Idempotency & skip: Seeder yang sudah tercatat di `_seeds` dilewati kecuali flag `--force` diberikan.
- Admin password: Di-hash menggunakan library `argon2` agar kompatibel penuh dengan Better Auth credential plugin.
- Tidak boleh membiarkan `console.log` liar pada library / service produksi, namun CLI runner diizinkan menggunakan format console log terstruktur.
- Semua tes harus dijalankan dengan `bun test` dan berstatus passing (100%).

---

### Task 1: Seeder Interface and Ledger-Aware Runner Core

**Files:**
- Create: `src/database/seeds/seeder.interface.ts`
- Create: `src/database/seed.ts`
- Create: `src/database/seed.spec.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface SeederContext {
    db: NodePgDatabase<Record<string, unknown>>;
    pool: Pool;
  }
  export interface Seeder {
    readonly name: string;
    run(context: SeederContext): Promise<void>;
  }
  export interface RunSeedersOptions {
    force?: boolean;
    target?: string;
  }
  export async function ensureSeedsTable(pool: Pool): Promise<void>;
  export async function getExecutedSeeds(pool: Pool): Promise<Set<string>>;
  export async function getNextBatchNumber(pool: Pool): Promise<number>;
  export async function recordExecutedSeed(pool: Pool, name: string, batch: number): Promise<void>;
  export async function runSeeders(
    seeders: Seeder[],
    options: RunSeedersOptions,
    context: SeederContext,
  ): Promise<{ executed: string[]; skipped: string[] }>;
  ```

- [ ] **Step 1: Write the failing test for Runner core**

Tulis unit test di `src/database/seed.spec.ts` untuk menguji pembuatan tabel `_seeds`, query riwayat eksekusi, filtering seed yang sudah dijalankan, flag `--force`, dan target seed spesifik.

```typescript
import { describe, expect, it, mock } from 'bun:test';
import type { Seeder, SeederContext } from './seeds/seeder.interface';
import {
  ensureSeedsTable,
  getExecutedSeeds,
  getNextBatchNumber,
  recordExecutedSeed,
  runSeeders,
} from './seed';

describe('Seed Runner Core', () => {
  it('ensureSeedsTable should create _seeds table if not exists', async () => {
    const queryMock = mock(() => Promise.resolve({ rows: [] }));
    const fakePool = { query: queryMock } as unknown as any;

    await ensureSeedsTable(fakePool);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS "_seeds"');
  });

  it('getExecutedSeeds should return a set of executed seed names', async () => {
    const queryMock = mock(() =>
      Promise.resolve({
        rows: [{ name: 'rbac' }, { name: 'admin' }],
      }),
    );
    const fakePool = { query: queryMock } as unknown as any;

    const result = await getExecutedSeeds(fakePool);

    expect(result.has('rbac')).toBe(true);
    expect(result.has('admin')).toBe(true);
    expect(result.has('regional')).toBe(false);
  });

  it('getNextBatchNumber should return 1 when table is empty or max is null', async () => {
    const queryMock = mock(() =>
      Promise.resolve({
        rows: [{ max_batch: null }],
      }),
    );
    const fakePool = { query: queryMock } as unknown as any;

    const batch = await getNextBatchNumber(fakePool);
    expect(batch).toBe(1);
  });

  it('recordExecutedSeed should insert seed name and batch into _seeds', async () => {
    const queryMock = mock(() => Promise.resolve({ rows: [] }));
    const fakePool = { query: queryMock } as unknown as any;

    await recordExecutedSeed(fakePool, 'rbac', 2);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "_seeds"'),
      ['rbac', 2],
    );
  });

  it('runSeeders should skip already executed seeders when force is false', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: async () => {
        executedLogs.push('rbac');
      },
    };
    const seeder2: Seeder = {
      name: 'admin',
      run: async () => {
        executedLogs.push('admin');
      },
    };

    const queryMock = mock((sql: string) => {
      if (sql.includes('SELECT name FROM "_seeds"')) {
        return Promise.resolve({ rows: [{ name: 'rbac' }] });
      }
      if (sql.includes('SELECT COALESCE(MAX(batch), 0)')) {
        return Promise.resolve({ rows: [{ max_batch: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext: SeederContext = { db: {} as any, pool: fakePool };

    const result = await runSeeders([seeder1, seeder2], { force: false }, fakeContext);

    expect(result.skipped).toEqual(['rbac']);
    expect(result.executed).toEqual(['admin']);
    expect(executedLogs).toEqual(['admin']);
  });

  it('runSeeders should re-run executed seeders when force is true', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: async () => {
        executedLogs.push('rbac');
      },
    };

    const queryMock = mock((sql: string) => {
      if (sql.includes('SELECT name FROM "_seeds"')) {
        return Promise.resolve({ rows: [{ name: 'rbac' }] });
      }
      if (sql.includes('SELECT COALESCE(MAX(batch), 0)')) {
        return Promise.resolve({ rows: [{ max_batch: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext: SeederContext = { db: {} as any, pool: fakePool };

    const result = await runSeeders([seeder1], { force: true }, fakeContext);

    expect(result.skipped).toEqual([]);
    expect(result.executed).toEqual(['rbac']);
    expect(executedLogs).toEqual(['rbac']);
  });

  it('runSeeders should only run targeted seeder when target option is specified', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: async () => {
        executedLogs.push('rbac');
      },
    };
    const seeder2: Seeder = {
      name: 'admin',
      run: async () => {
        executedLogs.push('admin');
      },
    };

    const queryMock = mock((sql: string) => {
      if (sql.includes('SELECT name FROM "_seeds"')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT COALESCE(MAX(batch), 0)')) {
        return Promise.resolve({ rows: [{ max_batch: 0 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext: SeederContext = { db: {} as any, pool: fakePool };

    const result = await runSeeders([seeder1, seeder2], { target: 'admin' }, fakeContext);

    expect(result.executed).toEqual(['admin']);
    expect(executedLogs).toEqual(['admin']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/database/seed.spec.ts`  
Expected: FAIL (Cannot find module `./seeds/seeder.interface` or `./seed`).

- [ ] **Step 3: Implement minimal code for Seeder interface and Runner core**

Buat `src/database/seeds/seeder.interface.ts`:
```typescript
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export interface SeederContext {
  db: NodePgDatabase<Record<string, unknown>>;
  pool: Pool;
}

export interface Seeder {
  readonly name: string;
  run(context: SeederContext): Promise<void>;
}
```

Buat `src/database/seed.ts`:
```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.validation';
import type { Seeder, SeederContext } from './seeds/seeder.interface';

export interface RunSeedersOptions {
  force?: boolean;
  target?: string;
}

export async function ensureSeedsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "_seeds" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL UNIQUE,
      "batch" integer NOT NULL,
      "executed_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
}

export async function getExecutedSeeds(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM "_seeds" ORDER BY id ASC;`,
  );
  return new Set(result.rows.map((row) => row.name));
}

export async function getNextBatchNumber(pool: Pool): Promise<number> {
  const result = await pool.query<{ max_batch: number | null }>(
    `SELECT COALESCE(MAX(batch), 0) AS max_batch FROM "_seeds";`,
  );
  const currentMax = result.rows[0]?.max_batch ?? 0;
  return Number(currentMax) + 1;
}

export async function recordExecutedSeed(
  pool: Pool,
  name: string,
  batch: number,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO "_seeds" ("name", "batch", "executed_at")
    VALUES ($1, $2, now())
    ON CONFLICT ("name") DO UPDATE
      SET "batch" = EXCLUDED.batch,
          "executed_at" = EXCLUDED.executed_at;
    `,
    [name, batch],
  );
}

export async function runSeeders(
  seeders: Seeder[],
  options: RunSeedersOptions,
  context: SeederContext,
): Promise<{ executed: string[]; skipped: string[] }> {
  await ensureSeedsTable(context.pool);
  const executedSet = await getExecutedSeeds(context.pool);
  const nextBatch = await getNextBatchNumber(context.pool);

  const executed: string[] = [];
  const skipped: string[] = [];

  const candidateSeeders = options.target
    ? seeders.filter((s) => s.name === options.target)
    : seeders;

  if (options.target && candidateSeeders.length === 0) {
    throw new Error(`Seeder with name "${options.target}" not found.`);
  }

  for (const seeder of candidateSeeders) {
    const isAlreadyExecuted = executedSet.has(seeder.name);
    if (isAlreadyExecuted && !options.force) {
      console.log(`[skip] Seeder "${seeder.name}" has already been executed.`);
      skipped.push(seeder.name);
      continue;
    }

    console.log(`[start] Running seeder "${seeder.name}"...`);
    const startTime = Date.now();
    await seeder.run(context);
    await recordExecutedSeed(context.pool, seeder.name, nextBatch);
    const duration = Date.now() - startTime;
    console.log(`[done] Seeder "${seeder.name}" finished in ${duration}ms.`);
    executed.push(seeder.name);
  }

  return { executed, skipped };
}

export function parseCliArgs(argv: string[]): RunSeedersOptions {
  const args = argv.slice(2);
  const force = args.includes('--force');
  const target = args.find((arg) => !arg.startsWith('--'));
  return { force, target };
}

async function main() {
  const options = parseCliArgs(process.argv);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Registry seeders will be imported here in Task 5
    const seeders: Seeder[] = [];
    console.log('🌱 Starting database seeding...');
    const result = await runSeeders(seeders, options, { db, pool });
    console.log(
      `🎉 Seeding completed. Executed: ${result.executed.length}, Skipped: ${result.skipped.length}`,
    );
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module
) {
  main();
} else if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/database/seed.ts')) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/database/seed.spec.ts`  
Expected: PASS with 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/database/seeds/seeder.interface.ts src/database/seed.ts src/database/seed.spec.ts
git commit -m "feat(database): implement ledger-aware seed runner core and interface"
```

---

### Task 2: RBAC Seeder (Permissions & Role Templates)

**Files:**
- Create: `src/database/seeds/rbac.seed.ts`
- Create: `src/database/seeds/rbac.seed.spec.ts`

**Interfaces:**
- Consumes:
  - `BOOTSTRAP_BETTER_AUTH_STATEMENT`, `getDefaultRolePermissions`, `getDefaultPermissionScopes` from `@/modules/rbac/constants/permissions.constant`
  - `rbacPermission`, `rbacRoleTemplate` from `@/database/schema`
  - `Seeder`, `SeederContext` from `./seeder.interface`
- Produces:
  ```typescript
  export const rbacSeeder: Seeder;
  export function buildRbacPermissionRows(): Array<typeof rbacPermission.$inferInsert>;
  export function buildRbacRoleTemplateRows(): Array<typeof rbacRoleTemplate.$inferInsert>;
  ```

- [ ] **Step 1: Write the failing test for RBAC Seeder**

Tulis unit test di `src/database/seeds/rbac.seed.spec.ts`:

```typescript
import { describe, expect, it, mock } from 'bun:test';
import {
  buildRbacPermissionRows,
  buildRbacRoleTemplateRows,
  rbacSeeder,
} from './rbac.seed';

describe('RBAC Seeder', () => {
  it('buildRbacPermissionRows should generate rows for all actions in bootstrap statement', () => {
    const rows = buildRbacPermissionRows();
    expect(rows.length).toBeGreaterThan(0);

    const memberRead = rows.find(
      (r) => r.resource === 'member' && r.action === 'read',
    );
    expect(memberRead).toBeDefined();
    expect(memberRead?.resourceDisplayName).toBe('member');
    expect(memberRead?.actionDisplayName).toBe('read');
  });

  it('buildRbacRoleTemplateRows should produce templates for owner, admin, and member', () => {
    const templates = buildRbacRoleTemplateRows();
    const roleNames = templates.map((t) => t.roleName);

    expect(roleNames).toContain('owner');
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('member');

    for (const t of templates) {
      expect(() => JSON.parse(t.permission)).not.toThrow();
      expect(() => JSON.parse(t.permissionScopes)).not.toThrow();
    }
  });

  it('rbacSeeder.run should execute inserts into rbac_permission and rbac_role_template', async () => {
    const executedQueries: string[] = [];
    const queryMock = mock((sql: string) => {
      executedQueries.push(sql);
      return Promise.resolve({ rows: [] });
    });

    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext = { db: {} as any, pool: fakePool };

    await rbacSeeder.run(fakeContext);

    expect(executedQueries.some((q) => q.includes('INSERT INTO "rbac_permission"'))).toBe(true);
    expect(executedQueries.some((q) => q.includes('INSERT INTO "rbac_role_template"'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/database/seeds/rbac.seed.spec.ts`  
Expected: FAIL (Cannot find module `./rbac.seed`).

- [ ] **Step 3: Implement RBAC Seeder**

Buat `src/database/seeds/rbac.seed.ts`:

```typescript
import {
  BOOTSTRAP_BETTER_AUTH_STATEMENT,
  getDefaultRolePermissions,
  getDefaultPermissionScopes,
} from '@/modules/rbac/constants/permissions.constant';
import type { Seeder, SeederContext } from './seeder.interface';

export function buildRbacPermissionRows(): Array<{
  resource: string;
  action: string;
  actionDisplayName: string;
  actionDescription: string;
  resourceDisplayName: string;
  resourceDescription: string;
}> {
  const rows: Array<{
    resource: string;
    action: string;
    actionDisplayName: string;
    actionDescription: string;
    resourceDisplayName: string;
    resourceDescription: string;
  }> = [];

  for (const [resource, actions] of Object.entries(BOOTSTRAP_BETTER_AUTH_STATEMENT)) {
    for (const action of actions) {
      rows.push({
        resource,
        action,
        actionDisplayName: action,
        actionDescription: `Permission to ${action} ${resource}`,
        resourceDisplayName: resource,
        resourceDescription: `Resource ${resource}`,
      });
    }
  }

  return rows;
}

export function buildRbacRoleTemplateRows(): Array<{
  roleName: string;
  permission: string;
  permissionScopes: string;
}> {
  const rolePermissions = getDefaultRolePermissions();
  const roleScopes = getDefaultPermissionScopes();

  const roleNames = Array.from(
    new Set([...Object.keys(rolePermissions), ...Object.keys(roleScopes)]),
  );

  return roleNames.map((roleName) => ({
    roleName,
    permission: JSON.stringify(rolePermissions[roleName] ?? {}),
    permissionScopes: JSON.stringify(roleScopes[roleName] ?? {}),
  }));
}

export const rbacSeeder: Seeder = {
  name: 'rbac',
  async run({ pool }: SeederContext): Promise<void> {
    const permissions = buildRbacPermissionRows();
    const roleTemplates = buildRbacRoleTemplateRows();

    // Insert permissions (active unique index uq_rbac_permission_resource_action_active where deleted_at is null)
    for (const perm of permissions) {
      await pool.query(
        `
        INSERT INTO "rbac_permission" (
          "resource",
          "action",
          "action_display_name",
          "action_description",
          "resource_display_name",
          "resource_description"
        )
        SELECT $1, $2, $3, $4, $5, $6
        WHERE NOT EXISTS (
          SELECT 1 FROM "rbac_permission"
          WHERE "resource" = $1 AND "action" = $2 AND "deleted_at" IS NULL
        );
        `,
        [
          perm.resource,
          perm.action,
          perm.actionDisplayName,
          perm.actionDescription,
          perm.resourceDisplayName,
          perm.resourceDescription,
        ],
      );
    }

    // Insert or update role templates
    for (const tmpl of roleTemplates) {
      await pool.query(
        `
        INSERT INTO "rbac_role_template" ("role_name", "permission", "permission_scopes", "created_at", "updated_at")
        VALUES ($1, $2, $3, now(), now())
        ON CONFLICT ("role_name") DO UPDATE
          SET "permission" = EXCLUDED.permission,
              "permission_scopes" = EXCLUDED.permission_scopes,
              "updated_at" = now();
        `,
        [tmpl.roleName, tmpl.permission, tmpl.permissionScopes],
      );
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/database/seeds/rbac.seed.spec.ts`  
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/database/seeds/rbac.seed.ts src/database/seeds/rbac.seed.spec.ts
git commit -m "feat(database): implement rbac permissions and role templates seeder"
```

---

### Task 3: Admin User Seeder (Better Auth User & Credential Account)

**Files:**
- Create: `src/database/seeds/admin.seed.ts`
- Create: `src/database/seeds/admin.seed.spec.ts`

**Interfaces:**
- Consumes:
  - `Seeder`, `SeederContext` from `./seeder.interface`
  - `argon2` for password hashing
- Produces:
  ```typescript
  export interface AdminSeedConfig {
    email: string;
    password: string;
    name: string;
    username: string;
    phoneNumber: string;
  }
  export function getAdminSeedConfig(): AdminSeedConfig;
  export const adminSeeder: Seeder;
  ```

- [ ] **Step 1: Write the failing test for Admin Seeder**

Tulis unit test di `src/database/seeds/admin.seed.spec.ts`:

```typescript
import { describe, expect, it, mock } from 'bun:test';
import { getAdminSeedConfig, adminSeeder } from './admin.seed';
import * as argon2 from 'argon2';

describe('Admin Seeder', () => {
  it('getAdminSeedConfig should return env overrides or default values', () => {
    const config = getAdminSeedConfig();
    expect(config.email).toBeTruthy();
    expect(config.password).toBeTruthy();
    expect(config.name).toBeTruthy();
    expect(config.username).toBeTruthy();
    expect(config.phoneNumber).toBeTruthy();
  });

  it('adminSeeder.run should skip if user already exists', async () => {
    const executedQueries: string[] = [];
    const queryMock = mock((sql: string) => {
      executedQueries.push(sql);
      if (sql.includes('SELECT "id" FROM "user" WHERE "email" = $1')) {
        return Promise.resolve({ rows: [{ id: 'existing-admin-id' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext = { db: {} as any, pool: fakePool };

    await adminSeeder.run(fakeContext);

    expect(executedQueries.some((q) => q.includes('INSERT INTO "user"'))).toBe(false);
    expect(executedQueries.some((q) => q.includes('INSERT INTO "account"'))).toBe(false);
  });

  it('adminSeeder.run should create user and account with hashed password if user does not exist', async () => {
    let insertedPasswordHash = '';
    const queryMock = mock((sql: string, params?: any[]) => {
      if (sql.includes('SELECT "id" FROM "user" WHERE "email" = $1')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO "account"')) {
        insertedPasswordHash = params?.[5];
      }
      return Promise.resolve({ rows: [] });
    });

    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext = { db: {} as any, pool: fakePool };

    await adminSeeder.run(fakeContext);

    expect(queryMock.mock.calls.some(([sql]: [string]) => sql.includes('INSERT INTO "user"'))).toBe(true);
    expect(queryMock.mock.calls.some(([sql]: [string]) => sql.includes('INSERT INTO "account"'))).toBe(true);
    expect(insertedPasswordHash).toBeTruthy();

    const config = getAdminSeedConfig();
    const isPasswordValid = await argon2.verify(insertedPasswordHash, config.password);
    expect(isPasswordValid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/database/seeds/admin.seed.spec.ts`  
Expected: FAIL (Cannot find module `./admin.seed`).

- [ ] **Step 3: Implement Admin User Seeder**

Buat `src/database/seeds/admin.seed.ts`:

```typescript
import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import type { Seeder, SeederContext } from './seeder.interface';

export interface AdminSeedConfig {
  email: string;
  password: string;
  name: string;
  username: string;
  phoneNumber: string;
}

export function getAdminSeedConfig(): AdminSeedConfig {
  return {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin12345!',
    name: process.env.SEED_ADMIN_NAME || 'Super Admin',
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    phoneNumber: process.env.SEED_ADMIN_PHONE || '+6281234567890',
  };
}

export const adminSeeder: Seeder = {
  name: 'admin',
  async run({ pool }: SeederContext): Promise<void> {
    const config = getAdminSeedConfig();

    const existingUserResult = await pool.query<{ id: string }>(
      `SELECT "id" FROM "user" WHERE "email" = $1 LIMIT 1;`,
      [config.email],
    );

    if (existingUserResult.rows.length > 0) {
      console.log(`[admin] User with email "${config.email}" already exists. Skipping.`);
      return;
    }

    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const hashedPassword = await argon2.hash(config.password);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        INSERT INTO "user" (
          "id",
          "name",
          "email",
          "email_verified",
          "role",
          "username",
          "display_username",
          "phone_number",
          "phone_number_verified",
          "created_at",
          "updated_at"
        )
        VALUES ($1, $2, $3, true, 'admin', $4, $4, $5, true, now(), now());
        `,
        [userId, config.name, config.email, config.username, config.phoneNumber],
      );

      await client.query(
        `
        INSERT INTO "account" (
          "id",
          "account_id",
          "provider_id",
          "user_id",
          "password",
          "created_at",
          "updated_at"
        )
        VALUES ($1, $2, 'credential', $3, $4, now(), now());
        `,
        [accountId, userId, userId, hashedPassword],
      );

      await client.query('COMMIT');
      console.log(`[admin] User admin "${config.email}" successfully created.`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/database/seeds/admin.seed.spec.ts`  
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/database/seeds/admin.seed.ts src/database/seeds/admin.seed.spec.ts
git commit -m "feat(database): implement admin user and credentials seeder"
```

---

### Task 4: Regional Seeder Adapter & Standalone Compatibility

**Files:**
- Modify: `src/database/seeds/regional.seed.ts`
- Test: `src/database/seeds/regional.seed.spec.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const regionalSeeder: Seeder;
  ```

- [ ] **Step 1: Write the failing test for Regional Seeder adapter**

Tambahkan pengujian instance `regionalSeeder` di `src/database/seeds/regional.seed.spec.ts`:

```typescript
import { regionalSeeder } from './regional.seed';

// (tambahkan pada describe block di src/database/seeds/regional.seed.spec.ts)
describe('regionalSeeder', () => {
  it('should export regionalSeeder with name "regional" and a run method', () => {
    expect(regionalSeeder).toBeDefined();
    expect(regionalSeeder.name).toBe('regional');
    expect(typeof regionalSeeder.run).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/database/seeds/regional.seed.spec.ts`  
Expected: FAIL (`regionalSeeder` is not exported).

- [ ] **Step 3: Update `src/database/seeds/regional.seed.ts` to implement Seeder interface**

Di `src/database/seeds/regional.seed.ts`:
1. Import `Seeder` dan `SeederContext` dari `./seeder.interface`.
2. Ubah `seed()` agar menerima parameter opsional `poolOverride?: Pool` (jika tidak disediakan, gunakan `new Pool({ connectionString: env.DATABASE_URL })` dan jangan tutup pool jika disediakan dari context).
3. Ekspor `regionalSeeder: Seeder`.

Implementasi perubahan:
```typescript
import type { Seeder, SeederContext } from './seeder.interface';

export async function runRegionalSeed(poolOverride?: Pool): Promise<void> {
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
  const pool = poolOverride ?? new Pool({ connectionString: env.DATABASE_URL });
  const shouldClosePool = !poolOverride;

  const client = await pool.connect();
  try {
    console.log(`[1/2] Loading raw tuples into staging table ${TMP_TABLE}...`);
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
    if (shouldClosePool) {
      await pool.end();
    }
  }

  const totalSec = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\nDone in ${totalSec}s — full regional dataset + postal codes projected into regional_addresses.`,
  );
}

export const regionalSeeder: Seeder = {
  name: 'regional',
  async run({ pool }: SeederContext): Promise<void> {
    await runRegionalSeed(pool);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/database/seeds/regional.seed.spec.ts`  
Expected: PASS with 11 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/database/seeds/regional.seed.ts src/database/seeds/regional.seed.spec.ts
git commit -m "feat(database): adapt regional seeder to implement seeder interface"
```

---

### Task 5: Integration, CLI Script Wiring, and End-to-End Verification

**Files:**
- Modify: `src/database/seed.ts` (daftarkan `[rbacSeeder, adminSeeder, regionalSeeder]`)
- Modify: `package.json` (perbaiki script `"db:seed:regional"`)
- Test: `src/database/seed.spec.ts`

- [ ] **Step 1: Write integration test for seed registry**

Tambahkan pengujian di `src/database/seed.spec.ts` untuk memastikan registry default memuat seeder `rbac`, `admin`, dan `regional` dalam urutan yang benar.

```typescript
import { defaultSeeders } from './seed';

describe('defaultSeeders registry', () => {
  it('should contain rbac, admin, and regional seeders in correct order', () => {
    const names = defaultSeeders.map((s) => s.name);
    expect(names).toEqual(['rbac', 'admin', 'regional']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/database/seed.spec.ts`  
Expected: FAIL (`defaultSeeders` not exported).

- [ ] **Step 3: Update `src/database/seed.ts` and `package.json`**

1. Di `src/database/seed.ts`, impor `rbacSeeder`, `adminSeeder`, dan `regionalSeeder`.
2. Ekspor `export const defaultSeeders: Seeder[] = [rbacSeeder, adminSeeder, regionalSeeder];`.
3. Gunakan `defaultSeeders` di dalam fungsi `main()`.
4. Di `package.json`, perbaiki path script `"db:seed:regional"`:
   - Dari: `"db:seed:regional": "bun run src/infrastructure/database/seeds/regional.seed.ts"`
   - Menjadi: `"db:seed:regional": "bun run src/database/seeds/regional.seed.ts"`

- [ ] **Step 4: Run all test suites and linter**

Run:
```bash
bun test
bun run lint
```
Expected: PASS without errors or linter warnings.

- [ ] **Step 5: Commit**

```bash
git add src/database/seed.ts package.json src/database/seed.spec.ts
git commit -m "feat(database): wire default seeders registry and update package scripts"
```
