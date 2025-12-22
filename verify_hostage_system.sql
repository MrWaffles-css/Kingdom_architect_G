-- =====================================================
-- HOSTAGE SYSTEM VERIFICATION SCRIPT
-- =====================================================

DO $$
DECLARE
    v_attacker_id uuid;
    v_defender_id uuid;
    v_battle_result json;
    v_stats record;
BEGIN
    -- 1. Setup Test Users
    -- Assuming current user is attacker
    v_attacker_id := auth.uid();
    
    -- Find a suitable defender (e.g., Mr. Waffles or anyone else)
    SELECT id INTO v_defender_id FROM public.profiles WHERE username = 'mrwaffles' LIMIT 1;
    
    -- Fallback if mrwaffles doesn't exist, pick any other user
    IF v_defender_id IS NULL THEN
        SELECT id INTO v_defender_id FROM public.profiles WHERE id != v_attacker_id LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Attacker: %, Defender: %', v_attacker_id, v_defender_id;

    -- 2. Give Attacker Resources for Testing
    UPDATE public.user_stats 
    SET gold = 1000000000, 
        turns = 500,
        attack_soldiers = 10000,
        research_hostage_convert = 0, -- Reset research
        hostages = 0
    WHERE id = v_attacker_id;

    -- Give Defender Resources
    UPDATE public.user_stats
    SET defense_soldiers = 5000,
        gold = 1000000
    WHERE id = v_defender_id;

    -- 3. Verify Research Cost/Upgrade (Level 0 -> 1)
    -- Expected Cost: 100,000
    RAISE NOTICE 'Upgrading Research to Level 1...';
    PERFORM public.upgrade_research_hostage_convert();
    
    SELECT research_hostage_convert INTO v_stats FROM public.user_stats WHERE id = v_attacker_id;
    RAISE NOTICE 'Research Level: % (Expected 1)', v_stats.research_hostage_convert;
    
    -- 4. Battle Simulation
    RAISE NOTICE 'Attacking...';
    v_battle_result := public.attack_player(v_defender_id);
    RAISE NOTICE 'Battle Result: %', v_battle_result;

    -- 5. Verify Hostages Gained
    SELECT hostages INTO v_stats FROM public.user_stats WHERE id = v_attacker_id;
    RAISE NOTICE 'Hostages Owned: %', v_stats.hostages;
    
    IF v_stats.hostages > 0 THEN
        RAISE NOTICE 'SUCCESS: Hostages captured!';
    ELSE
        RAISE NOTICE 'WARNING: No hostages captured (Did you win? Did you kill soldiers?)';
    END IF;

    -- 6. Verify Conversion
    RAISE NOTICE 'Converting 1 Hostage...';
    PERFORM public.convert_hostages_to_citizens(1);
    
    SELECT hostages, citizens INTO v_stats FROM public.user_stats WHERE id = v_attacker_id;
    RAISE NOTICE 'Post-Conversion - Hostages: %, Citizens: %', v_stats.hostages, v_stats.citizens;

END $$;
