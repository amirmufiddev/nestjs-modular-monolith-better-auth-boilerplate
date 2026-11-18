/**
 * Read-only DTO for regional master data.
 *
 * Represents a row from the shared `regional_addresses` table, projected into
 * the public API surface. The shape is intentionally narrow: callers only see
 * `code`, `name`, `parentCode`, and `postalCode` — the `level` enum is
 * filtered server-side by endpoint (provinces/regencies/districts/villages).
 *
 * `code` and `parentCode` are returned as plain `number`s: the dot separators
 * present in the upstream dataset (e.g. `11.01.01.2001`) are stripped at
 * ingestion time, so the canonical representation is a `bigint` that fits
 * safely in a JS `number` (max value is 13 digits).
 */
export interface RegionalDataDto {
  code: number;
  name: string;
  parentCode: number | null;
  postalCode: string | null;
}
