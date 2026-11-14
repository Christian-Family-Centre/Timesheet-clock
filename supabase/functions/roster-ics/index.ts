// Serves a person's CFC shifts as a calendar (.ics).
// GET /roster-ics?t=<calendar token>            -> all upcoming shifts (subscribe)
// GET /roster-ics?t=<calendar token>&id=<crew>  -> one shift (add once)
// The calendar token is separate from the clock link and only shows that person's roster.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const t = (url.searchParams.get("t") || "").replace(/\.ics$/, "");
  const id = url.searchParams.get("id");
  if (!/^[0-9a-f]{20,64}$/.test(t) || (id && !UUID.test(id))) return new Response("Not found", { status: 404 });

  const { data, error } = await db.rpc("roster_ics", { p_token: t, p_crew: id || null });
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(data as string, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${id ? "attachment" : "inline"}; filename="${id ? "cfc-shift" : "cfc-shifts"}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
