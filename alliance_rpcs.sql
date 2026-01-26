-- =====================================================
-- 1. CREATE ALLIANCE
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_alliance(p_name TEXT, p_description TEXT)
RETURNS JSONB AS $$
DECLARE
    new_alliance_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- Check if user is already in an alliance
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND alliance_id IS NOT NULL) THEN
        RETURN jsonb_build_object('success', false, 'message', 'You are already in an alliance.');
    END IF;

    -- Check if name exists
    IF EXISTS (SELECT 1 FROM public.alliances WHERE lower(name) = lower(p_name)) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Alliance name already taken.');
    END IF;

    -- Create Alliance
    INSERT INTO public.alliances (name, description, leader_id)
    VALUES (p_name, p_description, v_user_id)
    RETURNING id INTO new_alliance_id;

    -- Update User Profile
    UPDATE public.profiles
    SET alliance_id = new_alliance_id
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'alliance_id', new_alliance_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 2. JOIN ALLIANCE
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

    -- Check alliance logic (later: caps, open/closed)
    
    -- Update User
    UPDATE public.profiles
    SET alliance_id = p_alliance_id
    WHERE id = v_user_id;

    -- Increment Member Count
    UPDATE public.alliances
    SET member_count = member_count + 1
    WHERE id = p_alliance_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 3. LEAVE ALLIANCE
-- =====================================================
CREATE OR REPLACE FUNCTION public.leave_alliance()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_alliance_id UUID;
    v_is_leader BOOLEAN;
BEGIN
    -- Get current alliance info
    SELECT alliance_id INTO v_alliance_id 
    FROM public.profiles 
    WHERE id = v_user_id;

    IF v_alliance_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'You are not in an alliance.');
    END IF;

    -- Check if leader
    SELECT (leader_id = v_user_id) INTO v_is_leader
    FROM public.alliances
    WHERE id = v_alliance_id;

    IF v_is_leader THEN
        -- DISBAND for now (simple V1)
        -- Remove alliance_id from all members
        UPDATE public.profiles
        SET alliance_id = NULL
        WHERE alliance_id = v_alliance_id;

        -- Delete Alliance (cascade will handle messages?)
        DELETE FROM public.alliances WHERE id = v_alliance_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'Alliance disbanded.');
    ELSE
        -- Just leave
        UPDATE public.profiles
        SET alliance_id = NULL
        WHERE id = v_user_id;

        -- Decrement count
        UPDATE public.alliances
        SET member_count = member_count - 1
        WHERE id = v_alliance_id;

        RETURN jsonb_build_object('success', true, 'message', 'Left alliance.');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 4. SEND ALLIANCE MESSAGE
-- =====================================================
CREATE OR REPLACE FUNCTION public.send_alliance_message(p_message TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_alliance_id UUID;
BEGIN
    SELECT alliance_id INTO v_alliance_id FROM public.profiles WHERE id = v_user_id;

    IF v_alliance_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not in an alliance.');
    END IF;

    INSERT INTO public.alliance_messages (alliance_id, sender_id, message)
    VALUES (v_alliance_id, v_user_id, p_message);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 5. GET SHARED SPY REPORTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_shared_spy_reports(p_target_id UUID)
RETURNS TABLE (
    id UUID,
    attacker_id UUID,
    attacker_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    hours_old FLOAT,
    data JSONB -- flexible return of report data
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_my_alliance_id UUID;
BEGIN
    -- Get my alliance
    SELECT alliance_id INTO v_my_alliance_id FROM public.profiles WHERE id = v_user_id;

    IF v_my_alliance_id IS NULL THEN
        RETURN; -- No shared intel if not in alliance
    END IF;

    RETURN QUERY
    SELECT 
        sr.id,
        sr.attacker_id,
        p.username as attacker_name,
        sr.created_at,
        EXTRACT(EPOCH FROM (now() - sr.created_at)) / 3600.0 as hours_old,
        to_jsonb(sr.*) as data
    FROM public.spy_reports sr
    JOIN public.profiles p ON sr.attacker_id = p.id
    WHERE 
        sr.defender_id = p_target_id
        AND p.alliance_id = v_my_alliance_id
        AND sr.attacker_id != v_user_id -- Don't show my own here? Or show all? Show mine too is fine, but UI might filter. Let's show all.
        -- Actually distinct on attacker? No, show history.
    ORDER BY sr.created_at DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
