-- Fix update_last_active RPC permissions and logic
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET last_active_at = NOW()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_last_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_last_active() TO service_role;

-- Ensure RLS allows users to update their own profile? 
-- Since it's SECURITY DEFINER, it bypasses RLS, so this should be fine.
-- But let's verification permissions are good.

NOTIFY pgrst, 'reload schema';
