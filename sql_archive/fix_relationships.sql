-- Fix relationships for Supabase joins
-- Run this in Supabase SQL Editor

-- Add FK to profiles to enable joining user_stats with profiles
-- This allows the query: .select('*, profiles:id (username)') to work
ALTER TABLE public.user_stats
ADD CONSTRAINT user_stats_profiles_fkey
FOREIGN KEY (id)
REFERENCES public.profiles (id);

-- If the above fails because the constraint already exists, that's fine.
-- But if it was missing, this will fix the empty list issue.
