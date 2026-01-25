-- Fix RLS issues for season_logs and spy_reports tables.
-- This script enables RLS and adds appropriate policies.

-- 1. season_logs
-- Likely a log table for season transitions/admin actions.
-- Security: Admins should be able to VIEW/INSERT logs. Users likely don't need access, or maybe just VIEW.
-- Assuming internal use or admin dashboard use.

ALTER TABLE public.season_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view season logs" ON public.season_logs;
CREATE POLICY "Admins can view season logs"
ON public.season_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

DROP POLICY IF EXISTS "Admins can insert season logs" ON public.season_logs;
CREATE POLICY "Admins can insert season logs"
ON public.season_logs
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- If regular users ever need to trigger actions that log here, we might need a broader INSERT policy,
-- but usually logging happens via SECURITY DEFINER functions which bypass RLS.
-- So Admin-only RLS is safe for direct access.


-- 2. spy_reports
-- This table was flagged even though `security_policies.sql` had a section for it.
-- This likely means the table was recreated or the RLS status was lost/disabled in a migration.
-- We re-enable it and ensure policies exist.

ALTER TABLE public.spy_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own spy reports" ON public.spy_reports;
CREATE POLICY "Users can view own spy reports"
ON public.spy_reports
FOR SELECT
TO authenticated
USING (auth.uid() = attacker_id);

-- Also allow viewing if you are the defender? (Optional, usually spy reports are for the spy)
-- Keeping it just for attacker for now as per typical game logic.

DROP POLICY IF EXISTS "Admins can view all spy reports" ON public.spy_reports;
CREATE POLICY "Admins can view all spy reports"
ON public.spy_reports
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Note: Inserts usually happen via the `spy_player` function which should be SECURITY DEFINER.
-- If not, we would need an INSERT policy.
-- Just in case, let's allow users to insert their own reports where they are the attacker.
DROP POLICY IF EXISTS "Users can insert own spy reports" ON public.spy_reports;
CREATE POLICY "Users can insert own spy reports"
ON public.spy_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = attacker_id);


-- 3. Additional Safety: Ensure game_settings RLS if not already fixed
ALTER TABLE IF EXISTS public.game_settings ENABLE ROW LEVEL SECURITY;
-- (Policies for game_settings are likely in fix_game_settings_rls.sql, but ensuring enabled here doesn't hurt)
