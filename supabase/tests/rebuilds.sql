BEGIN;
DO $$
DECLARE job bigint; req bigint; state jsonb;
BEGIN
 UPDATE club_private.settings SET build_hook='https://api.netlify.com/build_hooks/transactiontest';
 job:=club_private.queue_rebuild(NULL);
 state:=club_private.rebuild_status(job);
 ASSERT state->>'status'='queued','queue rebuild';
 SELECT request_id INTO req FROM club_private.rebuilds WHERE id=job;
 ASSERT EXISTS(SELECT 1 FROM net.http_request_queue WHERE id=req),'pg_net transaction queue';
 INSERT INTO net._http_response(id,status_code,timed_out) VALUES(req,200,false);
 ASSERT club_private.rebuild_status(job)->>'status'='requested','successful hook response';
 job:=club_private.queue_rebuild(NULL);
 SELECT request_id INTO req FROM club_private.rebuilds WHERE id=job;
 INSERT INTO net._http_response(id,status_code,timed_out) VALUES(req,500,false);
 ASSERT club_private.rebuild_status(job)->>'status'='failed','failed hook response';
END $$;
ROLLBACK;
SELECT 'PASS: queued, accepted and failed rebuild requests. No HTTP request survives rollback.' AS result;
SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('games','game_results','game_knockouts','season_results','seasons','players');
SELECT tablename,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public';
SELECT (SELECT count(*) FROM public.games) AS games,(SELECT count(*) FROM public.game_results) AS results,(SELECT count(*) FROM public.season_results) AS standings,(SELECT count(*) FROM club_private.game_history) AS admin_changes;
