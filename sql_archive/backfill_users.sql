-- Backfill script to ensure all users have profiles and stats
-- Run this in Supabase SQL Editor

-- 1. Insert missing profiles
INSERT INTO public.profiles (id, username, email, is_admin)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'username', au.email),
    au.email,
    false
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 2. Insert missing user_stats
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

-- 3. Optional: Recalculate ranks (simple version)
-- This ensures everyone has a distinct rank if you want, or just leave them at 1
-- For now, we just leave them at 1 as per default
