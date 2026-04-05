import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: wildcard origin is acceptable -- this function is only invoked by
// Supabase cron (verify_jwt = false), not by browsers directly.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScheduledSession {
  display_name: string;
  session_name: string;
  session_type: string;
  day_label: string;
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
    // 1. Validate environment configuration
    // -----------------------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing required environment configuration");
      return new Response(
        JSON.stringify({ error: "Missing configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // -----------------------------------------------------------------------
    // 2. Query today's remaining scheduled sessions via RPC
    // -----------------------------------------------------------------------
    const { data: sessionRows, error: queryError } = await supabase.rpc(
      "get_display_idle_sessions",
    );

    if (queryError) {
      console.error("RPC get_display_idle_sessions failed:", queryError.message, queryError.code);
      return new Response(
        JSON.stringify({ error: "Query failed", code: queryError.code }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const rows = sessionRows ?? [];
    const sessions: ScheduledSession[] = rows.filter(
      (r: Record<string, unknown>) =>
        typeof r.display_name === 'string' &&
        typeof r.session_name === 'string' &&
        typeof r.session_type === 'string' &&
        typeof r.day_label === 'string',
    );

    // -----------------------------------------------------------------------
    // 3. Build the IdleSnapshot payload
    // -----------------------------------------------------------------------
    const first = sessions[0];
    const nextSession = first
      ? { display_name: first.display_name, session_name: first.session_name }
      : null;

    const idleSnapshotPayload = {
      server_time: new Date().toISOString(),
      scheduled_sessions: sessions,
      next_session: nextSession,
    };

    // -----------------------------------------------------------------------
    // 4. Broadcast via Supabase Realtime HTTP API
    // -----------------------------------------------------------------------
    const broadcastUrl = `${supabaseUrl}/realtime/v1/api/broadcast`;
    const broadcastResponse = await fetch(broadcastUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: "realtime:display",
            event: "idle_snapshot",
            payload: idleSnapshotPayload,
          },
        ],
      }),
    });

    if (!broadcastResponse.ok) {
      const body = await broadcastResponse.text();
      console.error(
        "Realtime broadcast failed:",
        broadcastResponse.status,
        body,
      );
      return new Response(
        JSON.stringify({ error: "Broadcast failed", status: broadcastResponse.status }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 5. Return success
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        published: true,
        session_count: sessions.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("display-idle-snapshot error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
