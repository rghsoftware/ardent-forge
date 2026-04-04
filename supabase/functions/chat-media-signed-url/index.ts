import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24";

const signedUrlRequestSchema = z.object({
  assetId: z.string().min(1),
  conversationId: z.string().uuid(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Authenticate caller
    // -----------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    // 2. Validate request body
    // -----------------------------------------------------------------------
    const body = await req.json();
    const parsed = signedUrlRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "assetId (string) and conversationId (uuid) are required",
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { assetId, conversationId } = parsed.data;

    // -----------------------------------------------------------------------
    // 3. Verify conversation participation
    // -----------------------------------------------------------------------
    const { data: participant, error: pError } = await supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle();

    if (pError) {
      console.error("Participation check error:", pError);
      return new Response(
        JSON.stringify({ error: "Failed to verify conversation access" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!participant) {
      return new Response(
        JSON.stringify({ error: "Not a participant in this conversation" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 4. Read Cloudflare credentials
    // -----------------------------------------------------------------------
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "Cloudflare account not configured" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: secrets, error: vaultError } = await supabaseAdmin.rpc(
      "get_secret",
      { secret_name: "cloudflare_stream_api_token" },
    );
    if (vaultError || !secrets) {
      console.error("Vault error:", vaultError);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve Cloudflare credentials" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiToken =
      typeof secrets === "string" ? secrets : secrets?.decrypted_secret;
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Cloudflare API token not found in vault" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 5. Request signed URL from Cloudflare Stream (1-hour TTL)
    // -----------------------------------------------------------------------
    const ttlSeconds = 3600;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${assetId}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Token restrictions
          exp: Math.floor(Date.now() / 1000) + ttlSeconds,
          accessRules: [
            // Allow any IP (can be restricted later)
            { type: "any", action: "allow" },
          ],
        }),
      },
    );

    if (!cfResponse.ok) {
      const cfBody = await cfResponse.text();
      console.error(
        `Cloudflare token API error: ${cfResponse.status} ${cfBody}`,
      );
      return new Response(
        JSON.stringify({ error: "Cloudflare token API error" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const cfData = await cfResponse.json();
    const token = cfData.result?.token;

    if (!token) {
      console.error("Unexpected Cloudflare token response:", JSON.stringify(cfData));
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build the signed playback URL
    const signedUrl = `https://customer-${accountId}.cloudflarestream.com/${token}/manifest/video.m3u8`;

    // -----------------------------------------------------------------------
    // 6. Return signed URL
    // -----------------------------------------------------------------------
    return new Response(JSON.stringify({ signedUrl, expiresAt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat-media-signed-url error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
