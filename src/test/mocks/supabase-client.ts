import { vi } from 'vitest'

type SupabaseResponse<T = unknown> =
  | { data: T; error: null }
  | { data: null; error: { message: string } }

interface MockQueryBuilder {
  select: (columns?: string) => MockQueryBuilder
  insert: (data: unknown) => MockQueryBuilder
  update: (data: unknown) => MockQueryBuilder
  delete: () => MockQueryBuilder
  upsert: (data: unknown) => MockQueryBuilder
  eq: (column: string, value: unknown) => MockQueryBuilder
  neq: (column: string, value: unknown) => MockQueryBuilder
  not: (column: string, operator: string, value: unknown) => MockQueryBuilder
  is: (column: string, value: unknown) => MockQueryBuilder
  in: (column: string, values: unknown[]) => MockQueryBuilder
  ilike: (column: string, pattern: string) => MockQueryBuilder
  or: (filters: string) => MockQueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => MockQueryBuilder
  limit: (count: number) => MockQueryBuilder
  range: (from: number, to: number) => MockQueryBuilder
  single: () => Promise<SupabaseResponse>
  maybeSingle: () => Promise<SupabaseResponse>
  then: PromiseLike<SupabaseResponse>['then']
}

interface MockResponseConfig {
  table: string
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  data: unknown
  error?: { message: string } | null
}

/**
 * Creates a mock Supabase client with chainable query builder pattern.
 *
 * Usage:
 *   const client = createMockSupabaseClient()
 *   client.mockResponse('exercises', 'select', [{ id: '1', name: 'Squat' }])
 *   const { data } = await client.from('exercises').select()
 *   // data === [{ id: '1', name: 'Squat' }]
 */
export function createMockSupabaseClient() {
  const responses = new Map<string, SupabaseResponse>()

  function makeKey(table: string, operation: string): string {
    return `${table}:${operation}`
  }

  function getResponse(table: string, operation: string): SupabaseResponse {
    const key = makeKey(table, operation)
    const stored = responses.get(key)
    if (!stored) {
      throw new Error(
        `No mock response configured for ${table}:${operation}. Call mockClient.mockResponse('${table}', '${operation}', ...) in your test setup.`,
      )
    }
    return stored
  }

  function createQueryBuilder(table: string, operation: string): MockQueryBuilder {
    const resolveResponse = (): SupabaseResponse => getResponse(table, operation)

    const builder: MockQueryBuilder = {
      select: vi.fn((_columns?: string) => {
        // Supabase allows `.insert(data).select()` chaining to return the inserted row,
        // so the insert operation must be preserved for the select/single chain to work correctly.
        if (operation !== 'select') return createQueryBuilder(table, operation)
        return builder
      }),
      insert: vi.fn((_data: unknown) => createQueryBuilder(table, 'insert')),
      update: vi.fn((_data: unknown) => createQueryBuilder(table, 'update')),
      delete: vi.fn(() => createQueryBuilder(table, 'delete')),
      upsert: vi.fn((_data: unknown) => createQueryBuilder(table, 'upsert')),
      eq: vi.fn((_column: string, _value: unknown) => builder),
      neq: vi.fn((_column: string, _value: unknown) => builder),
      not: vi.fn((_column: string, _operator: string, _value: unknown) => builder),
      is: vi.fn((_column: string, _value: unknown) => builder),
      in: vi.fn((_column: string, _values: unknown[]) => builder),
      ilike: vi.fn((_column: string, _pattern: string) => builder),
      or: vi.fn((_filters: string) => builder),
      order: vi.fn((_column: string, _options?: { ascending?: boolean }) => builder),
      limit: vi.fn((_count: number) => builder),
      range: vi.fn((_from: number, _to: number) => builder),
      single: vi.fn(async () => {
        const resp = resolveResponse()
        if (Array.isArray(resp.data) && resp.data.length > 0) {
          return { data: resp.data[0], error: null }
        }
        if (Array.isArray(resp.data) && resp.data.length === 0) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
        }
        return resp
      }),
      maybeSingle: vi.fn(async () => {
        const resp = resolveResponse()
        if (Array.isArray(resp.data) && resp.data.length > 0) {
          return { data: resp.data[0], error: null }
        }
        if (Array.isArray(resp.data) && resp.data.length === 0) {
          return { data: null, error: null }
        }
        return resp
      }),
      then: ((resolve: (value: SupabaseResponse) => void, reject?: (reason: unknown) => void) => {
        return Promise.resolve(resolveResponse()).then(resolve, reject)
      }) as PromiseLike<SupabaseResponse>['then'],
    }

    return builder
  }

  const client = {
    from: vi.fn((table: string) => createQueryBuilder(table, 'select')),

    /** RPC calls default to empty array -- override with mockResolvedValue in tests. */
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),

    /**
     * Configure the response for a specific table and operation.
     *
     * @example
     *   client.mockResponse('exercises', 'select', [{ id: '1', name: 'Squat' }])
     *   client.mockResponse('exercises', 'insert', { id: '2', name: 'Bench' })
     *   client.mockResponse('exercises', 'select', null, { message: 'Not found' })
     */
    mockResponse(
      table: string,
      operation: MockResponseConfig['operation'],
      data: unknown,
      error?: { message: string } | null,
    ): void {
      const key = makeKey(table, operation)
      if (error) {
        responses.set(key, { data: null, error })
      } else {
        responses.set(key, { data, error: null })
      }
    },

    /** Clear all configured mock responses. */
    clearResponses(): void {
      responses.clear()
    },

    /** Mock auth object for tests that need it. */
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-001', email: 'test@example.com' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { provider: 'google', url: 'https://mock-oauth-url.example.com' },
        error: null,
      }),
      exchangeCodeForSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null, user: null }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  }

  return client
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
