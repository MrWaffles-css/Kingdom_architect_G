-- Diagnostic script to check MrWaffles data
-- Run this in Supabase SQL Editor to see what's happening

-- 1. Check if MrWaffles exists in auth.users
SELECT 'AUTH USERS' as table_name, id, email, created_at
FROM auth.users
WHERE email ILIKE '%waffles%' OR id::text ILIKE '%waffles%';

-- 2. Check if MrWaffles exists in profiles
SELECT 'PROFILES' as table_name, id, username, is_admin, created_at
FROM public.profiles
WHERE username ILIKE '%waffles%' OR id::text ILIKE '%waffles%';

-- 3. Check if MrWaffles exists in user_stats
SELECT 'USER_STATS' as table_name, 
    id, 
    gold, 
    experience, 
    turns, 
    citizens, 
    kingdom_level,
    attack, 
    defense, 
    spy, 
    sentry,
    created_at,
    updated_at
FROM public.user_stats
WHERE id IN (
    SELECT id FROM public.profiles WHERE username ILIKE '%waffles%'
);

-- 4. Check if leaderboard view exists
SELECT 'LEADERBOARD VIEW EXISTS' as check_name,
    EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'leaderboard'
    ) as exists;

-- 5. If leaderboard exists, check if MrWaffles is in it
SELECT 'LEADERBOARD' as table_name, *
FROM public.leaderboard
WHERE username ILIKE '%waffles%'
LIMIT 1;

-- 6. Show ALL users in user_stats (to see if anyone exists)
SELECT 'ALL USER_STATS' as table_name, 
    us.id, 
    p.username,
    us.gold, 
    us.experience, 
    us.citizens,
    us.created_at
FROM public.user_stats us
LEFT JOIN public.profiles p ON us.id = p.id
ORDER BY us.created_at DESC;

-- 7. Check for orphaned records (user_stats without profiles)
SELECT 'ORPHANED USER_STATS (no profile)' as check_name,
    us.id,
    us.gold,
    us.experience,
    us.citizens
FROM public.user_stats us
LEFT JOIN public.profiles p ON us.id = p.id
WHERE p.id IS NULL;
