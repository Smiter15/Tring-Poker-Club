# Results entry

Implemented 10 September 2026. Database migration and private password/build-hook configuration are installed in Supabase. The website source must be deployed before the public site gains the new page and database-backed season charts.

## Weekly use

1. Open **Manage results** in the footer (`/add/game`) and enter the shared club password.
2. Enter your name, date, season and game number. Season 7 and the next available game number are suggested using fresh database data.
3. Select everyone who played. Enter knockouts in chronological order, starting with the first player out. The remaining player is the winner.
4. Review the final table, points and knockouts, then save.
5. The save updates the game, results, knockouts and season standings together. It requests a Netlify rebuild after the database transaction commits.

The scoring is 100, 80, 65, 55, 50, 45, 40, 35 for places 1–8; every subsequent place earns zero. At least two registered players are required. Season ties share a rank; there is no tie-break rule.

## Correcting mistakes

Open **Saved games**, then **Edit**. Correct the details and review before saving. **History** records every version, time and the entered recorder name. This is a descriptive name, not a verified individual account.

**Undo latest change** previews the previous version before confirmation. Undoing the original entry removes that game from public results and recalculates standings. The complete removed version remains in private history, and **Restore game** restores it. Undo applies to the latest change for that game, not an arbitrary historic version. Another user's newer change causes a conflict message rather than overwriting their work.

Drafts survive refresh on the same device. Save or discard a draft before editing a different game. After an interrupted request, **Retry previous request** reuses the same request ID so the game cannot be entered twice or an undo repeated. Keep the same browser until that request is resolved.

## Website updates

**Rebuild requested** confirms that Netlify accepted the hook; it does not confirm that deployment finished. Public pages update when the build completes. If the request fails, use **Retry website update** without saving the game again. A build failure after hook acceptance must be checked in Netlify.

Deploy this source before recording a real game through the new page: the existing deployed source may still read CSVs and has the old entry form. The new source needs only the existing public Supabase URL and anon key; the build hook is now held privately in the database and must not be added to client code.

## Database implementation and maintenance

- `supabase/migrations/20260910_results_admin.sql` installs the schema and functions and activates Season 7. It is already installed on the club project; do not run it again there. It creates tables and is intended as a one-time migration.
- `supabase/migrations/20260910_lockdown_results_writes.sql` closes direct table-write access left by the old form and asserts that browser roles have no write privileges. It is also installed.
- `club_private` stores password hash, build hook, hashed session tokens, complete before/after history, latest revisions, idempotency receipts and rebuild status. Browser roles cannot access this schema or its helper functions.
- `public.club_admin_login` issues a random 12-hour session token. Passwords use bcrypt. Login attempts are limited to ten per minute across the club.
- `public.club_admin_action` verifies the session for every action. The database validates all players and knockouts and independently computes points. Public table reads remain governed by existing RLS policies. Direct browser INSERT/UPDATE/DELETE privileges are revoked, including the old form’s anonymous insert access.
- Writes are serialized with a transaction advisory lock; edits and undo require the current revision. Game identifiers use database sequences, so gaps are expected, including after rolled-back tests.
- Season 1–6 records are archived from this editor. Historical corrections need an explicit database migration. The historical data audit is documented separately.
- Future seasons must first be created in `public.seasons` with their season number as ID; this page supports existing seasons numbered 7 and above.
- New players must first be added to `public.players`; player registration is outside this results-entry page.
- To change the shared password, update `club_private.settings.password_hash` as database owner with `extensions.crypt(new_password, extensions.gen_salt('bf',12))`, and delete private sessions to lock everyone out. Configure the Netlify build hook in `club_private.settings.build_hook`. Never commit either secret.

## Verification

- `node --test scripts/game-entry.test.mjs scripts/season-progress.test.mjs`: eight scoring, validation and chart tests passed.
- `supabase/tests/results_admin.sql`: executed successfully in a transaction rolled back on the live database. Covers login/logout, permissions, ten attendees and zero-point finishes, create/edit, duplicate submission, request fingerprint, conflicting edits, undo/removal/restoration, audit history, recalculated totals, shared ranks and rebuild retries.
- `supabase/tests/rebuilds.sql`: executed successfully with simulated hook responses inside a rolled-back transaction. Covers queued, accepted and failed hook requests. No test HTTP request was sent.
- Browser: wrong password, unlock, date edit, attendees, eligible knockout players, final review, refresh/draft restoration and mobile layout checked. Browser test entries were not saved to the live database.
- Static build generated 147 pages, including the empty Season 7 pages. Astro check passed with zero errors, warnings or hints.
- After tests, live counts remained 89 games, 1,014 game results, 122 season standings, and zero new admin game changes.
