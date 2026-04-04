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
// chat-media-signed-url
// ---------------------------------------------------------------------------

Deno.test("chat-media-signed-url", async (t) => {
  let restoreEnv: (() => void) | undefined;
  let restoreFetch: (() => void) | undefined;

  const VALID_BODY = {
    assetId: "cf-vid-abc",
    conversationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  };

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
    const res = await handler(buildRequest({ body: VALID_BODY }));
    const { status, body } = await parseJson(res);
    assertEquals(status, 401);
    assertEquals(body.error, "Missing authorization");
    teardown();
  });

  await t.step("returns 401 when auth.getUser fails", async () => {
    setup();
    mockState.authError = { message: "expired" };
    const res = await handler(
      buildRequest({ body: VALID_BODY, authHeader: "Bearer bad" }),
    );
    assertEquals(res.status, 401);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  await t.step("returns 400 for missing assetId", async () => {
    setup();
    mockState.user = { id: "u1" };
    const res = await handler(
      buildRequest({
        body: { conversationId: VALID_BODY.conversationId },
        authHeader: "Bearer ok",
      }),
    );
    assertEquals(res.status, 400);
    teardown();
  });

  await t.step("returns 400 for invalid conversationId", async () => {
    setup();
    mockState.user = { id: "u1" };
    const res = await handler(
      buildRequest({
        body: { assetId: "abc", conversationId: "not-a-uuid" },
        authHeader: "Bearer ok",
      }),
    );
    assertEquals(res.status, 400);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Participation check
  // -------------------------------------------------------------------------

  await t.step("returns 403 when user is not a participant", async () => {
    setup();
    mockState.user = { id: "u1" };
    mockState.queryResults.set("conversation_participants", {
      data: null,
      error: null,
    });
    const res = await handler(
      buildRequest({ body: VALID_BODY, authHeader: "Bearer ok" }),
    );
    const { status, body } = await parseJson(res);
    assertEquals(status, 403);
    assertEquals(body.error, "Not a participant in this conversation");
    teardown();
  });

  // -------------------------------------------------------------------------
  // Cloudflare config
  // -------------------------------------------------------------------------

  await t.step("returns 502 when CLOUDFLARE_ACCOUNT_ID missing", async () => {
    const { CLOUDFLARE_ACCOUNT_ID: _, ...envWithout } = STANDARD_ENV;
    setup();
    restoreEnv?.();
    restoreEnv = mockEnv(envWithout);

    mockState.user = { id: "u1" };
    mockState.queryResults.set("conversation_participants", {
      data: { id: "p1" },
      error: null,
    });
    const res = await handler(
      buildRequest({ body: VALID_BODY, authHeader: "Bearer ok" }),
    );
    assertEquals(res.status, 502);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  await t.step(
    "returns 200 with signedUrl and expiresAt on success",
    async () => {
      setup();
      mockState.user = { id: "u1" };
      mockState.queryResults.set("conversation_participants", {
        data: { id: "p1" },
        error: null,
      });
      mockState.rpcResults.set("get_secret", {
        data: "cf-api-token",
        error: null,
      });
      restoreFetch?.();
      restoreFetch = mockFetch(async () =>
        new Response(
          JSON.stringify({ result: { token: "signed-tok-xyz" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      );

      const res = await handler(
        buildRequest({ body: VALID_BODY, authHeader: "Bearer ok" }),
      );
      const { status, body } = await parseJson(res);
      assertEquals(status, 200);
      assertEquals(typeof body.signedUrl, "string");
      assertEquals(
        (body.signedUrl as string).includes("signed-tok-xyz"),
        true,
      );
      assertEquals(typeof body.expiresAt, "string");
      teardown();
    },
  );
});
