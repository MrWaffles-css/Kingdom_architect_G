-- =====================================================
-- UPDATE: Add resource generation to combat functions
-- =====================================================
-- This updates attack_player and spy_player to automatically
-- generate resources for both players before processing the action
-- Run this AFTER add_serverside_resources.sql

-- Helper function to generate resources for a specific user
CREATE OR REPLACE FUNCTION public.generate_resources_for_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_result json;
BEGIN
    -- Temporarily set the user context
    PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
    
    -- Generate resources (this will update the user_stats)
    SELECT public.generate_resources() INTO v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update attack_player to generate resources first
CREATE OR REPLACE FUNCTION public.attack_player(
    target_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
    v_defender_profile record;
    v_attacker_profile record;
    v_gold_stolen bigint;
    v_turn_cost int := 100;
    v_casualty_count bigint;
    v_stat_loss bigint;
    v_raw_casualties float;
    v_vault_cap bigint;
    v_kill_rate float;
    v_loss_rate float;
BEGIN
    v_attacker_id := auth.uid();

    -- Self-attack check
    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot attack yourself';
    END IF;

    -- Generate resources for both attacker and defender FIRST
    PERFORM public.generate_resources_for_user(v_attacker_id);
    PERFORM public.generate_resources_for_user(target_id);

    -- Get Attacker Stats & Profile (AFTER resource generation)
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    SELECT * INTO v_attacker_profile FROM public.profiles WHERE id = v_attacker_id;

    -- Check Turns
    IF v_attacker_stats.turns < v_turn_cost THEN
        RAISE EXCEPTION 'Not enough turns (Need 100)';
    END IF;

    -- Get Defender Stats & Profile (AFTER resource generation)
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    SELECT * INTO v_defender_profile FROM public.profiles WHERE id = target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target not found';
    END IF;

    -- Deduct Turns
    UPDATE public.user_stats
    SET turns = turns - v_turn_cost
    WHERE id = v_attacker_id;

    -- Combat Logic
    IF v_attacker_stats.attack > v_defender_stats.defense THEN
        -- === VICTORY ===
        v_gold_stolen := v_defender_stats.gold;
        
        -- Calculate Defender Casualties (0-2% of Defense Soldiers)
        v_kill_rate := random() * 0.02;
        v_raw_casualties := COALESCE(v_defender_stats.defense_soldiers, 0) * v_kill_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);
        
        -- Calculate Vault Capacity for Attacker
        v_vault_cap := public.calculate_vault_capacity(COALESCE(v_attacker_stats.vault_level, 0));
        
        -- Update Attacker (Gain Gold to Vault, capped)
        UPDATE public.user_stats
        SET vault = LEAST(vault + v_gold_stolen, v_vault_cap),
            experience = experience + 100
        WHERE id = v_attacker_id;

        -- Update Defender (Lose Gold, Soldiers)
        -- Note: We recalculate stats after losing soldiers
        UPDATE public.user_stats
        SET gold = 0,
            defense_soldiers = GREATEST(0, defense_soldiers - v_casualty_count)
        WHERE id = target_id;
        
        -- Recalculate defender's stats after losing soldiers
        PERFORM public.recalculate_user_stats(target_id);

        -- Report for Attacker
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_win', 
            'Victory against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'gold_stolen', v_gold_stolen,
                'enemy_killed', v_casualty_count
            )
        );

        -- Report for Defender
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_loss', 
            'Defeat against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'gold_lost', v_gold_stolen,
                'soldiers_lost', v_casualty_count
            )
        );

        RETURN json_build_object(
            'success', true,
            'gold_stolen', v_gold_stolen,
            'casualties', v_casualty_count,
            'message', 'Victory! You breached their defenses and killed ' || v_casualty_count || ' defense soldiers.'
        );

    ELSE
        -- === DEFEAT ===
        
        -- Calculate Attacker Casualties (5-10% of Attack Soldiers)
        v_loss_rate := 0.05 + (random() * 0.05);
        v_raw_casualties := COALESCE(v_attacker_stats.attack_soldiers, 0) * v_loss_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);

        -- Update Attacker (Lose Soldiers)
        UPDATE public.user_stats
        SET attack_soldiers = GREATEST(0, attack_soldiers - v_casualty_count)
        WHERE id = v_attacker_id;
        
        -- Recalculate attacker's stats after losing soldiers
        PERFORM public.recalculate_user_stats(v_attacker_id);

        -- Report for Attacker
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_loss', 
            'Defeat against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'soldiers_lost', v_casualty_count
            )
        );

        -- Report for Defender
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_win', 
            'Victory against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'attacker_casualties', v_casualty_count
            )
        );

        RETURN json_build_object(
            'success', false,
            'gold_stolen', 0,
            'casualties', v_casualty_count,
            'message', 'Defeat! Your forces were repelled.'
        );
    END IF;
END;
$$;
