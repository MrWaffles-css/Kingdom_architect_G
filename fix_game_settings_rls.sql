-- fix_game_settings_rls.sql
-- Fixes the 406 Not Acceptable error by ensuring proper RLS policies on game_settings

-- 1. Ensure Table Exists (Safety check, though likely exists)
CREATE TABLE IF NOT EXISTS public.game_settings (
    key TEXT PRIMARY KEY,
    value JSONB
);

-- 2. Enable RLS
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON public.game_settings;
DROP POLICY IF EXISTS "Allow admin write access" ON public.game_settings;

-- 4. Create Policies

-- Allow EVERYONE (anon + authenticated) to read game_settings
-- This is critical for the "Next Season" countdown on login page
CREATE POLICY "Allow public read access"
ON public.game_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow ADMINS only to modify settings
CREATE POLICY "Allow admin write access"
ON public.game_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- 5. Grant Permissions requires for anon access
GRANT SELECT ON public.game_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.game_settings TO authenticated;

-- 6. Reload Schema
NOTIFY pgrst, 'reload schema';
