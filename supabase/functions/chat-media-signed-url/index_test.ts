import { assertEquals } from "jsr:@std/assert";
import { mockState, resetMockState } from "../_test-utils/mock-supabase.ts";
import {
  buildRequest,
  mockEnv,
  parseJson,
  STANDARD_ENV,
} from "../_test-utils/helpers.ts";
import { handler, importPemKey, signStreamToken } from "./index.ts";

// ---------------------------------------------------------------------------
// Test RSA key pair (2048-bit, generated for testing only)
// ---------------------------------------------------------------------------

const TEST_SIGNING_KEY_ID = "test-key-id-abc123";

// A valid PKCS8 PEM private key for RS256 signing in tests.
// Generated via: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048
const TEST_SIGNING_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCwIpNaRxYD+/6k
bA7ZdQm7OEUR3Fjf27vuWSiyTFtUW0/UoFrn9Cfh1w5iVTSIVUNhNoOJhGHWQuK2
bFy4K76Zm4M1yoNq7gl90OTeZ29R4Po8JOCqD0MCcani4y0DoEj+AtabVSreSg21
bU7hm0u/hXky9edJUgL24PWUYHbvdNUUmijq8Sg5GTSJnTXMQz0qWu5Psp0BQqSg
FMkD2xQ3egM1XKTbjcrdvNnA2MNr1lA+yCpwUA/oYYtOVCBve10ivbHTg1qIwj7f
1pLDcgNdgGEWKPDavnuUMfhB0fpdiOoW9w9YbpEN98bFJd2keDaebyb7qpr6dwaY
lsw9hUFfAgMBAAECggEAVnXahF3Rukn4YWjjzy4rBTqleRODkvvPoDwnBIMD8ABU
yyieBy+sZimFl5KA042bIjy6zAXuatlxZaAC0asziD605XJQGWzYvuiMeHooxHYe
D+kAWapdN/VosgXXQmjre7kT9LMVdIHAgfcy2f876ztPV8sq6ix2ZQ7friK+L2OG
967F/hmX0iXrtue3R8OJ29MnHmmJn1z8/Z3mY3p2tvonBFFg/8oo96PyT/ZkH2Xw
C6dTMovfr+XH5HjNJWyC7TTXDpizC3Ea614VK0qHOSfnfascyVS4YuvLCVE7Xg98
8T0HE02OMmxl4vNdxYov37WnW540vjOwrOLnP+GL8QKBgQDj+B+2Ff38zvmbstQC
/slZ6DgWNK/jcNE3/BKOedHdYqrxITqka7Dxt6SLHNqEGt7BE4f1vd0e/cS3Vdtt
6dqx5iSpF30XNe0wloPZQK+1X854zv35/em/vnuC4yK2eTqDLSWZA9dGcgAXEX/Q
I7ZqLMPwfxP3mQGlTX+aJGHvUQKBgQDFytjqc5V/UEd5QbVzP1fGyHz47x+MCR1/
KUBr12u9W+Xtys7vC1ZHeHkEK4ycs013SpvXwNkC6RCrIVMCW9pZyvwo7GibGkzd
1jdn6h9okWMS/msqpaw+ZOBiKMomAz8ekaoFmLDrPNFXFUhMap+PzMqDdl11wKbf
kmbq94fZrwKBgGxDpiu/fgPV98ztvKo/fjhohFpnYzDMn0/LMrTfPb+54Bzr/wGe
80WYRVibt1sNt8RSFjuqk5zoP8ghyjgE24upFLgJI6smPSLaGHvQsKGeglv1UcCr
yZr6R4X9gLrQD+3EPxrQLCiUc16BPQYIL9V0tQk+EKmBzLpId9UoeipBAoGAfd3l
BeWB6B/FLAPFnU5c5FHnPV6mO639SFOO/FF87WaSvi0GXJZhVF/02tN/yqRLkrM2
0yiUsMZx5gTx1xlurR+AMeandrRY3/6XCZiyXg/O9WJT/jKplpcJN03vvhroyuI1
SRRu2XO9X+ZaOM7NNWxEHz5uoSV0y+dVeQcGO18CgYEArus1RmAsPjJNipLgXJSF
HcR+tG7n2V7C1kL3TINWhQ0Q6IvY422soPlu3eIr+/1qgmnRRAKJjIbut4IUP3cF
rGSVqeQ2n9TP+WK9KVyhEJz0btU91P7MGoX97zzVNolSTMMaRntULzKE98AXPnC8
HCAlC3LaDFszBWGylqcrly0=
-----END PRIVATE KEY-----`;

// ---------------------------------------------------------------------------
// Helper: set up vault mocks for CF secrets
// ---------------------------------------------------------------------------

function mockVaultSecrets(overrides?: Partial<Record<string, string | null>>) {
  const defaults: Record<string, string> = {
    CF_SIGNING_KEY_PEM: TEST_SIGNING_KEY_PEM,
    CF_SIGNING_KEY_ID: TEST_SIGNING_KEY_ID,
    CF_CUSTOMER_SUBDOMAIN: "test-subdomain",
  };
  const merged = { ...defaults, ...overrides };
  for (const [name, value] of Object.entries(merged)) {
    mockState.rpcResults.set(`get_secret:${name}`, {
      data: value,
      error: null,
    });
  }
}

// ---------------------------------------------------------------------------
// signStreamToken (unit)
// ---------------------------------------------------------------------------

Deno.test("signStreamToken", async (t) => {
  await t.step("generates a valid 3-part JWT", async () => {
    const privateKey = await importPemKey(TEST_SIGNING_KEY_PEM);
    const token = await signStreamToken(
      "video-uid-123",
      TEST_SIGNING_KEY_ID,
      privateKey,
      3600,
    );
    const parts = token.split(".");
    assertEquals(parts.length, 3);

    // Decode header
    const header = JSON.parse(atob(parts[0]!.replace(/-/g, "+").replace(/_/g, "/")));
    assertEquals(header.alg, "RS256");
    assertEquals(header.kid, TEST_SIGNING_KEY_ID);

    // Decode payload
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    assertEquals(payload.sub, "video-uid-123");
    assertEquals(payload.kid, TEST_SIGNING_KEY_ID);
    assertEquals(typeof payload.exp, "number");
  });
});

// ---------------------------------------------------------------------------
// chat-media-signed-url handler
// ---------------------------------------------------------------------------

Deno.test("chat-media-signed-url", async (t) => {
  let restoreEnv: (() => void) | undefined;

  const VALID_BODY = {
    assetId: "cf-vid-abc",
    conversationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  };

  function setup(envOverrides?: Record<string, string>) {
    resetMockState();
    restoreEnv = mockEnv({ ...STANDARD_ENV, ...envOverrides });
  }

  function teardown() {
    restoreEnv?.();
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
  // Vault config errors
  // -------------------------------------------------------------------------

  await t.step("returns 502 when vault secrets are missing", async () => {
    setup();
    mockState.user = { id: "u1" };
    mockState.queryResults.set("conversation_participants", {
      data: { id: "p1" },
      error: null,
    });
    // No vault mocks set -- rpc returns { data: null, error: null }
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
      mockVaultSecrets();

      const res = await handler(
        buildRequest({ body: VALID_BODY, authHeader: "Bearer ok" }),
      );
      const { status, body } = await parseJson(res);
      assertEquals(status, 200);
      assertEquals(typeof body.signedUrl, "string");
      assertEquals(
        (body.signedUrl as string).startsWith(
          "https://customer-test-subdomain.cloudflarestream.com/",
        ),
        true,
      );
      assertEquals(
        (body.signedUrl as string).endsWith("/manifest/video.m3u8"),
        true,
      );
      assertEquals(typeof body.expiresAt, "string");
      teardown();
    },
  );
});
