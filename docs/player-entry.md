# Adding players

The `/add/player` page uses the same shared club password and browser session as `/add/game`. Enter a first name; last name, nickname, preferred display name, photo URL and bio are optional. A blank last name is stored as an empty string. Names are checked for duplicates without regard to case. The database assigns a unique profile slug and requests a Netlify rebuild after a successful save.

Apply `supabase/migrations/20261001_player_admin.sql` as the database owner before publishing the new page. It depends on the functions and private tables installed by `20260910_results_admin.sql`. The migration grants only execution of the new session-checked function to browser roles; direct writes to `players` stay revoked.

Apply `supabase/migrations/20261002_optional_player_last_name.sql` after the player admin migration, including on databases where player entry is already installed.

Player and profile pages are statically generated, so the public roster and profile update after the rebuild. The results entry player picker reads fresh context from the database when opened or refreshed.
