// Sends queued reminders (public.notifications) as web push and email.
// Called every minute by pg_cron with the x-notify-secret header.
// Settings live in Supabase Vault (read through public.notify_config()).
// Email needs the GMAIL_APP_PASSWORD Edge Function secret; without it, email is skipped.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import nodemailer from "npm:nodemailer@6.9.16";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const { data: cfg, error: cfgErr } = await db.rpc("notify_config");
  if (cfgErr || !cfg) return json({ ok: false, error: "config" }, 500);
  if (req.headers.get("x-notify-secret") !== cfg.notify_secret) return json({ ok: false }, 401);

  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

  const appPassword = Deno.env.get("GMAIL_APP_PASSWORD");
  const fromAddr = String(cfg.mail_from).match(/<([^>]+)>/)?.[1] ?? cfg.mail_from;
  const mailer = appPassword
    ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: fromAddr, pass: appPassword } })
    : null;

  const { data: queue, error } = await db
    .from("notifications")
    .select("id, staff_id, kind, title, body, attempts, staff:staff_id (preferred_name, full_name, email, notify_push, notify_email, active)")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("created_at")
    .limit(40);
  if (error) return json({ ok: false, error: error.message }, 500);

  const results = [];
  for (const n of queue ?? []) {
    // deno-lint-ignore no-explicit-any
    const st: any = n.staff;
    let push = "off", email = "off";

    if (st?.active && st.notify_push) {
      const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, fail_count").eq("staff_id", n.staff_id);
      if (!subs?.length) push = "no_device";
      else {
        let ok = 0, fail = 0;
        for (const s of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: n.title, body: n.body, tag: n.kind }),
              { TTL: 60 * 60 * 6, urgency: "high" },
            );
            ok++;
            await db.from("push_subscriptions").update({ last_ok_at: new Date().toISOString(), fail_count: 0 }).eq("id", s.id);
          } catch (e) {
            fail++;
            // deno-lint-ignore no-explicit-any
            const code = (e as any)?.statusCode;
            if (code === 404 || code === 410 || s.fail_count >= 4) await db.from("push_subscriptions").delete().eq("id", s.id);
            else await db.from("push_subscriptions").update({ fail_count: s.fail_count + 1 }).eq("id", s.id);
          }
        }
        push = ok ? (fail ? `sent ${ok}, failed ${fail}` : "sent") : "failed";
      }
    }

    if (st?.active && st.notify_email) {
      if (!st.email) email = "no_email";
      else if (!mailer) email = "not_configured";
      else {
        try {
          const name = st.preferred_name || st.full_name;
          await mailer.sendMail({
            from: cfg.mail_from,
            to: st.email,
            subject: `CFC clock: ${n.title}`,
            text: `Hi ${name},\n\n${n.body}\n\nOpen the CFC clock: ${cfg.clock_url}\n(Use your personal link if it asks.)\n\nThanks,\nRyan Scholar\nOperations Manager\n\nAutomated reminder from the CFC staff clock.`,
          });
          email = "sent";
        } catch (e) {
          email = "failed: " + String((e as Error)?.message ?? e).slice(0, 200);
        }
      }
    }

    const delivered = push.startsWith("sent") || email === "sent";
    const tried = push !== "off" && push !== "no_device" || email === "sent" || email.startsWith("failed");
    const failedHard = push === "failed" || email.startsWith("failed");
    const status = delivered ? (failedHard ? "partial" : "sent") : (failedHard && n.attempts < 2 ? "pending" : (tried ? "failed" : "skipped"));

    await db.from("notifications").update({
      status, push_result: push, email_result: email, attempts: n.attempts + 1,
      sent_at: delivered ? new Date().toISOString() : null,
    }).eq("id", n.id);
    results.push({ id: n.id, status, push, email });
  }

  return json({ ok: true, processed: results.length, results });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
