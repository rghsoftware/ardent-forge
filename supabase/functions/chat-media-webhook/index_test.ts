import { assertEquals } from "jsr:@std/assert";
import { mockState, resetMockState } from "../_test-utils/mock-supabase.ts";
import {
  buildRequest,
  mockEnv,
  parseJson,
  STANDARD_ENV,
} from "../_test-utils/helpers.ts";
import { handler, verifyWebhookSignature } from "./index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_ENV: Record<string, string> = {
  ...STANDARD_ENV,
  CLOUDFLARE_WEBHOOK_SECRET: "test-webhook-secret",
};

async function computeSignature(
  body: string,
  secret: string,
  timestamp: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildWebhookRequest(
  body: string,
  signatureHeader?: string,
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signatureHeader) headers["Webhook-Signature"] = signatureHeader;

  return new Request("http://localhost/test", {
    method: "POST",
    headers,
    body,
  });
}

// ---------------------------------------------------------------------------
// verifyWebhookSignature (unit)
// ---------------------------------------------------------------------------

Deno.test("verifyWebhookSignature", async (t) => {
  await t.step("returns true for valid signature", async () => {
    const secret = "my-secret";
    const body = '{"uid":"abc"}';
    const ts = "1700000000";
    const sig = await computeSignature(body, secret, ts);
    const result = await verifyWebhookSignature(
      body,
      `time=${ts},sig1=${sig}`,
      secret,
    );
    assertEquals(result, true);
  });

  await t.step("returns false for wrong signature", async () => {
    const result = await verifyWebhookSignature(
      '{"uid":"abc"}',
      "time=123,sig1=deadbeef",
      "secret",
    );
    assertEquals(result, false);
  });

  await t.step("returns false when header is null", async () => {
    const result = await verifyWebhookSignature("body", null, "secret");
    assertEquals(result, false);
  });

  await t.step("returns false when header has no sig1", async () => {
    const result = await verifyWebhookSignature(
      "body",
      "time=123",
      "secret",
    );
    assertEquals(result, false);
  });
});

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------

Deno.test("chat-media-webhook handler", async (t) => {
  let restoreEnv: (() => void) | undefined;

  function setup(envOverrides?: Record<string, string>) {
    resetMockState();
    restoreEnv = mockEnv({ ...WEBHOOK_ENV, ...envOverrides });
  }

  function teardown() {
    restoreEnv?.();
  }

  // -------------------------------------------------------------------------
  // Method check
  // -------------------------------------------------------------------------

  await t.step("returns 405 for non-POST methods", async () => {
    setup();
    const res = await handler(
      new Request("http://localhost/test", { method: "GET" }),
    );
    assertEquals(res.status, 405);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Webhook secret
  // -------------------------------------------------------------------------

  await t.step("returns 500 when webhook secret not configured", async () => {
    const { CLOUDFLARE_WEBHOOK_SECRET: _, ...envWithout } = WEBHOOK_ENV;
    setup();
    restoreEnv?.();
    restoreEnv = mockEnv(envWithout);

    const res = await handler(
      buildWebhookRequest('{"uid":"abc"}'),
    );
    assertEquals(res.status, 500);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Signature validation
  // -------------------------------------------------------------------------

  await t.step("returns 403 for invalid signature", async () => {
    setup();
    const res = await handler(
      buildWebhookRequest('{"uid":"abc"}', "time=123,sig1=bad"),
    );
    assertEquals(res.status, 403);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Event filtering
  // -------------------------------------------------------------------------

  await t.step("returns 204 for event without uid", async () => {
    setup();
    const body = JSON.stringify({ something: "else" });
    const ts = "1700000000";
    const sig = await computeSignature(body, "test-webhook-secret", ts);
    const res = await handler(
      buildWebhookRequest(body, `time=${ts},sig1=${sig}`),
    );
    assertEquals(res.status, 204);
    teardown();
  });

  await t.step("returns 204 for intermediate event", async () => {
    setup();
    const body = JSON.stringify({
      uid: "vid-123",
      readyToStream: false,
      status: { state: "inprogress" },
    });
    const ts = "1700000000";
    const sig = await computeSignature(body, "test-webhook-secret", ts);
    const res = await handler(
      buildWebhookRequest(body, `time=${ts},sig1=${sig}`),
    );
    assertEquals(res.status, 204);
    teardown();
  });

  // -------------------------------------------------------------------------
  // Ready event
  // -------------------------------------------------------------------------

  await t.step("updates attachment to ready on readyToStream", async () => {
    setup();
    mockState.queryResults.set("media_attachments", {
      data: {
        id: "att-1",
        message_id: "msg-1",
        messages: { conversation_id: "conv-1" },
      },
      error: null,
    });

    const body = JSON.stringify({
      uid: "vid-123",
      readyToStream: true,
      thumbnail: "https://cf.com/thumb.jpg",
      playback: { hls: "https://cf.com/vid.m3u8" },
    });
    const ts = "1700000000";
    const sig = await computeSignature(body, "test-webhook-secret", ts);
    const res = await handler(
      buildWebhookRequest(body, `time=${ts},sig1=${sig}`),
    );
    const { status, body: resBody } = await parseJson(res);
    assertEquals(status, 200);
    assertEquals((resBody as Record<string, boolean>).ok, true);

    // Verify update payload
    const updatePayload = mockState.lastUpdatePayload.get(
      "media_attachments",
    ) as Record<string, unknown>;
    assertEquals(updatePayload.status, "ready");
    assertEquals(updatePayload.thumbnail_url, "https://cf.com/thumb.jpg");
    teardown();
  });

  // -------------------------------------------------------------------------
  // Error event
  // -------------------------------------------------------------------------

  await t.step("updates attachment to failed on error event", async () => {
    setup();
    mockState.queryResults.set("media_attachments", {
      data: {
        id: "att-1",
        message_id: "msg-1",
        messages: { conversation_id: "conv-1" },
      },
      error: null,
    });

    const body = JSON.stringify({
      uid: "vid-456",
      readyToStream: false,
      status: { state: "error", errorReasonCode: "ERR_DURATION" },
    });
    const ts = "1700000000";
    const sig = await computeSignature(body, "test-webhook-secret", ts);
    const res = await handler(
      buildWebhookRequest(body, `time=${ts},sig1=${sig}`),
    );
    const { status } = await parseJson(res);
    assertEquals(status, 200);

    const updatePayload = mockState.lastUpdatePayload.get(
      "media_attachments",
    ) as Record<string, unknown>;
    assertEquals(updatePayload.status, "failed");
    teardown();
  });

  // -------------------------------------------------------------------------
  // DB errors
  // -------------------------------------------------------------------------

  await t.step("returns 500 on DB fetch error", async () => {
    setup();
    mockState.queryResults.set("media_attachments", {
      data: null,
      error: { message: "connection refused" },
    });

    const body = JSON.stringify({
      uid: "vid-789",
      readyToStream: true,
    });
    const ts = "1700000000";
    const sig = await computeSignature(body, "test-webhook-secret", ts);
    const res = await handler(
      buildWebhookRequest(body, `time=${ts},sig1=${sig}`),
    );
    assertEquals(res.status, 500);
    teardown();
  });

  await t.step("returns 204 when no matching attachment found", async () => {
    setup();
    // queryResults not set for media_attachments, so data = null, error = null
    const body = JSON.stringify({
      uid: "vid-unknown",
      readyToStream: true,
    });
    const ts = "1700000000";
    const sig = await computeSignature(body, "test-webhook-secret", ts);
    const res = await handler(
      buildWebhookRequest(body, `time=${ts},sig1=${sig}`),
    );
    assertEquals(res.status, 204);
    teardown();
  });
});
