-- Ensure complete access to spy_reports for debugging and functionality

ALTER TABLE public.spy_reports ENABLE ROW LEVEL SECURITY;

-- 1. Allow users to SEE reports they created (as attacker)
DROP POLICY IF EXISTS "Users can view created spy reports" ON public.spy_reports;
CREATE POLICY "Users can view created spy reports"
ON public.spy_reports FOR SELECT
TO authenticated
USING (attacker_id = auth.uid());

-- 2. Allow users to CREATE reports (as attacker) - critical for non-SECURITY DEFINER calls, though we used RPC
DROP POLICY IF EXISTS "Users can insert own spy reports" ON public.spy_reports;
CREATE POLICY "Users can insert own spy reports"
ON public.spy_reports FOR INSERT
TO authenticated
WITH CHECK (attacker_id = auth.uid());

-- 3. Just in case, allow defenders to see if they were spied on? (Optional, maybe for "History" tab later)
DROP POLICY IF EXISTS "Defenders can see reports" ON public.spy_reports;
CREATE POLICY "Defenders can see reports"
ON public.spy_reports FOR SELECT
TO authenticated
USING (defender_id = auth.uid());

-- 4. Admin Access
DROP POLICY IF EXISTS "Admins can manage all spy reports" ON public.spy_reports;
CREATE POLICY "Admins can manage all spy reports"
ON public.spy_reports FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Force refresh schema cache by notifying (PostgREST specific usually, but good practice)
NOTIFY pgrst, 'reload schema';
