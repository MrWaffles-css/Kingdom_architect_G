-- Fix for Attack Error: "violates foreign key constraint daily_stats_user_id_fkey"
-- The issue is that daily_stats references auth.users, but Clippy (the bot) 
-- only exists in public.profiles, not auth.users.
--
-- Solution: Repoint the Foreign Key to public.profiles instead of auth.users.
-- Since all real users have a profile, this maintains integrity while allowing Bots.

DO $$
BEGIN
    -- 1. Drop the existing strict constraint to auth.users
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'daily_stats_user_id_fkey'
        AND table_name = 'daily_stats'
    ) THEN
        RAISE NOTICE 'Dropping strict FK constraint on daily_stats...';
        ALTER TABLE public.daily_stats DROP CONSTRAINT daily_stats_user_id_fkey;
    END IF;

    -- 2. Add the new constraint referencing public.profiles
    -- Check if it doesn't exist yet to avoid error
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'daily_stats_user_id_fkey_profiles'
        AND table_name = 'daily_stats'
    ) THEN
        RAISE NOTICE 'Adding new flexible FK constraint to public.profiles...';
        ALTER TABLE public.daily_stats 
        ADD CONSTRAINT daily_stats_user_id_fkey_profiles 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error executing FK fix: %', SQLERRM;
END $$;
