import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24";

const uploadUrlRequestSchema = z.object({
  maxDurationSeconds: z.number().int().min(1).max(60),
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing required environment configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const parsed = uploadUrlRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "maxDurationSeconds is required and must be an integer between 1 and 60",
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { maxDurationSeconds } = parsed.data;

    // -----------------------------------------------------------------------
    // 3. Read Cloudflare credentials
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

    // Read API token from Supabase Vault
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("Missing required environment configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
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

    // The vault RPC returns the decrypted secret value
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
    // 4. Request TUS upload URL from Cloudflare Stream
    // -----------------------------------------------------------------------
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs: true,
        }),
      },
    );

    if (!cfResponse.ok) {
      const cfBody = await cfResponse.text();
      console.error(
        `Cloudflare Stream API error: ${cfResponse.status} ${cfBody}`,
      );
      return new Response(
        JSON.stringify({ error: "Cloudflare Stream API error" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const cfData = await cfResponse.json();
    // Cloudflare returns the TUS URL in the response header "location" for
    // direct creator uploads, and the stream UID in the result.
    const tusUrl = cfResponse.headers.get("location");
    const assetId = cfData.result?.uid;

    if (!tusUrl || !assetId) {
      console.error("Unexpected Cloudflare response:", JSON.stringify(cfData));
      return new Response(
        JSON.stringify({
          error: "Unexpected response from Cloudflare Stream",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 5. Return TUS URL and asset ID
    // -----------------------------------------------------------------------
    return new Response(JSON.stringify({ tusUrl, assetId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("chat-media-upload-url error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
