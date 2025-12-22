-- Force fix relationships for Supabase joins
-- Run this in Supabase SQL Editor

-- 1. Drop the constraint if it exists (to ensure we can recreate it cleanly)
ALTER TABLE public.user_stats
DROP CONSTRAINT IF EXISTS user_stats_profiles_fkey;

-- 2. Add FK to profiles to enable joining user_stats with profiles
-- This explicitly tells Supabase that user_stats.id points to profiles.id
ALTER TABLE public.user_stats
ADD CONSTRAINT user_stats_profiles_fkey
FOREIGN KEY (id)
REFERENCES public.profiles (id)
ON DELETE CASCADE;

-- 3. Notify PostgREST to reload schema (usually happens automatically, but good to ensure)
NOTIFY pgrst, 'reload config';
