-- Battle Page Migration Script (Consolidated)
-- Run this in Supabase SQL Editor to enable all Battle Page features

-- 1. Add new columns to user_stats (Attack, Defense, Spy, Sentry, Alliance)
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS attack bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS defense bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS spy bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentry bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS alliance text DEFAULT NULL;

-- 2. Fix Foreign Key Relationship (Critical for Battle Page list)
-- Drops and recreates the constraint to ensure user_stats links to profiles
ALTER TABLE public.user_stats
DROP CONSTRAINT IF EXISTS user_stats_profiles_fkey;

ALTER TABLE public.user_stats
ADD CONSTRAINT user_stats_profiles_fkey
FOREIGN KEY (id)
REFERENCES public.profiles (id)
ON DELETE CASCADE;

-- 3. Update the handle_new_user function to include new stats
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, is_admin)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), 
        NEW.email, 
        false
    );

    INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level, attack, defense, spy, sentry, alliance)
    VALUES (
        NEW.id, 
        0,    -- gold
        1000, -- experience
        0,    -- turns
        0,    -- vault
        1,    -- rank
        2,    -- citizens
        0,    -- kingdom_level
        0,    -- attack
        0,    -- defense
        0,    -- spy
        0,    -- sentry
        NULL  -- alliance
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Backfill missing data for existing users
-- Ensures all registered users appear in the game
INSERT INTO public.profiles (id, username, email, is_admin)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'username', au.email),
    au.email,
    false
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level, attack, defense, spy, sentry, alliance)
SELECT 
    au.id,
    0,    -- gold
    1000, -- experience
    0,    -- turns
    0,    -- vault
    1,    -- rank
    2,    -- citizens
    0,    -- kingdom_level
    0,    -- attack
    0,    -- defense
    0,    -- spy
    0,    -- sentry
    NULL  -- alliance
FROM auth.users au
LEFT JOIN public.user_stats us ON au.id = us.id
WHERE us.id IS NULL;

-- 5. Reload schema cache
NOTIFY pgrst, 'reload config';
