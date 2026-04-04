import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      console.error("Query failed:", queryError);
      return new Response(
        JSON.stringify({ error: "Query failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sessions = (sessionRows ?? []) as ScheduledSession[];

    // -----------------------------------------------------------------------
    // 3. Build the IdleSnapshot payload
    // -----------------------------------------------------------------------
    const nextSession =
      sessions.length > 0
        ? {
            display_name: sessions[0]!.display_name,
            session_name: sessions[0]!.session_name,
          }
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
      console.error(
        "Broadcast failed:",
        broadcastResponse.status,
        await broadcastResponse.text(),
      );
      return new Response(
        JSON.stringify({ error: "Broadcast failed" }),
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
