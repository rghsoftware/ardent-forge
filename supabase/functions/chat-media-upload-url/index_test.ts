import { assertEquals } from "jsr:@std/assert";
import { mockState, resetMockState } from "../_test-utils/mock-supabase.ts";
import {
  buildRequest,
  mockEnv,
  mockFetch,
  parseJson,
  STANDARD_ENV,
} from "../_test-utils/helpers.ts";
import { handler } from "./index.ts";

// ---------------------------------------------------------------------------
// chat-media-upload-url
// ---------------------------------------------------------------------------

Deno.test("chat-media-upload-url", async (t) => {
  let restoreEnv: (() => void) | undefined;
  let restoreFetch: (() => void) | undefined;

  function setup(envOverrides?: Record<string, string>) {
    resetMockState();
    restoreEnv = mockEnv({ ...STANDARD_ENV, ...envOverrides });
    restoreFetch = mockFetch(async () =>
      new Response("unmocked", { status: 500 })
    );
  }

  function teardown() {
    restoreEnv?.();
    restoreFetch?.();
  }

  // -------------------------------------------------------------------------
  // CORS
  // -------------------------------------------------------------------------

  await t.step("OPTIONS returns CORS preflight", async () => {
    setup();
    const res = await handler(buildRequest({ method: "OPTIONS" }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    teardown();
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  await t.step("returns 401 without Authorization header", async () => {
    setup();
    const res = await handler(
      buildRequest({ body: { maxDurationSeconds: 30 } }),
    );
    const { status, body } = await parseJson(res);
    assertEquals(status, 401);
    assertEquals(body.error, "Missing authorization");
    teardown();
  });

  await t.step("returns 401 when auth.getUser fails", async () => {
    setup();
    mockState.authError = { message: "Invalid token" };
    const res = await handler(
      buildRequest({
        body: { maxDurationSeconds: 30 },
        authHeader: "Bearer bad",
      }),
    );
    assertEquals(res.status, 401);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  await t.step("returns 400 for missing maxDurationSeconds", async () => {
    setup();
    mockState.user = { id: "u1" };
    const res = await handler(
      buildRequest({ body: {}, authHeader: "Bearer ok" }),
    );
    assertEquals(res.status, 400);
    teardown();
  });

  await t.step("returns 400 when maxDurationSeconds > 60", async () => {
    setup();
    mockState.user = { id: "u1" };
    const res = await handler(
      buildRequest({
        body: { maxDurationSeconds: 120 },
        authHeader: "Bearer ok",
      }),
    );
    assertEquals(res.status, 400);
    teardown();
  });

  await t.step("returns 400 for non-integer maxDurationSeconds", async () => {
    setup();
    mockState.user = { id: "u1" };
    const res = await handler(
      buildRequest({
        body: { maxDurationSeconds: 30.5 },
        authHeader: "Bearer ok",
      }),
    );
    assertEquals(res.status, 400);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Cloudflare config
  // -------------------------------------------------------------------------

  await t.step("returns 502 when CLOUDFLARE_ACCOUNT_ID missing", async () => {
    const { CLOUDFLARE_ACCOUNT_ID: _, ...envWithout } = STANDARD_ENV;
    setup(envWithout);
    // Override env to exclude CLOUDFLARE_ACCOUNT_ID
    restoreEnv?.();
    restoreEnv = mockEnv(envWithout);

    mockState.user = { id: "u1" };
    const res = await handler(
      buildRequest({
        body: { maxDurationSeconds: 30 },
        authHeader: "Bearer ok",
      }),
    );
    const { status, body } = await parseJson(res);
    assertEquals(status, 502);
    assertEquals(body.error, "Cloudflare account not configured");
    teardown();
  });

  await t.step("returns 502 when vault secret retrieval fails", async () => {
    setup();
    mockState.user = { id: "u1" };
    mockState.rpcResults.set("get_secret", {
      data: null,
      error: { message: "vault error" },
    });
    const res = await handler(
      buildRequest({
        body: { maxDurationSeconds: 30 },
        authHeader: "Bearer ok",
      }),
    );
    assertEquals(res.status, 502);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Cloudflare API errors
  // -------------------------------------------------------------------------

  await t.step("returns 502 when Cloudflare Stream API errors", async () => {
    setup();
    mockState.user = { id: "u1" };
    mockState.rpcResults.set("get_secret", {
      data: "cf-api-token",
      error: null,
    });
    restoreFetch?.();
    restoreFetch = mockFetch(async () =>
      new Response("rate limited", { status: 429 })
    );
    const res = await handler(
      buildRequest({
        body: { maxDurationSeconds: 30 },
        authHeader: "Bearer ok",
      }),
    );
    assertEquals(res.status, 502);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  await t.step("returns 200 with tusUrl and assetId on success", async () => {
    setup();
    mockState.user = { id: "u1" };
    mockState.rpcResults.set("get_secret", {
      data: "cf-api-token",
      error: null,
    });
    restoreFetch?.();
    restoreFetch = mockFetch(async () =>
      new Response(JSON.stringify({ result: { uid: "cf-vid-abc" } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          location: "https://upload.cloudflarestream.com/tus/abc",
        },
      })
    );

    const res = await handler(
      buildRequest({
        body: { maxDurationSeconds: 30 },
        authHeader: "Bearer ok",
      }),
    );
    const { status, body } = await parseJson(res);
    assertEquals(status, 200);
    assertEquals(body.tusUrl, "https://upload.cloudflarestream.com/tus/abc");
    assertEquals(body.assetId, "cf-vid-abc");
    teardown();
  });
});
