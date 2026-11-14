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

## Chasing and covering

- Anyone who hasn't replied 48 hours after being rostered gets one "Can you make it?" nudge (9am–8pm). Admins are told about anyone still not replied when the event is 1–3 days away.
- When someone declines, their spot becomes an open shift (`open_shifts`) offered to everyone with a current rate for that role who isn't already on the event. It shows under **Shifts up for grabs** on the clock page; first to tap **I'll take it** gets it, with the same times. Admins are told who picked it up, or that nobody is set up for the role.
- Someone who declined can change their mind until their spot is taken.

## Calendar

- Each person has a private calendar token (`staff.calendar_token`, separate from their clock link). The `roster-ics` Edge Function serves their upcoming shifts as an `.ics` feed (`?t=token`) or a single shift (`&id=crew id`). Declined shifts are left out; pending ones show as tentative.
- The roster section offers "Add all my shifts to my calendar" (a `webcal:` subscription that updates itself), a copyable link for Google Calendar, and "Add this one to my calendar" on each shift.

## Reminders

- The page is installable (`manifest.json`, icons) and registers `sw.js`, which shows push notifications. On iPhone, staff must Add to Home Screen first.
- After PIN entry the page shows a Reminders card. It talks to the PIN-checked `clock_notify` function to save the phone's push subscription and the email on/off setting.
- Reminders are queued in `public.notifications` by triggers (event crew added, shift assigned) and by `queue_reminders()` (2 h before a shift, 6pm the day before an event, 10 min late to clock on, 30 min past shift end or 10 h on, shifts needing a code → admins).
- `pg_cron` runs `run_notifications()` every minute, which calls the `notify-send` Edge Function (`supabase/functions/notify-send`). It sends web push and email (Gmail SMTP, needs the `GMAIL_APP_PASSWORD` function secret).
- VAPID keys and sender settings are in Supabase Vault, never in this repo.

Hosted with GitHub Pages from the `main` branch.
