/**
 * Mock @supabase/supabase-js module for edge function tests.
 *
 * Tests configure behavior via `mockState` before calling the handler, then
 * call `resetMockState()` in teardown. The import map in deno.test.jsonc
 * redirects the real Supabase import to this file at test time.
 */

// ---------------------------------------------------------------------------
// Configurable mock state
// ---------------------------------------------------------------------------

export interface MockQueryResult {
  data: unknown;
  error: unknown;
}

export const mockState = {
  /** User returned by auth.getUser(). Set to null to simulate no user. */
  user: null as { id: string; email?: string } | null,
  /** Error returned by auth.getUser(). */
  authError: null as { message: string } | null,

  /** Results keyed by RPC function name. */
  rpcResults: new Map<string, MockQueryResult>(),
  /** SELECT results keyed by table name. */
  queryResults: new Map<string, MockQueryResult>(),
  /** UPDATE results keyed by table name. */
  updateResults: new Map<string, { error: unknown }>(),

  /** Custom channel.send() implementation for broadcast testing. */
  channelSendFn: null as (() => Promise<unknown>) | null,

  /** Tracks the last update() call payload per table for assertions. */
  lastUpdatePayload: new Map<string, unknown>(),
};

export function resetMockState(): void {
  mockState.user = null;
  mockState.authError = null;
  mockState.rpcResults.clear();
  mockState.queryResults.clear();
  mockState.updateResults.clear();
  mockState.channelSendFn = null;
  mockState.lastUpdatePayload.clear();
}

// ---------------------------------------------------------------------------
// Mock createClient
// ---------------------------------------------------------------------------

function createSelectChain(table: string) {
  const builder: Record<string, unknown> = {};
  builder.eq = (_col: string, _val: unknown) => builder;
  builder.is = (_col: string, _val: unknown) => builder;
  builder.maybeSingle = () => {
    const result = mockState.queryResults.get(table);
    return Promise.resolve(result ?? { data: null, error: null });
  };
  builder.single = () => {
    const result = mockState.queryResults.get(table);
    return Promise.resolve(result ?? { data: null, error: null });
  };
  return builder;
}

function createUpdateChain(table: string, data: unknown) {
  mockState.lastUpdatePayload.set(table, data);
  return {
    eq: (_col: string, _val: unknown) => {
      const result = mockState.updateResults.get(table);
      return Promise.resolve(result ?? { error: null });
    },
  };
}

export function createClient(
  _url: string,
  _key: string,
  _options?: unknown,
) {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: mockState.user },
          error: mockState.authError,
        }),
    },

    from: (table: string) => ({
      select: (_cols?: string) => createSelectChain(table),
      update: (data: unknown) => createUpdateChain(table, data),
    }),

    rpc: (fn: string, params?: Record<string, unknown>) => {
      // Support keyed lookups like "get_secret:CF_ACCOUNT_ID" for
      // parameter-specific mock results (used by Vault secret reads).
      if (params?.secret_name) {
        const keyed = mockState.rpcResults.get(`${fn}:${params.secret_name}`);
        if (keyed) return Promise.resolve(keyed);
      }
      const result = mockState.rpcResults.get(fn);
      return Promise.resolve(result ?? { data: null, error: null });
    },

    channel: (_name: string) => ({
      send: (_msg: unknown) =>
        mockState.channelSendFn
          ? mockState.channelSendFn()
          : Promise.resolve(),
    }),
  };
}
