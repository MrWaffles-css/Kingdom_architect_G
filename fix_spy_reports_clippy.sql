-- Fix Spy and Attack logic for fake Clippy ID (Updated)
-- Now ensures spy_reports is also populated for tutorial consistency

-- =====================================================
-- 1. Fix spy_player to handle Clippy
-- =====================================================
CREATE OR REPLACE FUNCTION public.spy_player(target_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    my_spy BIGINT;
    their_sentry BIGINT;
    target_stats RECORD;
    my_research_level INTEGER;
    steal_percent NUMERIC;
    stolen_amount BIGINT := 0;
    result JSONB;
BEGIN
    -- HANDLE CLIPPY (TUTORIAL)
    IF target_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        -- Insert fake report for tutorial detection
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            auth.uid(),
            'spy_report',
            'Spy Report: Clippy',
            json_build_object(
                'gold', 50,
                'citizens', 10,
                'attack', 1,
                'defense', 1,
                'spy', 0,
                'sentry', 0,
                'from_tut', true
            )
        );

        -- KEY FIX: Also insert into spy_reports for redundancy/consistency
        INSERT INTO public.spy_reports (
            spy_user_id, target_user_id,
            gold, citizens, attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries,
            spied_at
        ) VALUES (
            auth.uid(), target_id,
            50, 10, 1, 1, 0, 0,
            0, 0, 0, 0,
            NOW()
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Success! You spied on Clippy.',
            'data', jsonb_build_object(
                'gold', 50,
                'citizens', 10,
                'attack', 1,
                'defense', 1,
                'spy', 0, 
                'sentry', 0,
                'attack_soldiers', 0,
                'defense_soldiers', 0,
                'spies', 0,
                'sentries', 0
            )
        );
    END IF;

    -- REGULAR LOGIC
    SELECT spy, research_vault_steal INTO my_spy, my_research_level 
    FROM user_stats 
    WHERE id = auth.uid();
    
    IF my_research_level IS NULL THEN my_research_level := 0; END IF;
    
    SELECT * INTO target_stats FROM user_stats WHERE id = target_id;
    their_sentry := target_stats.sentry;
    
    IF my_spy > their_sentry THEN
        
        -- Logic: Vault Steal (from add_vault_steal_research.sql)
        IF my_research_level > 0 AND target_stats.vault > 0 THEN
            steal_percent := my_research_level * 0.05;
            stolen_amount := FLOOR(target_stats.vault * steal_percent);
            
            IF stolen_amount > 0 THEN
                UPDATE user_stats
                SET vault = vault - stolen_amount
                WHERE id = target_id;
                
                UPDATE user_stats
                SET gold = gold + stolen_amount
                WHERE id = auth.uid();
            END IF;
        END IF;
    
        result := jsonb_build_object(
            'success', true,
            'message', 'Spy mission successful!',
            'data', jsonb_build_object(
                'gold', target_stats.gold,
                'citizens', target_stats.citizens,
                'attack', target_stats.attack,
                'defense', target_stats.defense,
                'spy', target_stats.spy,
                'sentry', target_stats.sentry,
                'attack_soldiers', target_stats.attack_soldiers,
                'defense_soldiers', target_stats.defense_soldiers,
                'spies', target_stats.spies,
                'sentries', target_stats.sentries,
                'vault_stolen', stolen_amount
            )
        );
        
        -- Create/Update Spy Report Entry
        INSERT INTO spy_reports (
            spy_user_id, target_user_id,
            gold, citizens, attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries,
            spied_at
        ) VALUES (
            auth.uid(), target_id,
            target_stats.gold, target_stats.citizens,
            target_stats.attack, target_stats.defense,
            target_stats.spy, target_stats.sentry,
            target_stats.attack_soldiers, target_stats.defense_soldiers,
            target_stats.spies, target_stats.sentries,
            NOW()
        )
        ON CONFLICT (spy_user_id, target_user_id)
        DO UPDATE SET
            gold = EXCLUDED.gold,
            citizens = EXCLUDED.citizens,
            attack = EXCLUDED.attack,
            defense = EXCLUDED.defense,
            spy = EXCLUDED.spy,
            sentry = EXCLUDED.sentry,
            attack_soldiers = EXCLUDED.attack_soldiers,
            defense_soldiers = EXCLUDED.defense_soldiers,
            spies = EXCLUDED.spies,
            sentries = EXCLUDED.sentries,
            spied_at = NOW();
            
        -- Also insert into reports for unified feed validation
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            auth.uid(),
            'spy_report',
            'Spy Report: ' || (SELECT username FROM profiles WHERE id = target_id),
            result
        );

        RETURN result;
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Your spies were detected! Their sentry rating is too high.'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Fallback for non-existent users
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Spy mission failed: Target not found or error.'
    );
END;
$function$;


-- =====================================================
-- 2. Fix attack_player to handle Clippy
-- =====================================================
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
    v_steal_multiplier float;
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
            ELSIF v_defender_stats.vault_level >= 4 THEN v_vault_cap := 5000000; -- Simplification
            END IF;
            -- If gold is protected by vault capacity (logic could be complex, assuming vault stores separate gold)
            -- Actually, simpler log: Vault Gold is SAFE. Main Gold is exposed.
            -- So the calculation stands.
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
