-- Add RLS policy to allow users to update their own reports (e.g. marking as read)
DROP POLICY IF EXISTS "reports_update_own" ON public.reports;

CREATE POLICY "reports_update_own"
ON public.reports
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
