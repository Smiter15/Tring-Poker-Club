-- Historical result corrections authorized by the club owner, 10 September 2026.
-- Preserve recorded finishing orders and per-game points. CSV inconsistencies will be retired with the CSV source.
-- All corrections run in one transaction; stale values abort the entire transaction.
BEGIN;
LOCK TABLE public.games, public.game_results, public.season_results IN SHARE ROW EXCLUSIVE MODE;
DO $corrections$
DECLARE changed integer;
BEGIN
  -- Season 3 Game 12: Phil is first; Bar Matt is last, confirmed by owner.
  UPDATE public.games SET winner_id = 3 WHERE id IS NOT DISTINCT FROM 41 AND winner_id IS NOT DISTINCT FROM 14;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: games {"id":41}'; END IF;
  -- Match the result season to its parent game.
  UPDATE public.game_results SET season_id = 1 WHERE game_id IS NOT DISTINCT FROM 4 AND player_id IS NOT DISTINCT FROM 4 AND season_id IS NOT DISTINCT FROM -1;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: game_results {"game_id":4,"player_id":4}'; END IF;
  -- Match the result season to its parent game.
  UPDATE public.game_results SET season_id = 3 WHERE game_id IS NOT DISTINCT FROM 43 AND player_id IS NOT DISTINCT FROM 13 AND season_id IS NOT DISTINCT FROM -1;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: game_results {"game_id":43,"player_id":13}'; END IF;
  -- Match the result season to its parent game.
  UPDATE public.game_results SET season_id = 3 WHERE game_id IS NOT DISTINCT FROM 43 AND player_id IS NOT DISTINCT FROM 20 AND season_id IS NOT DISTINCT FROM 1;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: game_results {"game_id":43,"player_id":20}'; END IF;
  -- Season 1 Game 5: count recorded participants.
  UPDATE public.games SET no_of_players = 9 WHERE id IS NOT DISTINCT FROM 5 AND no_of_players IS NOT DISTINCT FROM 8;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: games {"id":5}'; END IF;
  -- Season 3 Game 2: count recorded participants.
  UPDATE public.games SET no_of_players = 12 WHERE id IS NOT DISTINCT FROM 31 AND no_of_players IS NOT DISTINCT FROM 11;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: games {"id":31}'; END IF;
  -- Season 3 Game 3: count recorded participants.
  UPDATE public.games SET no_of_players = 16 WHERE id IS NOT DISTINCT FROM 32 AND no_of_players IS NOT DISTINCT FROM 14;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: games {"id":32}'; END IF;
  -- Season 3 Game 7: count recorded participants.
  UPDATE public.games SET no_of_players = 13 WHERE id IS NOT DISTINCT FROM 36 AND no_of_players IS NOT DISTINCT FROM 15;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: games {"id":36}'; END IF;
  -- Reconcile the stored season total to recorded game scores.
  UPDATE public.season_results SET points = 52 WHERE season_id IS NOT DISTINCT FROM 1 AND player_id IS NOT DISTINCT FROM 5 AND points IS NOT DISTINCT FROM 61;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: season_results {"season_id":1,"player_id":5}'; END IF;
  -- Reconcile the stored season total to recorded game scores.
  UPDATE public.season_results SET points = 685 WHERE season_id IS NOT DISTINCT FROM 4 AND player_id IS NOT DISTINCT FROM 13 AND points IS NOT DISTINCT FROM 695;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: season_results {"season_id":4,"player_id":13}'; END IF;
  -- Reconcile the stored season total to recorded game scores.
  UPDATE public.season_results SET points = 125 WHERE season_id IS NOT DISTINCT FROM 4 AND player_id IS NOT DISTINCT FROM 14 AND points IS NOT DISTINCT FROM 130;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: season_results {"season_id":4,"player_id":14}'; END IF;
  -- Include Jack, a recorded zero-point Season 4 participant, in the tied last place.
  INSERT INTO public.season_results (season_id, player_id, place, points) SELECT 4, 22, 25, 0 WHERE NOT EXISTS (SELECT 1 FROM public.season_results WHERE season_id IS NOT DISTINCT FROM 4 AND player_id IS NOT DISTINCT FROM 22);
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Precondition failed: season_results {"season_id":4,"player_id":22}'; END IF;
END;
$corrections$;
COMMIT;
