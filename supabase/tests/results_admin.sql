-- Run as owner in the Supabase SQL editor. All test records roll back.
-- Sequences advance, intentionally; no public test game or rebuild survives.
BEGIN;
UPDATE club_private.settings SET password_hash=extensions.crypt('test-only-password',extensions.gen_salt('bf',4)),build_hook=NULL,login_attempts=0,login_window=now();
DO $$
DECLARE token text; payload jsonb; result jsonb; again jsonb; edited jsonb; gid bigint; second_id bigint; players jsonb; kos jsonb; n integer; old_count integer;
BEGIN
  SELECT count(*) INTO old_count FROM public.games;
  ASSERT public.club_admin_login('wrong')->>'error'='That password is not correct.', 'wrong password';
  token:=public.club_admin_login('test-only-password')->>'token';
  ASSERT length(token)=64, 'login token';
  ASSERT jsonb_array_length(public.club_admin_action(token,'context')->'seasons')>=1,'context';
  BEGIN
    PERFORM public.club_admin_action('invalid','context');
    RAISE EXCEPTION 'Invalid session accepted';
  EXCEPTION WHEN invalid_authorization_specification THEN NULL; END;
  SELECT jsonb_agg(id ORDER BY id) INTO players FROM (SELECT id FROM public.players ORDER BY id LIMIT 10) p;
  SELECT jsonb_agg(jsonb_build_object('killer_id',players->0,'victim_id',players->i) ORDER BY i DESC) INTO kos FROM generate_series(1,9) i;
  payload:=jsonb_build_object('request_id',gen_random_uuid(),'recorder','Transaction test','data',jsonb_build_object('season_id',7,'season_game',9000,'played_on',(now() AT TIME ZONE 'Europe/London')::date,'players',players,'knockouts',kos));
  result:=public.club_admin_action(token,'save',payload); gid:=(result->>'game_id')::bigint;
  ASSERT result->>'revision'='1','create revision';
  ASSERT (SELECT count(*) FROM public.game_results WHERE game_id=gid)=10,'all attendees saved';
  ASSERT (SELECT array_agg(points ORDER BY place) FROM public.game_results WHERE game_id=gid)=ARRAY[100,80,65,55,50,45,40,35,0,0],'ten-player scoring';
  ASSERT (SELECT count(*) FROM public.game_knockouts WHERE game_id=gid)=9,'all knockouts saved';
  ASSERT (SELECT winner_id FROM public.games WHERE id=gid)=(players->>0)::bigint,'winner';
  ASSERT result->'rebuild'->>'status'='failed','missing hook does not lose save';
  again:=public.club_admin_action(token,'save',payload);
  ASSERT again=result,'idempotent save';
  ASSERT (SELECT count(*) FROM club_private.game_history WHERE game_id=gid)=1,'one history entry';
  BEGIN
    PERFORM public.club_admin_action(token,'save',jsonb_set(payload,'{recorder}','"changed"'));
    RAISE EXCEPTION 'Changed request UUID accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='This request changed. Refresh and review it again.','request fingerprint'; END;
  BEGIN
    PERFORM public.club_admin_action(token,'save',jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid())));
    RAISE EXCEPTION 'Duplicate game accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM club_private.validate_game(jsonb_set(payload->'data','{knockouts,0,killer_id}',players->9));
    RAISE EXCEPTION 'Self knockout accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Knockout 1:%','invalid KO'; END;
  BEGIN
    PERFORM club_private.validate_game(jsonb_set(payload->'data','{season_id}','6'));
    RAISE EXCEPTION 'Historic season accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Choose Season 7 or a later season.','archive guard'; END;
  edited:=jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid()))||jsonb_build_object('game_id',gid,'expected_revision',1);
  edited:=jsonb_set(edited,'{data,played_on}',to_jsonb(((now() AT TIME ZONE 'Europe/London')::date-1)::text));
  result:=public.club_admin_action(token,'save',edited);
  ASSERT result->>'revision'='2','edit revision';
  BEGIN
    PERFORM public.club_admin_action(token,'save',jsonb_set(edited,'{request_id}',to_jsonb(gen_random_uuid())));
    RAISE EXCEPTION 'Stale edit accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  result:=public.club_admin_action(token,'undo',jsonb_build_object('request_id',gen_random_uuid(),'game_id',gid,'expected_revision',2,'recorder','Transaction test'));
  ASSERT (SELECT played_on FROM public.games WHERE id=gid)=(now() AT TIME ZONE 'Europe/London')::date,'undo edit restores date';
  ASSERT result->>'revision'='3','undo edit revision';
  -- Another game proves undo recalculates totals rather than restoring old totals.
  payload:=jsonb_set(payload,'{request_id}',to_jsonb(gen_random_uuid()));
  payload:=jsonb_set(payload,'{data,season_game}','9001');
  result:=public.club_admin_action(token,'save',payload); second_id:=(result->>'game_id')::bigint;
  payload:=jsonb_build_object('request_id',gen_random_uuid(),'game_id',second_id,'expected_revision',1,'recorder','Transaction test');
  result:=public.club_admin_action(token,'undo',payload);
  ASSERT result->>'removed'='true','undo creation removes game';
  ASSERT NOT EXISTS(SELECT 1 FROM public.games WHERE id=second_id),'removed public game';
  ASSERT public.club_admin_action(token,'undo',payload)=result,'idempotent undo';
  ASSERT (SELECT count(*) FROM public.games)=old_count+1,'no partial duplicate';
  ASSERT NOT EXISTS(SELECT 1 FROM public.season_results s FULL JOIN (SELECT player_id,sum(points) points FROM public.game_results WHERE season_id=7 GROUP BY player_id) r ON r.player_id=s.player_id WHERE s.season_id=7 AND s.points IS DISTINCT FROM r.points),'standings after removal';
  result:=public.club_admin_action(token,'undo',jsonb_build_object('request_id',gen_random_uuid(),'game_id',second_id,'expected_revision',2,'recorder','Transaction test'));
  ASSERT result->>'removed'='false','restore undone creation';
  ASSERT (SELECT count(*) FROM public.game_knockouts WHERE game_id=second_id)=9,'restored knockouts';
  ASSERT jsonb_array_length(public.club_admin_action(token,'history',jsonb_build_object('game_id',second_id))->'history')=3,'audit history';
  ASSERT (SELECT place FROM public.season_results WHERE season_id=7 AND player_id=(players->>8)::bigint)=(SELECT place FROM public.season_results WHERE season_id=7 AND player_id=(players->>9)::bigint),'ties share rank';
  result:=public.club_admin_action(token,'retry_rebuild',jsonb_build_object('id',result->'rebuild'->'id','request_id',gen_random_uuid()));
  ASSERT result->>'ok'='true','retry build';
  ASSERT NOT has_schema_privilege('anon','club_private','USAGE'),'private schema';
  ASSERT NOT has_function_privilege('anon','club_private.write_game(bigint,jsonb)','EXECUTE'),'private mutation';
  PERFORM public.club_admin_action(token,'logout');
  BEGIN
    PERFORM public.club_admin_action(token,'context');
    RAISE EXCEPTION 'Logged-out session accepted';
  EXCEPTION WHEN invalid_authorization_specification THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'PASS: login, permissions, scoring, create, edit, duplicate protection, concurrency, undo, restore, history, standings, rebuild retry. Test records rolled back.' AS result;
