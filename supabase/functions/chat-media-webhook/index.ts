import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify Cloudflare webhook signature.
 *
 * Cloudflare Stream sends a webhook signing secret in the
 * `Webhook-Signature` header. The value format is:
 *   time=<unix_ts>,sig1=<hex_hmac_sha256>
 *
 * We verify by computing HMAC-SHA256(secret, <timestamp>.<body>) and
 * comparing against the provided signature.
 */
async function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  // Parse header: "time=1234567890,sig1=abcdef..."
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key && value) parts[key.trim()] = value.trim();
  }

  const timestamp = parts["time"];
  const signature = parts["sig1"];
  if (!timestamp || !signature) return false;

  // Compute expected signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = `${timestamp}.${body}`;
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedHex === signature;
}

Deno.serve(async (req: Request) => {
  // Webhooks are POST only -- no CORS needed (server-to-server)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Validate webhook signature
    // -----------------------------------------------------------------------
    const webhookSecret = Deno.env.get("CLOUDFLARE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("CLOUDFLARE_WEBHOOK_SECRET not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get("Webhook-Signature");

    const valid = await verifyWebhookSignature(
      rawBody,
      signatureHeader,
      webhookSecret,
    );
    if (!valid) {
      return new Response("Invalid webhook signature", { status: 403 });
    }

    // -----------------------------------------------------------------------
    // 2. Parse event
    // -----------------------------------------------------------------------
    const event = JSON.parse(rawBody);

    // Cloudflare Stream webhook events have different shapes. The key fields:
    // - event.uid: the Stream video UID (matches provider_asset_id)
    // - event.status: { state: "ready" | "error", ... }
    // - event.thumbnail: thumbnail URL
    // - event.playback: { hls: string, dash: string }
    // - event.readyToStream: boolean

    const streamUid: string | undefined = event.uid;
    if (!streamUid) {
      // Not a Stream event we care about
      return new Response(null, { status: 204 });
    }

    // Determine event type from the payload
    const isReady = event.readyToStream === true;
    const isFailed =
      event.status?.state === "error" || event.status?.errorReasonCode;

    if (!isReady && !isFailed) {
      // Unrecognized or intermediate event -- acknowledge but skip
      return new Response(null, { status: 204 });
    }

    // -----------------------------------------------------------------------
    // 3. Update media_attachments and broadcast
    // -----------------------------------------------------------------------
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the media attachment by provider_asset_id
    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from("media_attachments")
      .select("id, message_id, messages!inner(conversation_id)")
      .eq("provider_asset_id", streamUid)
      .eq("provider", "cloudflare_stream")
      .maybeSingle();

    if (fetchError) {
      console.error("DB fetch error:", fetchError);
      return new Response("Database error", { status: 500 });
    }

    if (!attachment) {
      console.warn(`No media_attachment found for Stream UID: ${streamUid}`);
      return new Response(null, { status: 204 });
    }

    const messageId = attachment.message_id;
    const attachmentId = attachment.id;
    // PostgREST !inner join returns a single object (not array) for 1:1
    const conversationId = (
      attachment.messages as unknown as { conversation_id: string }
    ).conversation_id;

    if (isReady) {
      // Build URLs from the Cloudflare response
      const thumbnailUrl: string | null =
        event.thumbnail || `https://customer-${event.uid}.cloudflarestream.com/${streamUid}/thumbnails/thumbnail.jpg`;
      const playbackUrl: string | null =
        event.playback?.hls || event.preview || null;

      const { error: updateError } = await supabaseAdmin
        .from("media_attachments")
        .update({
          status: "ready",
          thumbnail_url: thumbnailUrl,
          playback_url: playbackUrl,
        })
        .eq("id", attachmentId);

      if (updateError) {
        console.error("DB update error:", updateError);
        return new Response("Database update error", { status: 500 });
      }

      // Broadcast media_status event to the conversation channel
      await supabaseAdmin.channel(`chat:${conversationId}`).send({
        type: "broadcast",
        event: "media_status",
        payload: {
          message_id: messageId,
          attachment_id: attachmentId,
          status: "ready",
          thumbnail_url: thumbnailUrl,
          playback_url: playbackUrl,
        },
      });
    } else if (isFailed) {
      const { error: updateError } = await supabaseAdmin
        .from("media_attachments")
        .update({ status: "failed" })
        .eq("id", attachmentId);

      if (updateError) {
        console.error("DB update error:", updateError);
        return new Response("Database update error", { status: 500 });
      }

      // Broadcast failure status
      await supabaseAdmin.channel(`chat:${conversationId}`).send({
        type: "broadcast",
        event: "media_status",
        payload: {
          message_id: messageId,
          attachment_id: attachmentId,
          status: "failed",
          thumbnail_url: null,
          playback_url: null,
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat-media-webhook error:", err);
    return new Response("Internal server error", { status: 500 });
  }
});
