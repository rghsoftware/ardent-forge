/**
 * Shared utilities for database adapter layers (Supabase PostgREST and Tauri SQLite).
 *
 * - `camelizeKeys` normalizes snake_case column names returned by both adapters into
 *   camelCase before mapping to domain types. Only the top-level keys are transformed;
 *   JSONB values are left as-is because they are stored and retrieved in camelCase form
 *   (serialized from domain objects via JSON.stringify).
 *
 * - `parseJsonOrValue` handles the divergence between Supabase PostgREST (JSONB comes
 *   back as a parsed object) and Tauri SQLite (JSONB comes back as a raw JSON string).
 */

/**
 * Converts a single snake_case string to camelCase.
 * Only transforms underscore-delimited segments; already-camelCase strings are unchanged.
 */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Shallow-converts all snake_case keys in a database row object to camelCase.
 * Values are copied by reference; no deep transformation is performed.
 *
 * @example
 * camelizeKeys({ created_at: '2024-01-01', user_id: 'abc' })
 * // => { createdAt: '2024-01-01', userId: 'abc' }
 */
export function camelizeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [snakeToCamel(key), value]))
}

/**
 * Safely parses a value that may already be a parsed object (PostgREST JSONB) or a
 * raw JSON string (Tauri SQLite JSONB). Returns the parsed value in both cases.
 *
 * @param column - The DB column name, used in the error message when JSON parsing fails.
 */
export function parseJsonOrValue(value: string | object, column: string): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (e) {
    throw new Error(
      `Invalid JSON in column "${column}": ${e instanceof Error ? e.message : String(e)}. ` +
        `Raw value (first 100 chars): "${value.slice(0, 100)}"`,
    )
  }
}
