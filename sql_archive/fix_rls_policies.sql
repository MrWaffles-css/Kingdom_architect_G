-- Fix Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor

-- 1. Ensure RLS is enabled (security best practice)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- 2. Allow everyone to read profiles (needed for Battle page names)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 3. Allow everyone to read user_stats (needed for Battle page stats)
DROP POLICY IF EXISTS "User stats are viewable by everyone" ON public.user_stats;
CREATE POLICY "User stats are viewable by everyone"
ON public.user_stats FOR SELECT
TO authenticated
USING (true);

-- 4. Ensure users can still update their own data
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
CREATE POLICY "Users can update own stats"
ON public.user_stats FOR UPDATE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;
CREATE POLICY "Users can insert own stats"
ON public.user_stats FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
