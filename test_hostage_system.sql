-- =====================================================
-- HOSTAGE SYSTEM TEST SCRIPT
-- Returns a table of logs instead of RAISE NOTICE
-- =====================================================

CREATE OR REPLACE FUNCTION public.test_hostage_flow()
RETURNS TABLE(log_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attacker_id uuid;
    v_defender_id uuid;
    v_battle_result json;
    v_stats record;
    v_initial_hostages int;
    v_final_hostages int;
    v_initial_citizens int;
    v_final_citizens int;
BEGIN
    v_attacker_id := auth.uid();
    
    -- 1. Setup Test Users
    -- Find a suitable defender (e.g., Mr. Waffles or anyone else)
    SELECT id INTO v_defender_id FROM public.profiles WHERE username = 'mrwaffles' LIMIT 1;
    
    IF v_defender_id IS NULL THEN
        SELECT id INTO v_defender_id FROM public.profiles WHERE id != v_attacker_id LIMIT 1;
    END IF;
    
    log_message := 'Attacker: ' || v_attacker_id || ', Defender: ' || v_defender_id;
    RETURN NEXT;

    -- 2. Give Attacker Resources for Testing
    UPDATE public.user_stats 
    SET gold = 1000000000, 
        turns = 500,
        attack_soldiers = 10000,
        research_hostage_convert = 0, -- Reset research
        hostages = 0,
        citizens = 10 -- Ensure baseline
    WHERE id = v_attacker_id;

    -- Give Defender Resources
    UPDATE public.user_stats
    SET defense_soldiers = 5000,
        gold = 1000000
    WHERE id = v_defender_id;
    
    PERFORM public.recalculate_user_stats(v_attacker_id);
    PERFORM public.recalculate_user_stats(v_defender_id);

    log_message := 'Resources Set. Upgrading Research...';
    RETURN NEXT;

    -- 3. Verify Research Cost/Upgrade (Level 0 -> 1)
    PERFORM public.upgrade_research_hostage_convert();
    
    SELECT research_hostage_convert INTO v_stats FROM public.user_stats WHERE id = v_attacker_id;
    log_message := 'Research Level: ' || v_stats.research_hostage_convert || ' (Expected 1)';
    RETURN NEXT;
    
    -- 4. Battle Simulation
    log_message := 'Attacking...';
    RETURN NEXT;
    
    v_battle_result := public.attack_player(v_defender_id);
    log_message := 'Battle Result: ' || v_battle_result::text;
    RETURN NEXT;

    -- 5. Verify Hostages Gained
    SELECT hostages, citizens INTO v_stats FROM public.user_stats WHERE id = v_attacker_id;
    v_initial_hostages := v_stats.hostages;
    v_initial_citizens := v_stats.citizens;
    
    log_message := 'Hostages Owned: ' || v_stats.hostages;
    RETURN NEXT;
    
    IF v_stats.hostages > 0 THEN
        log_message := 'SUCCESS: Hostages captured!';
        RETURN NEXT;
        
        -- 6. Verify Conversion
        log_message := 'Converting 1 Hostage...';
        RETURN NEXT;
        
        PERFORM public.convert_hostages_to_citizens(1);
        
        SELECT hostages, citizens INTO v_stats FROM public.user_stats WHERE id = v_attacker_id;
        v_final_hostages := v_stats.hostages;
        v_final_citizens := v_stats.citizens;
        
        log_message := 'Post-Conversion - Hostages: ' || v_final_hostages || ' (Was ' || v_initial_hostages || '), Citizens: ' || v_final_citizens || ' (Was ' || v_initial_citizens || ')';
        RETURN NEXT;
        
        IF v_final_hostages = v_initial_hostages - 1 AND v_final_citizens = v_initial_citizens + 1 THEN
             log_message := 'SUCCESS: Conversion worked perfectly.';
             RETURN NEXT;
        ELSE
             log_message := 'FAILURE: Conversion math mismatch.';
             RETURN NEXT;
        END IF;
        
    ELSE
        log_message := 'WARNING: No hostages captured. (Casualties might be 0 or small sample size)';
        RETURN NEXT;
    END IF;

END;
$$;
