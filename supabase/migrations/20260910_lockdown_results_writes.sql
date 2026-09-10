-- The old entry form allowed anonymous table inserts. All browser writes now
-- go through the authenticated, transaction-safe admin RPC functions.
BEGIN;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.games, public.game_results, public.game_knockouts,
     public.season_results, public.seasons, public.players
  FROM PUBLIC, anon, authenticated;
DO $$
DECLARE role_name text; table_name text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH table_name IN ARRAY ARRAY['games','game_results','game_knockouts','season_results','seasons','players'] LOOP
   ASSERT NOT has_table_privilege(role_name,'public.'||table_name,'INSERT, UPDATE, DELETE, TRUNCATE'), 'Browser role still has direct write access';
  END LOOP;
 END LOOP;
END $$;
COMMIT;
