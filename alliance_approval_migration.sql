-- =====================================================
-- 1. Create ALLIANCE_REQUESTS Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.alliance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    alliance_id UUID REFERENCES public.alliances(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, alliance_id)
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_alliance_requests_alliance_id ON public.alliance_requests(alliance_id);

-- =====================================================
-- 2. RLS FOR ALLIANCE_REQUESTS
-- =====================================================
ALTER TABLE public.alliance_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can see own requests" ON public.alliance_requests
FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own requests (RPC handles logic, but policy needed if using direct insert, or if RPC is SECURITY INVOKER)
-- We will use SECURITY DEFINER RPCs for logic logic, but reading might be direct.

-- Leaders can see requests for their alliance
CREATE POLICY "Leaders can see alliance requests" ON public.alliance_requests
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.alliances
        WHERE id = alliance_requests.alliance_id
        AND leader_id = auth.uid()
    )
);

-- =====================================================
-- 3. UPDATE JOIN_ALLIANCE (Now creates request)
-- =====================================================
CREATE OR REPLACE FUNCTION public.join_alliance(p_alliance_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    -- Check if user is already in an alliance
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND alliance_id IS NOT NULL) THEN
        RETURN jsonb_build_object('success', false, 'message', 'You are already in an alliance.');
    END IF;

    -- Check if already requested
    IF EXISTS (SELECT 1 FROM public.alliance_requests WHERE user_id = v_user_id AND alliance_id = p_alliance_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request already pending.');
    END IF;

    -- Create Request
    INSERT INTO public.alliance_requests (user_id, alliance_id)
    VALUES (v_user_id, p_alliance_id);

    RETURN jsonb_build_object('success', true, 'message', 'Request sent.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 4. APPROVE REQUEST
-- =====================================================
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_leader_id UUID := auth.uid();
    v_req_user_id UUID;
    v_req_alliance_id UUID;
BEGIN
    -- Get request details
    SELECT user_id, alliance_id INTO v_req_user_id, v_req_alliance_id
    FROM public.alliance_requests
    WHERE id = p_request_id;

    IF v_req_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found.');
    END IF;

    -- Verify Leader
    IF NOT EXISTS (SELECT 1 FROM public.alliances WHERE id = v_req_alliance_id AND leader_id = v_leader_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
    END IF;

    -- Update User Profile (Add to alliance)
    UPDATE public.profiles
    SET alliance_id = v_req_alliance_id
    WHERE id = v_req_user_id;

    -- Increment Count
    UPDATE public.alliances
    SET member_count = member_count + 1
    WHERE id = v_req_alliance_id;

    -- Delete Request (and any other requests by this user?)
    DELETE FROM public.alliance_requests WHERE id = p_request_id;
    -- Optionally delete other requests by this user:
    DELETE FROM public.alliance_requests WHERE user_id = v_req_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 5. REJECT REQUEST
-- =====================================================
CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_leader_id UUID := auth.uid();
    v_req_alliance_id UUID;
BEGIN
    -- Get request alliance
    SELECT alliance_id INTO v_req_alliance_id
    FROM public.alliance_requests
    WHERE id = p_request_id;

    IF v_req_alliance_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found.');
    END IF;

    -- Verify Leader
    IF NOT EXISTS (SELECT 1 FROM public.alliances WHERE id = v_req_alliance_id AND leader_id = v_leader_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
    END IF;

    -- Delete Request
    DELETE FROM public.alliance_requests WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GET ALLIANCE REQUESTS (For Leader)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_alliance_requests()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_my_alliance_id UUID;
    v_result JSONB;
BEGIN
    -- Find alliance
    SELECT id INTO v_my_alliance_id 
    FROM public.alliances 
    WHERE leader_id = v_user_id 
    LIMIT 1;

    -- If no alliance found for this leader
    IF v_my_alliance_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Aggregate results to JSON
    SELECT jsonb_agg(t) INTO v_result
    FROM (
        SELECT 
            ar.id as request_id, 
            ar.user_id, 
            COALESCE(p.username, 'Unknown') as username, 
            p.avatar_id, 
            ar.created_at
        FROM public.alliance_requests ar
        LEFT JOIN public.profiles p ON ar.user_id = p.id
        WHERE ar.alliance_id = v_my_alliance_id
        ORDER BY ar.created_at ASC
    ) t;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- 7. GET MY REQUESTS (For User)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_requests()
RETURNS TABLE (
    alliance_id UUID,
    alliance_name TEXT
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    RETURN QUERY
    SELECT 
        ar.alliance_id,
        a.name
    FROM public.alliance_requests ar
    JOIN public.alliances a ON ar.alliance_id = a.id
    WHERE ar.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.alliance_requests TO authenticated;
