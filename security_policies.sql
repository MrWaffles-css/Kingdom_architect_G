-- =====================================================
-- SECURITY HARDENING: Row Level Security (RLS)
-- =====================================================
-- This script enables RLS on critical tables to prevent
-- unauthorized access and modification of user data.

-- =====================================================
-- STEP 1: Enable RLS on Tables
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: DROP EXISTING POLICIES (if any)
-- =====================================================

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Admins can update any stats" ON public.user_stats;

-- =====================================================
-- STEP 3: PROFILES Table Policies
-- =====================================================

-- Allow all authenticated users to VIEW all profiles
-- (Needed for displaying usernames in leaderboard, battle, etc.)
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow users to UPDATE only their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to INSERT only their own profile
-- (This is typically handled by triggers, but we add this for safety)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow admins to UPDATE any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- =====================================================
-- STEP 4: USER_STATS Table Policies
-- =====================================================

-- Allow users to VIEW only their own stats
-- (Other users' stats should only be visible via RPC functions like spy_player)
CREATE POLICY "Users can view own stats"
ON public.user_stats
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to UPDATE only their own stats
-- (Most updates should go through RPC functions, but this prevents direct manipulation)
CREATE POLICY "Users can update own stats"
ON public.user_stats
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to INSERT only their own stats
CREATE POLICY "Users can insert own stats"
ON public.user_stats
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow admins to VIEW and UPDATE any stats
CREATE POLICY "Admins can view any stats"
ON public.user_stats
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

CREATE POLICY "Admins can update any stats"
ON public.user_stats
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- =====================================================
-- STEP 5: Grant Necessary Permissions
-- =====================================================

-- These grants are still needed, but RLS policies will enforce row-level restrictions
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 
    'RLS STATUS' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'user_stats');

SELECT 
    'POLICIES' as check_type,
    schemaname,
    tablename,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'user_stats')
ORDER BY tablename, policyname;
