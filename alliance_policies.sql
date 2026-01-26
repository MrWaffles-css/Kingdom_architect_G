-- =====================================================
-- RLS FOR ALLIANCES
-- =====================================================
ALTER TABLE public.alliances ENABLE ROW LEVEL SECURITY;

-- Allow reading all alliances (for browser)
CREATE POLICY "Enable read access for all users" ON public.alliances
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

-- Allow modification only via RPC (or strict leader check)
-- Since we use SECURITY DEFINER RPCs for modifying, we can restrict direct update/insert 
-- or implement strict policies. For safety, we keep it read-only for direct access 
-- and let RPCs handle logic.


-- =====================================================
-- RLS FOR ALLIANCE MESSAGES
-- =====================================================
ALTER TABLE public.alliance_messages ENABLE ROW LEVEL SECURITY;

-- Allow viewing messages ONLY if you are in that alliance
CREATE POLICY "View alliance messages" ON public.alliance_messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND alliance_id = alliance_messages.alliance_id
    )
);

-- Allow sending messages ONLY if you are in that alliance AND you are the sender
CREATE POLICY "Send alliance messages" ON public.alliance_messages
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND alliance_id = alliance_messages.alliance_id
    )
);

-- =====================================================
-- PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT ON public.alliances TO authenticated;
GRANT SELECT, INSERT ON public.alliance_messages TO authenticated;
