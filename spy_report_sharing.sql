-- Spy Report Sharing System
-- Allows players to share spy reports with alliance members or individual players

-- Create shared_spy_reports table
CREATE TABLE IF NOT EXISTS public.shared_spy_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_player_id UUID NOT NULL,
    target_username TEXT NOT NULL,
    report_data JSONB NOT NULL,
    share_type TEXT NOT NULL CHECK (share_type IN ('alliance', 'individual')),
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    alliance_id UUID REFERENCES public.alliances(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shared_spy_reports_alliance ON public.shared_spy_reports(alliance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_spy_reports_user ON public.shared_spy_reports(shared_with_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_spy_reports_expires ON public.shared_spy_reports(expires_at);

-- RLS Policies
ALTER TABLE public.shared_spy_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports shared with them or their alliance
CREATE POLICY "Users can view shared spy reports"
    ON public.shared_spy_reports FOR SELECT
    USING (
        -- Shared directly with user
        shared_with_user_id = auth.uid()
        OR
        -- Shared with user's alliance
        (
            share_type = 'alliance' 
            AND alliance_id IN (
                SELECT alliance_id FROM public.profiles WHERE id = auth.uid()
            )
        )
        OR
        -- User is the one who shared it
        shared_by = auth.uid()
    );

-- Users can insert their own shared reports
CREATE POLICY "Users can share spy reports"
    ON public.shared_spy_reports FOR INSERT
    WITH CHECK (shared_by = auth.uid());

-- Users can delete their own shared reports
CREATE POLICY "Users can delete their shared reports"
    ON public.shared_spy_reports FOR DELETE
    USING (shared_by = auth.uid());

-- Function to share a spy report
CREATE OR REPLACE FUNCTION public.share_spy_report(
    p_target_player_id UUID,
    p_target_username TEXT,
    p_report_data JSONB,
    p_share_type TEXT,
    p_shared_with_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_alliance_id UUID;
    v_report_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Validate share type
    IF p_share_type NOT IN ('alliance', 'individual') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid share type');
    END IF;
    
    -- Get user's alliance
    SELECT alliance_id INTO v_alliance_id
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- Validate alliance sharing
    IF p_share_type = 'alliance' THEN
        IF v_alliance_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'You must be in an alliance to share with alliance');
        END IF;
    END IF;
    
    -- Validate individual sharing
    IF p_share_type = 'individual' THEN
        IF p_shared_with_user_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Must specify recipient for individual sharing');
        END IF;
        
        -- Check if recipient exists
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_shared_with_user_id) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Recipient does not exist');
        END IF;
    END IF;
    
    -- Create the shared report
    INSERT INTO public.shared_spy_reports (
        shared_by,
        target_player_id,
        target_username,
        report_data,
        share_type,
        shared_with_user_id,
        alliance_id
    ) VALUES (
        v_user_id,
        p_target_player_id,
        p_target_username,
        p_report_data,
        p_share_type,
        p_shared_with_user_id,
        CASE WHEN p_share_type = 'alliance' THEN v_alliance_id ELSE NULL END
    )
    RETURNING id INTO v_report_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Spy report shared successfully',
        'report_id', v_report_id
    );
END;
$$;

-- Function to get shared spy reports for current user
CREATE OR REPLACE FUNCTION public.get_shared_spy_reports()
RETURNS TABLE (
    id UUID,
    shared_by UUID,
    shared_by_username TEXT,
    target_player_id UUID,
    target_username TEXT,
    report_data JSONB,
    share_type TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_alliance_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Get user's alliance
    SELECT alliance_id INTO v_alliance_id
    FROM public.profiles
    WHERE id = v_user_id;
    
    RETURN QUERY
    SELECT 
        ssr.id,
        ssr.shared_by,
        p.username as shared_by_username,
        ssr.target_player_id,
        ssr.target_username,
        ssr.report_data,
        ssr.share_type,
        ssr.created_at,
        ssr.expires_at
    FROM public.shared_spy_reports ssr
    LEFT JOIN public.profiles p ON ssr.shared_by = p.id
    WHERE 
        -- Not expired
        ssr.expires_at > NOW()
        AND (
            -- Shared directly with user
            ssr.shared_with_user_id = v_user_id
            OR
            -- Shared with user's alliance
            (ssr.share_type = 'alliance' AND ssr.alliance_id = v_alliance_id)
        )
    ORDER BY ssr.created_at DESC;
END;
$$;

-- Cleanup function for expired reports (can be called via cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_spy_reports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.shared_spy_reports
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;
