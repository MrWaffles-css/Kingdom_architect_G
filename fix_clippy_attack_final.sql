-- Fix Attack Logic for Clippy (Tutorial)
-- Ensures that attacking Clippy correctly inserts a report into the 'public.reports' table
-- so the tutorial can detect it.

CREATE OR REPLACE FUNCTION public.attack_player(target_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    
    -- New variables for steal logic
    v_steal_research_level int;
    v_base_steal_percent float := 0.50; 
    v_research_bonus float := 0.05;    
    v_final_steal_percent float;
    v_potential_gold bigint;
BEGIN
    v_attacker_id := auth.uid();

    -- Check Turns
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    IF v_attacker_stats.turns < v_turn_cost THEN
        RAISE EXCEPTION 'Not enough turns (Need 100)';
    END IF;

    -- HANDLE CLIPPY (TUTORIAL)
    IF target_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        -- Deduct Turns
        UPDATE public.user_stats SET turns = turns - v_turn_cost WHERE id = v_attacker_id;

        -- Create Report for Tutorial
        -- Crucial: Insert into public.reports for the ATTACKER
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_win', 
            'Victory against Clippy',
            json_build_object(
                'opponent_name', 'Clippy',
                'gold_stolen', 50,
                'casualties', 0
            )
        );
        
        -- Grant loot (Clippy gives 50 gold)
        UPDATE public.user_stats SET gold = gold + 50 WHERE id = v_attacker_id;

        RETURN json_build_object(
            'success', true,
            'gold_stolen', 50,
            'casualties', 0,
            'message', 'Victory! You defeated Clippy.'
        );
    END IF;

    -- REGULAR LOGIC START
    IF v_attacker_id = target_id THEN RAISE EXCEPTION 'Cannot attack yourself'; END IF;

    PERFORM public.generate_resources_for_user(v_attacker_id);
    PERFORM public.generate_resources_for_user(target_id);

    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    SELECT * INTO v_attacker_profile FROM public.profiles WHERE id = v_attacker_id;
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    SELECT * INTO v_defender_profile FROM public.profiles WHERE id = target_id;
    
    IF v_defender_stats IS NULL THEN RAISE EXCEPTION 'Target not found'; END IF;

    -- Deduct turns
    UPDATE public.user_stats SET turns = turns - v_turn_cost WHERE id = v_attacker_id;

    -- Combat Logic
    IF v_attacker_stats.attack > v_defender_stats.defense THEN
        -- WIN
        
        -- 1. Base Steal Calculation
        v_steal_research_level := COALESCE(v_attacker_stats.research_gold_steal, 0);
        v_final_steal_percent := v_base_steal_percent + (v_steal_research_level * v_research_bonus);
        v_potential_gold := FLOOR(v_defender_stats.gold * v_final_steal_percent);
        v_gold_stolen := v_potential_gold;

        -- 2. Vault Protection Check
        IF v_defender_stats.vault_level > 0 THEN
            IF v_defender_stats.vault_level = 1 THEN v_vault_cap := 100000;
            ELSIF v_defender_stats.vault_level = 2 THEN v_vault_cap := 500000;
            ELSIF v_defender_stats.vault_level = 3 THEN v_vault_cap := 1500000;
            ELSIF v_defender_stats.vault_level >= 4 THEN v_vault_cap := 5000000; 
            END IF;
        END IF;

        -- 3. Kill Rate (1% to 5% of enemy soldiers die)
        v_kill_rate := 0.01 + (random() * 0.04);
        v_raw_casualties := (v_defender_stats.attack_soldiers + v_defender_stats.defense_soldiers) * v_kill_rate;
        v_casualty_count := floor(v_raw_casualties);
        
        -- Transfer Gold
        UPDATE public.user_stats SET gold = gold - v_gold_stolen WHERE id = target_id;
        UPDATE public.user_stats SET gold = gold + v_gold_stolen WHERE id = v_attacker_id;

        -- Defender Loses Soldiers (approximate distribution)
        UPDATE public.user_stats 
        SET defense_soldiers = GREATEST(0, defense_soldiers - v_casualty_count)
        WHERE id = target_id;
        
        -- Recalculate
        PERFORM public.recalculate_user_stats(target_id);

        -- Reports
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 'attack_win', 
            'Victory against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object('opponent_name', COALESCE(v_defender_profile.username, 'Unknown'), 'gold_stolen', v_gold_stolen, 'casualties', v_casualty_count)
        );

        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 'defend_loss', 
            'Defeat against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object('opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'), 'gold_lost', v_gold_stolen, 'casualties', v_casualty_count)
        );

        RETURN json_build_object('success', true, 'gold_stolen', v_gold_stolen, 'casualties', v_casualty_count, 'message', 'Victory! You pillaged the enemy.');

    ELSE
        -- LOSE
        v_loss_rate := 0.02 + (random() * 0.03); -- 2-5% loss
        v_raw_casualties := (v_attacker_stats.attack_soldiers) * v_loss_rate;
        v_casualty_count := floor(v_raw_casualties);

        UPDATE public.user_stats SET attack_soldiers = GREATEST(0, attack_soldiers - v_casualty_count) WHERE id = v_attacker_id;
        PERFORM public.recalculate_user_stats(v_attacker_id);

        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (v_attacker_id, 'attack_loss', 'Defeat against ' || COALESCE(v_defender_profile.username, 'Unknown'), json_build_object('opponent_name', COALESCE(v_defender_profile.username, 'Unknown'), 'soldiers_lost', v_casualty_count));

        RETURN json_build_object('success', false, 'gold_stolen', 0, 'casualties', v_casualty_count, 'message', 'Defeat! Your forces were repelled.');
    END IF;
END;
$function$;
