-- Shared-password club administration. Public table reads remain unchanged.
-- Run once as database owner. Configure private credentials separately.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS club_private;
REVOKE ALL ON SCHEMA club_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA net FROM PUBLIC, anon, authenticated;

CREATE TABLE club_private.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  password_hash text,
  build_hook text,
  login_window timestamptz NOT NULL DEFAULT now(),
  login_attempts integer NOT NULL DEFAULT 0
);
INSERT INTO club_private.settings(id) VALUES (true);
CREATE TABLE club_private.sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE TABLE club_private.game_heads (
  game_id bigint PRIMARY KEY,
  revision integer NOT NULL,
  payload jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE club_private.game_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id bigint NOT NULL,
  revision integer NOT NULL,
  action text NOT NULL,
  recorder text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_snapshot jsonb,
  after_snapshot jsonb,
  UNIQUE(game_id, revision)
);
CREATE TABLE club_private.requests (
  id uuid PRIMARY KEY,
  fingerprint text NOT NULL,
  response jsonb NOT NULL
);
CREATE TABLE club_private.rebuilds (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  history_id bigint REFERENCES club_private.game_history(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id bigint,
  status text NOT NULL,
  detail text
);
REVOKE ALL ON ALL TABLES IN SCHEMA club_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA club_private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION club_private.require_session(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 OR NOT EXISTS (
    SELECT 1 FROM club_private.sessions
    WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') AND expires_at > now()
  ) THEN RAISE EXCEPTION 'Please unlock results entry again.' USING ERRCODE = '28000'; END IF;
END;
$$;

CREATE FUNCTION public.club_admin_login(p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg club_private.settings; token text;
BEGIN
  SELECT * INTO cfg FROM club_private.settings WHERE id FOR UPDATE;
  IF cfg.password_hash IS NULL THEN RETURN jsonb_build_object('error','Results entry is not configured yet.'); END IF;
  IF cfg.login_window < now() - interval '1 minute' THEN
    UPDATE club_private.settings SET login_window=now(), login_attempts=0 WHERE id;
    cfg.login_attempts := 0;
  END IF;
  IF cfg.login_attempts >= 10 THEN RETURN jsonb_build_object('error','Too many attempts. Please wait a minute and try again.'); END IF;
  UPDATE club_private.settings SET login_attempts=login_attempts+1 WHERE id;
  IF p_password IS NULL OR length(p_password) > 72 OR extensions.crypt(p_password,cfg.password_hash) <> cfg.password_hash THEN
    RETURN jsonb_build_object('error','That password is not correct.');
  END IF;
  DELETE FROM club_private.sessions WHERE expires_at <= now();
  token := encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO club_private.sessions VALUES (encode(extensions.digest(token,'sha256'),'hex'),now()+interval '12 hours');
  RETURN jsonb_build_object('token',token,'expiresAt',now()+interval '12 hours');
END;
$$;

CREATE FUNCTION club_private.snapshot(p_game bigint) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('game',to_jsonb(g),'payload',h.payload,
    'results',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY place) FROM public.game_results r WHERE game_id=g.id),'[]'::jsonb),
    'knockouts',coalesce((SELECT jsonb_agg(to_jsonb(k) ORDER BY id) FROM public.game_knockouts k WHERE game_id=g.id),'[]'::jsonb))
  FROM public.games g JOIN club_private.game_heads h ON h.game_id=g.id WHERE g.id=p_game;
$$;

CREATE FUNCTION club_private.recalculate(p_season bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_season < 7 THEN RAISE EXCEPTION 'Archived seasons cannot be changed here.'; END IF;
  DELETE FROM public.season_results WHERE season_id=p_season;
  INSERT INTO public.season_results(season_id,player_id,place,points)
    SELECT p_season,player_id,rank() OVER (ORDER BY total DESC)::integer,total::integer
    FROM (SELECT r.player_id,sum(r.points) total FROM public.game_results r
      JOIN public.games g ON g.id=r.game_id WHERE g.season_id=p_season GROUP BY r.player_id) totals;
END;
$$;

CREATE FUNCTION club_private.queue_rebuild(p_history bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE hook text; request bigint; job bigint;
BEGIN
  SELECT build_hook INTO hook FROM club_private.settings WHERE id;
  IF hook IS NULL OR hook !~ '^https://api\.netlify\.com/build_hooks/[a-zA-Z0-9]+$' THEN
    INSERT INTO club_private.rebuilds(history_id,status,detail) VALUES(p_history,'failed','Website rebuild is not configured.') RETURNING id INTO job;
    RETURN job;
  END IF;
  BEGIN
    request := net.http_post(url:=hook,body:='{}'::jsonb,timeout_milliseconds:=10000);
    INSERT INTO club_private.rebuilds(history_id,request_id,status) VALUES(p_history,request,'queued') RETURNING id INTO job;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO club_private.rebuilds(history_id,status,detail) VALUES(p_history,'failed','Could not request the website rebuild.') RETURNING id INTO job;
  END;
  RETURN job;
END;
$$;

CREATE FUNCTION club_private.rebuild_status(p_job bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job club_private.rebuilds; response record;
BEGIN
  SELECT * INTO job FROM club_private.rebuilds WHERE id=p_job;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF job.status='queued' THEN
    SELECT status_code,timed_out,error_msg INTO response FROM net._http_response WHERE id=job.request_id;
    IF FOUND THEN
      UPDATE club_private.rebuilds SET
        status=CASE WHEN response.status_code BETWEEN 200 AND 299 AND NOT coalesce(response.timed_out,false) THEN 'requested' ELSE 'failed' END,
        detail=CASE WHEN response.status_code BETWEEN 200 AND 299 AND NOT coalesce(response.timed_out,false) THEN NULL ELSE 'The website rebuild request failed. You can retry without saving again.' END
        WHERE id=p_job RETURNING * INTO job;
    ELSIF job.created_at < now()-interval '2 minutes' THEN
      UPDATE club_private.rebuilds SET status='unknown',detail='The rebuild request could not be confirmed. Check the website before retrying.' WHERE id=p_job RETURNING * INTO job;
    END IF;
  END IF;
  RETURN jsonb_build_object('id',job.id,'status',job.status,'detail',job.detail,'createdAt',job.created_at);
END;
$$;

CREATE FUNCTION club_private.validate_game(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ids bigint[]; alive bigint[]; knockout jsonb; killer bigint; victim bigint; n integer; i integer:=0;
  played date; sid bigint; game_number integer; results jsonb:='[]'; points integer[]:=ARRAY[100,80,65,55,50,45,40,35];
BEGIN
  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid game details.'; END IF;
  sid := (p_data->>'season_id')::bigint;
  game_number := (p_data->>'season_game')::integer;
  played := (p_data->>'played_on')::date;
  IF sid IS NULL OR sid<7 OR NOT EXISTS(SELECT 1 FROM public.seasons WHERE id=sid) THEN RAISE EXCEPTION 'Choose Season 7 or a later season.'; END IF;
  IF game_number IS NULL OR game_number<1 OR game_number>10000 THEN RAISE EXCEPTION 'Enter a valid game number.'; END IF;
  IF played IS NULL OR played>(now() AT TIME ZONE 'Europe/London')::date THEN RAISE EXCEPTION 'The game date cannot be in the future.'; END IF;
  IF jsonb_typeof(p_data->'players') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'knockouts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Select the players and enter their knockouts.'; END IF;
  SELECT array_agg(value::bigint) INTO ids FROM jsonb_array_elements_text(p_data->'players');
  n:=coalesce(cardinality(ids),0);
  IF n<2 OR n>(SELECT count(*) FROM public.players) OR (SELECT count(DISTINCT v) FROM unnest(ids) v)<>n
    OR EXISTS(SELECT 1 FROM unnest(ids) v WHERE NOT EXISTS(SELECT 1 FROM public.players WHERE id=v)) THEN RAISE EXCEPTION 'Select at least two different registered players.'; END IF;
  IF jsonb_array_length(p_data->'knockouts')<>n-1 THEN RAISE EXCEPTION 'Record one knockout for each player except the winner.'; END IF;
  alive:=ids;
  FOR knockout IN SELECT value FROM jsonb_array_elements(p_data->'knockouts') LOOP
    killer:=(knockout->>'killer_id')::bigint; victim:=(knockout->>'victim_id')::bigint;
    IF killer IS NULL OR victim IS NULL OR killer=victim OR NOT killer=ANY(alive) OR NOT victim=ANY(alive) THEN
      RAISE EXCEPTION 'Knockout %: choose two different players who are still in the game.',i+1;
    END IF;
    results:=results||jsonb_build_array(jsonb_build_object('player_id',victim,'place',n-i,'points',coalesce(points[n-i],0)));
    alive:=array_remove(alive,victim); i:=i+1;
  END LOOP;
  RETURN jsonb_build_object('winner_id',alive[1],'results',results||jsonb_build_array(jsonb_build_object('player_id',alive[1],'place',1,'points',100)));
END;
$$;

CREATE FUNCTION club_private.write_game(p_id bigint,p_data jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE calculated jsonb; sid bigint:=(p_data->>'season_id')::bigint;
BEGIN
  calculated:=club_private.validate_game(p_data);
  IF EXISTS(SELECT 1 FROM public.games WHERE season_id=sid AND season_game=(p_data->>'season_game')::integer AND id<>p_id) THEN
    RAISE EXCEPTION 'That season and game number already exist. Open the existing game to correct it.' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.games(id,slug,season_id,season_game,played_on,no_of_players,winner_id)
    VALUES(p_id,p_id::text,sid,(p_data->>'season_game')::integer,(p_data->>'played_on')::date,jsonb_array_length(p_data->'players'),(calculated->>'winner_id')::bigint)
    ON CONFLICT(id) DO UPDATE SET season_id=excluded.season_id,season_game=excluded.season_game,played_on=excluded.played_on,no_of_players=excluded.no_of_players,winner_id=excluded.winner_id;
  DELETE FROM public.game_results WHERE game_id=p_id;
  INSERT INTO public.game_results(game_id,season_id,player_id,place,points)
    SELECT p_id,sid,(r->>'player_id')::bigint,(r->>'place')::integer,(r->>'points')::integer FROM jsonb_array_elements(calculated->'results') r;
  DELETE FROM public.game_knockouts WHERE game_id=p_id;
  INSERT INTO public.game_knockouts(game_id,season_id,killer_id,victim_id)
    SELECT p_id,sid,(k->>'killer_id')::bigint,(k->>'victim_id')::bigint FROM jsonb_array_elements(p_data->'knockouts') WITH ORDINALITY AS ko(k,idx) ORDER BY idx;
END;
$$;

CREATE FUNCTION club_private.restore_game(p_id bigint,p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.games;
BEGIN
  -- The private revision retains the complete removed game for later restoration.
  DELETE FROM public.game_knockouts WHERE game_id=p_id;
  DELETE FROM public.game_results WHERE game_id=p_id;
  DELETE FROM public.games WHERE id=p_id;
  IF p_snapshot IS NULL THEN RETURN; END IF;
  SELECT * INTO g FROM jsonb_populate_record(NULL::public.games,p_snapshot->'game');
  IF g.id<>p_id OR g.season_id<7 THEN RAISE EXCEPTION 'Invalid game history.'; END IF;
  INSERT INTO public.games SELECT g.*;
  INSERT INTO public.game_results SELECT * FROM jsonb_populate_recordset(NULL::public.game_results,p_snapshot->'results');
  INSERT INTO public.game_knockouts SELECT * FROM jsonb_populate_recordset(NULL::public.game_knockouts,p_snapshot->'knockouts');
END;
$$;

CREATE FUNCTION public.club_admin_action(p_token text,p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE gid bigint; rev integer; head club_private.game_heads; prior jsonb; subsequent jsonb; restored jsonb;
  data jsonb; recorder text; sid bigint; old_sid bigint; history_id bigint; job bigint; request_uuid uuid; fingerprint text; cached club_private.requests; result jsonb; latest bigint;
BEGIN
  PERFORM club_private.require_session(p_token);
  IF p_action='logout' THEN
    DELETE FROM club_private.sessions WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
    RETURN jsonb_build_object('ok',true);
  ELSIF p_action='context' THEN
    SELECT max(id) INTO latest FROM club_private.rebuilds;
    RETURN jsonb_build_object(
      'seasons',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id DESC),'[]') FROM public.seasons s WHERE id>=7),
      'players',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'first_name',p.first_name,'last_name',p.last_name,'nickname',p.nickname,'prefer_nickname',p.prefer_nickname,'image_url',p.image_url) ORDER BY first_name,last_name),'[]') FROM public.players p),
      'nextGames',(SELECT coalesce(jsonb_object_agg(s.id::text,coalesce((SELECT max(g.season_game) FROM public.games g WHERE g.season_id=s.id),0)+1),'{}') FROM public.seasons s WHERE s.id>=7),
      'games',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.game_id,'revision',h.revision,'removed',h.payload IS NULL,'data',coalesce(h.payload,v.before_snapshot->'payload'),'recorder',v.recorder,'updatedAt',h.updated_at) ORDER BY h.updated_at DESC),'[]') FROM club_private.game_heads h JOIN club_private.game_history v ON v.game_id=h.game_id AND v.revision=h.revision),
      'rebuild',club_private.rebuild_status(latest));
  ELSIF p_action='history' THEN
    gid:=(p_payload->>'game_id')::bigint;
    RETURN jsonb_build_object('history',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'action',v.action,'recorder',v.recorder,'createdAt',v.created_at,'before',v.before_snapshot->'payload','after',v.after_snapshot->'payload') ORDER BY v.revision DESC),'[]') FROM club_private.game_history v WHERE v.game_id=gid));
  ELSIF p_action='rebuild_status' THEN
    RETURN club_private.rebuild_status((p_payload->>'id')::bigint);
  END IF;
  IF p_action NOT IN ('save','undo','retry_rebuild') THEN RAISE EXCEPTION 'Unknown action.'; END IF;
  -- One short transaction per club write: serializes game numbering, standings and retries.
  PERFORM pg_catalog.pg_advisory_xact_lock(74261907);
  request_uuid:=(p_payload->>'request_id')::uuid;
  IF request_uuid IS NULL THEN RAISE EXCEPTION 'A request ID is required.'; END IF;
  fingerprint:=encode(extensions.digest(p_action||p_payload::text,'sha256'),'hex');
  SELECT * INTO cached FROM club_private.requests WHERE id=request_uuid;
  IF FOUND THEN
    IF cached.fingerprint<>fingerprint THEN RAISE EXCEPTION 'This request changed. Refresh and review it again.'; END IF;
    RETURN cached.response;
  END IF;
  IF p_action='retry_rebuild' THEN
    SELECT r.history_id INTO history_id FROM club_private.rebuilds r WHERE r.id=(p_payload->>'id')::bigint;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rebuild request not found.'; END IF;
    job:=club_private.queue_rebuild(history_id);
    result:=jsonb_build_object('ok',true,'rebuild',club_private.rebuild_status(job));
  ELSE
    recorder:=btrim(p_payload->>'recorder');
    IF recorder IS NULL OR length(recorder)<1 OR length(recorder)>80 THEN RAISE EXCEPTION 'Enter your name for the change history.'; END IF;
    gid:=(p_payload->>'game_id')::bigint;
    IF gid IS NOT NULL THEN
      SELECT * INTO head FROM club_private.game_heads WHERE game_id=gid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Only games entered through this page can be changed here.'; END IF;
      IF (p_payload->>'expected_revision')::integer IS DISTINCT FROM head.revision THEN RAISE EXCEPTION 'This game was changed by someone else. Refresh and review the latest results.' USING ERRCODE='40001'; END IF;
      prior:=club_private.snapshot(gid);
      rev:=head.revision+1;
    ELSE
      IF p_action<>'save' THEN RAISE EXCEPTION 'Choose a game.'; END IF;
      gid:=nextval('public.games_id_seq'::regclass); rev:=1;
      INSERT INTO club_private.game_heads(game_id,revision) VALUES(gid,0);
    END IF;
    old_sid:=(prior->'game'->>'season_id')::bigint;
    IF p_action='save' THEN
      data:=p_payload->'data';
      PERFORM club_private.write_game(gid,data);
      sid:=(data->>'season_id')::bigint;
      UPDATE club_private.game_heads SET revision=rev,payload=data,updated_at=now() WHERE game_id=gid;
    ELSE
      SELECT before_snapshot INTO restored FROM club_private.game_history WHERE game_id=gid AND revision=head.revision;
      PERFORM club_private.restore_game(gid,restored);
      data:=restored->'payload'; sid:=(restored->'game'->>'season_id')::bigint;
      UPDATE club_private.game_heads SET revision=rev,payload=data,updated_at=now() WHERE game_id=gid;
    END IF;
    IF old_sid IS NOT NULL THEN PERFORM club_private.recalculate(old_sid); END IF;
    IF sid IS NOT NULL AND sid IS DISTINCT FROM old_sid THEN PERFORM club_private.recalculate(sid); END IF;
    subsequent:=club_private.snapshot(gid);
    INSERT INTO club_private.game_history(game_id,revision,action,recorder,before_snapshot,after_snapshot)
      VALUES(gid,rev,CASE WHEN p_action='undo' THEN 'undo' WHEN rev=1 THEN 'create' ELSE 'edit' END,recorder,prior,subsequent) RETURNING id INTO history_id;
    job:=club_private.queue_rebuild(history_id);
    result:=jsonb_build_object('ok',true,'game_id',gid,'revision',rev,'removed',subsequent IS NULL,'rebuild',club_private.rebuild_status(job));
  END IF;
  INSERT INTO club_private.requests VALUES(request_uuid,fingerprint,result);
  RETURN result;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA club_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.club_admin_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.club_admin_action(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_admin_login(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.club_admin_action(text,text,jsonb) TO anon,authenticated;

-- Correct manually maintained sequence positions without ever reusing an ID.
SELECT setval('public.games_id_seq',greatest((SELECT coalesce(max(id),1) FROM public.games),(SELECT last_value FROM public.games_id_seq)),true);
SELECT setval('public.game_knockouts_id_seq',greatest((SELECT coalesce(max(id),1) FROM public.game_knockouts),(SELECT last_value FROM public.game_knockouts_id_seq)),true);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.seasons WHERE id=7) THEN
    UPDATE public.seasons SET is_active=false WHERE is_active;
    INSERT INTO public.seasons(id,slug,name,is_active) VALUES(7,'7','Seven',true);
  END IF;
END $$;
SELECT setval('public.seasons_id_seq',greatest((SELECT coalesce(max(id),1) FROM public.seasons),(SELECT last_value FROM public.seasons_id_seq)),true);
COMMIT;
