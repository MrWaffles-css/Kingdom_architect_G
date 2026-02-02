-- =====================================================
-- FIX RELATIONSHIPS SCRIPT
-- Resolves AbortError / Timeout issues caused by missing indices or broken FKs
-- =====================================================

-- 1. CLEANUP ORPHANED ALLIANCES
-- Set alliance_id to NULL if the alliance no longer exists
UPDATE public.profiles
SET alliance_id = NULL
WHERE alliance_id IS NOT NULL 
AND alliance_id NOT IN (SELECT id FROM public.alliances);

-- 2. ENSURE FOREIGN KEY CONSTRAINT
-- Add specific FK for Alliances if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_alliance_id_fkey'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_alliance_id_fkey
        FOREIGN KEY (alliance_id)
        REFERENCES public.alliances(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. ADD INDEX FOR PERFORMANCE
-- Critical for joins in get_battle_opponents / leaderboard
CREATE INDEX IF NOT EXISTS idx_profiles_alliance_id ON public.profiles(alliance_id);

-- 4. ENSURE USER_STATS FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_stats_id_fkey'
    ) THEN
        ALTER TABLE public.user_stats
        ADD CONSTRAINT user_stats_id_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload config';
