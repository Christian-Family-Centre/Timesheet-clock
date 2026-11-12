# Timesheet-clock

The phone page CFC cleaners and event casuals use to clock on and off.

- `index.html` is the whole page. It holds no staff data and no secrets.
- Each person opens their own personal link (the part after `#` is their key) and sets a 6-digit PIN on first use.
- The page talks to one PIN-checked database function (`clock`) in the `cfc-timesheets` Supabase project. It cannot read any table directly.
- Links are issued and reset by an administrator with the `issue_clock_link` database function. Reissuing a link clears that person's PIN.
- Database changes are kept in the Supabase project's migration history (`clock_page_function`).

Hosted with GitHub Pages from the `main` branch.
