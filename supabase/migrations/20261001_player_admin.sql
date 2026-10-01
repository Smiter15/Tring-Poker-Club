-- Add player registration behind the existing club admin session.
BEGIN;

CREATE FUNCTION public.club_admin_create_player(p_token text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  first_name text := pg_catalog.btrim(p_payload->>'first_name');
  last_name text := pg_catalog.btrim(p_payload->>'last_name');
  nickname text := pg_catalog.nullif(pg_catalog.btrim(p_payload->>'nickname'), '');
  bio text := pg_catalog.nullif(pg_catalog.btrim(p_payload->>'bio'), '');
  image_url text := pg_catalog.nullif(pg_catalog.btrim(p_payload->>'image_url'), '');
  prefer_nickname boolean;
  base_slug text;
  player_slug text;
  suffix integer := 2;
  player_id bigint;
  job bigint;
  request_uuid uuid;
  fingerprint text;
  cached club_private.requests;
  result jsonb;
BEGIN
  PERFORM club_private.require_session(p_token);
  IF pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Enter the player details.';
  END IF;
  request_uuid := (p_payload->>'request_id')::uuid;
  IF request_uuid IS NULL THEN RAISE EXCEPTION 'A request ID is required.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(74261907);
  fingerprint := pg_catalog.encode(extensions.digest('create_player'||p_payload::text, 'sha256'), 'hex');
  SELECT * INTO cached FROM club_private.requests WHERE id=request_uuid;
  IF FOUND THEN
    IF cached.fingerprint <> fingerprint THEN RAISE EXCEPTION 'This request changed. Review the player details and try again.'; END IF;
    RETURN cached.response;
  END IF;

  IF first_name IS NULL OR pg_catalog.length(first_name) < 1 OR pg_catalog.length(first_name) > 80
    OR last_name IS NULL OR pg_catalog.length(last_name) < 1 OR pg_catalog.length(last_name) > 80 THEN
    RAISE EXCEPTION 'Enter a first and last name (up to 80 characters each).';
  END IF;
  IF pg_catalog.length(nickname) > 80 OR pg_catalog.length(bio) > 2000 OR pg_catalog.length(image_url) > 500 THEN
    RAISE EXCEPTION 'A player detail is too long.';
  END IF;
  IF image_url IS NOT NULL AND image_url !~* '^(https://[^[:space:]]+|/images/players/[a-zA-Z0-9._/-]+)$' THEN
    RAISE EXCEPTION 'Use an HTTPS image URL or a path under /images/players/.';
  END IF;
  IF pg_catalog.jsonb_typeof(p_payload->'prefer_nickname') IS NOT NULL
    AND pg_catalog.jsonb_typeof(p_payload->'prefer_nickname') <> 'boolean' THEN
    RAISE EXCEPTION 'Choose whether to display the nickname.';
  END IF;
  prefer_nickname := coalesce((p_payload->>'prefer_nickname')::boolean, false);
  IF prefer_nickname AND nickname IS NULL THEN RAISE EXCEPTION 'Enter a nickname to display it.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.players p
    WHERE pg_catalog.lower(pg_catalog.btrim(p.first_name)) = pg_catalog.lower(first_name)
      AND pg_catalog.lower(pg_catalog.btrim(p.last_name)) = pg_catalog.lower(last_name)
  ) THEN RAISE EXCEPTION 'A player with that name already exists.' USING ERRCODE = '23505'; END IF;

  base_slug := pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.lower(first_name || '-' || last_name), '[^a-z0-9]+', '-', 'g'
  ), '-');
  IF base_slug = '' THEN base_slug := 'player'; END IF;
  player_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.players WHERE slug = player_slug) LOOP
    player_slug := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  END LOOP;
  -- Older players were imported with explicit IDs; keep the sequence above them.
  PERFORM pg_catalog.setval('public.players_id_seq'::regclass,
    pg_catalog.greatest((SELECT coalesce(pg_catalog.max(id), 1) FROM public.players),
      (SELECT last_value FROM public.players_id_seq)), true);
  INSERT INTO public.players(slug, first_name, last_name, nickname, prefer_nickname, image_url, bio)
  VALUES(player_slug, first_name, last_name, nickname, prefer_nickname, image_url, bio)
  RETURNING id INTO player_id;
  job := club_private.queue_rebuild(NULL);
  result := pg_catalog.jsonb_build_object('ok', true, 'id', player_id, 'slug', player_slug,
    'rebuild', club_private.rebuild_status(job));
  INSERT INTO club_private.requests(id, fingerprint, response) VALUES(request_uuid, fingerprint, result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.club_admin_create_player(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_admin_create_player(text, jsonb) TO anon, authenticated;
COMMIT;
