# Timesheet-clock

The phone page CFC cleaners and event casuals use to clock on and off.

- `index.html` is the whole page. It holds no staff data and no secrets.
- Each person opens their own personal link (the part after `#` is their key) and sets a 6-digit PIN on first use.
- The page talks to one PIN-checked database function (`clock`) in the `cfc-timesheets` Supabase project. It cannot read any table directly.
- Links are issued and reset by an administrator with the `issue_clock_link` database function. Reissuing a link clears that person's PIN.
- Database changes are kept in the Supabase project's migration history (`clock_page_function`).

## Roster

- After PIN entry the clock page shows **Your roster**: every upcoming event the person is crewed on, with date, time (or "time TBC"), role and their reply. They tap **Accept** or **Can't make it** (with an optional reason). This talks to the PIN-checked `clock_roster` function.
- Admins see each crew member's reply on the admin page and can set or change event start/finish times there (`clock_admin_roster`, action `set_times`). Times can also be entered when adding an event.
- Setting or changing times tells everyone who hasn't declined. A reply (accept or decline) notifies the admins.

## Reminders

- The page is installable (`manifest.json`, icons) and registers `sw.js`, which shows push notifications. On iPhone, staff must Add to Home Screen first.
- After PIN entry the page shows a Reminders card. It talks to the PIN-checked `clock_notify` function to save the phone's push subscription and the email on/off setting.
- Reminders are queued in `public.notifications` by triggers (event crew added, shift assigned) and by `queue_reminders()` (2 h before a shift, 6pm the day before an event, 10 min late to clock on, 30 min past shift end or 10 h on, shifts needing a code → admins).
- `pg_cron` runs `run_notifications()` every minute, which calls the `notify-send` Edge Function (`supabase/functions/notify-send`). It sends web push and email (Gmail SMTP, needs the `GMAIL_APP_PASSWORD` function secret).
- VAPID keys and sender settings are in Supabase Vault, never in this repo.

Hosted with GitHub Pages from the `main` branch.
