-- Add is_admin column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Update RLS policies to allow admins to see/edit everything
-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create policies with Admin access
-- PROFILES
CREATE POLICY "Users can view own profile or admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile or admin" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- USER_STATS
CREATE POLICY "Users can view own stats or admin" ON public.user_stats
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own stats or admin" ON public.user_stats
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());
