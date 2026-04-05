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

// ---------------------------------------------------------------------------
// RSA JWT signing utilities for Cloudflare Stream signed URLs
// ---------------------------------------------------------------------------

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function importPemKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signStreamToken(
  videoId: string,
  keyId: string,
  privateKey: CryptoKey,
  ttlSeconds: number,
): Promise<string> {
  const header = { alg: "RS256", kid: keyId };
  const payload = {
    sub: videoId,
    kid: keyId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(signingInput),
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${signatureB64}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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
    // 4. Read Cloudflare signing credentials from Supabase Vault
    // -----------------------------------------------------------------------
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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const [signingKeyResult, keyIdResult, subdomainResult] = await Promise.all([
      supabaseAdmin.rpc("get_secret", { secret_name: "CF_SIGNING_KEY_PEM" }),
      supabaseAdmin.rpc("get_secret", { secret_name: "CF_SIGNING_KEY_ID" }),
      supabaseAdmin.rpc("get_secret", { secret_name: "CF_CUSTOMER_SUBDOMAIN" }),
    ]);

    if (signingKeyResult.error || keyIdResult.error || subdomainResult.error) {
      console.error(
        "Vault error:",
        signingKeyResult.error ?? keyIdResult.error ?? subdomainResult.error,
      );
      return new Response(
        JSON.stringify({ error: "Failed to retrieve Cloudflare credentials" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const signingKeyPem = signingKeyResult.data as string | null;
    const signingKeyId = keyIdResult.data as string | null;
    const customerSubdomain = subdomainResult.data as string | null;
    if (!signingKeyPem || !signingKeyId || !customerSubdomain) {
      return new Response(
        JSON.stringify({ error: "Cloudflare credentials not found in vault" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 5. Sign a short-lived JWT for Cloudflare Stream playback (1-hour TTL)
    // -----------------------------------------------------------------------
    const ttlSeconds = 3600;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    let token: string;
    try {
      const privateKey = await importPemKey(signingKeyPem);
      token = await signStreamToken(assetId, signingKeyId, privateKey, ttlSeconds);
    } catch (signErr) {
      console.error("JWT signing error:", signErr);
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build the signed playback URL
    const signedUrl = `https://customer-${customerSubdomain}.cloudflarestream.com/${token}/manifest/video.m3u8`;

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
