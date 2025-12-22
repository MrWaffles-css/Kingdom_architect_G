-- Fix Is Season Visibility & Permissions

-- 1. Ensure 'seasons' table is readable by everyone (including anon for Welcome Page)
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view seasons" ON seasons;
CREATE POLICY "Public view seasons"
ON seasons FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON seasons TO anon, authenticated;

-- 2. Define get_next_scheduled_season function
-- This fetches the *next* scheduled season that hasn't started yet
CREATE OR REPLACE FUNCTION get_next_scheduled_season()
RETURNS SETOF seasons
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT *
    FROM seasons
    WHERE is_active = false
    AND start_date > NOW()
    ORDER BY start_date ASC
    LIMIT 1;
$$;

-- 3. Grant Execute Permissions on RPCs
GRANT EXECUTE ON FUNCTION get_next_scheduled_season() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_server_time() TO anon, authenticated;

-- 4. Reload Schema
NOTIFY pgrst, 'reload schema';
