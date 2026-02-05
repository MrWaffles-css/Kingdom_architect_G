-- Create game_config_variables table for hardcoded mechanics
CREATE TABLE IF NOT EXISTS public.game_config_variables (
    key TEXT PRIMARY KEY,
    value NUMERIC NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

-- Insert defaults if not exist
INSERT INTO public.game_config_variables (key, value, description)
VALUES 
    ('spy_sentry_ratio', 1.0, 'Multiplier for defender sentry strength vs spies. Higher means harder to spy.'),
    ('defense_kill_rate_min', 0.00, 'Minimum percentage of defense soldiers killed in a lost battle (0.00 = 0%).'),
    ('defense_kill_rate_max', 0.02, 'Maximum percentage of defense soldiers killed in a lost battle (0.02 = 2%).')
ON CONFLICT (key) DO NOTHING;

-- Function to get a config value
CREATE OR REPLACE FUNCTION public.get_game_config_variable(p_key TEXT, p_default NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_val NUMERIC;
BEGIN
    SELECT value INTO v_val FROM public.game_config_variables WHERE key = p_key;
    RETURN COALESCE(v_val, p_default);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a config value
CREATE OR REPLACE FUNCTION public.update_game_config_variable(p_key TEXT, p_value NUMERIC)
RETURNS JSONB AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
    IF NOT COALESCE(v_is_admin, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin only');
    END IF;

    INSERT INTO public.game_config_variables (key, value, description, updated_at, updated_by)
    VALUES (p_key, p_value, '', NOW(), auth.uid())
    ON CONFLICT (key) DO UPDATE
    SET value = p_value, updated_at = NOW(), updated_by = auth.uid();

    RETURN jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fetch all configs
CREATE OR REPLACE FUNCTION public.get_all_game_config_variables()
RETURNS TABLE (key TEXT, value NUMERIC, description TEXT, updated_at TIMESTAMPTZ) AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Admin only';
    END IF;
    RETURN QUERY SELECT g.key, g.value, g.description, g.updated_at FROM public.game_config_variables g ORDER BY g.key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update spy_player to use configuration
CREATE OR REPLACE FUNCTION public.spy_player(target_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
    v_defender_exists boolean;
    v_ratio numeric;
BEGIN
    v_attacker_id := auth.uid();
    v_ratio := public.get_game_config_variable('spy_sentry_ratio', 1.0);

    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot spy on yourself';
    END IF;

    -- Get Attacker Stats
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Your spy network is offline (Missing attacker stats).';
    END IF;

    -- SELF-HEALING: Check if target exists in STATS
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    
    IF NOT FOUND THEN
        -- Check if they exist in PROFILES at least
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = target_id) INTO v_defender_exists;
        
        IF v_defender_exists THEN
            RAISE NOTICE 'Target exists in Profiles but missing Stats. Auto-repairing...';
            -- Create default stats for them on the fly
            INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level)
            VALUES (target_id, 0, 600, 0, 0, 1, 2, 0)
            RETURNING * INTO v_defender_stats;
        ELSE
            RAISE EXCEPTION 'Target not found (ID does not exist)';
        END IF;
    END IF;

    -- Spy Logic
    -- Using the ratio config: Attacker Spy must be > (Defender Sentry * Ratio)
    -- e.g. Ratio 1.0 = 1:1. Ratio 2.0 = Attacker needs 2x Spy power. Ratio 0.5 = Attacker needs 0.5x Spy power.
    -- Preserving the variance logic from previous fixes but incorporating the ratio.
    IF (v_attacker_stats.spy * (0.8 + random() * 0.4)) > ((v_defender_stats.sentry * v_ratio) * (0.8 + random() * 0.4)) THEN
        -- SUCCESS: Insert Report
        INSERT INTO public.spy_reports (
            attacker_id, defender_id, 
            gold, vault, citizens, land,
            attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries, miners,
            kingdom_level, gold_mine_level, barracks_level, vault_level, library_level,
            research_weapons, research_attack, research_defense, research_spy, research_sentry, research_turns_per_min,
            hostages, research_hostage_convert
        ) VALUES (
            v_attacker_id, target_id,
            v_defender_stats.gold, v_defender_stats.vault, v_defender_stats.citizens, v_defender_stats.land,
            v_defender_stats.attack, v_defender_stats.defense, v_defender_stats.spy, v_defender_stats.sentry,
            v_defender_stats.attack_soldiers, v_defender_stats.defense_soldiers, v_defender_stats.spies, v_defender_stats.sentries, v_defender_stats.miners,
            v_defender_stats.kingdom_level, v_defender_stats.gold_mine_level, v_defender_stats.barracks_level, v_defender_stats.vault_level, v_defender_stats.library_level,
            v_defender_stats.research_weapons, v_defender_stats.research_attack, v_defender_stats.research_defense, v_defender_stats.research_spy, v_defender_stats.research_sentry, v_defender_stats.research_turns_per_min,
            v_defender_stats.hostages, v_defender_stats.research_hostage_convert
        );

        RETURN json_build_object(
            'success', true, 
            'message', 'Spy report generated successfully.',
            'data', json_build_object(
                'gold', v_defender_stats.gold,
                'vault', v_defender_stats.vault,
                'citizens', v_defender_stats.citizens,
                'land', v_defender_stats.land,
                'attack', v_defender_stats.attack,
                'defense', v_defender_stats.defense,
                'spy', v_defender_stats.spy,
                'sentry', v_defender_stats.sentry,
                'attack_soldiers', v_defender_stats.attack_soldiers,
                'defense_soldiers', v_defender_stats.defense_soldiers,
                'spies', v_defender_stats.spies,
                'sentries', v_defender_stats.sentries,
                'miners', v_defender_stats.miners,
                'hostages', v_defender_stats.hostages,
                'kingdom_level', v_defender_stats.kingdom_level,
                'gold_mine_level', v_defender_stats.gold_mine_level,
                'barracks_level', v_defender_stats.barracks_level,
                'vault_level', v_defender_stats.vault_level,
                'library_level', v_defender_stats.library_level,
                'research_weapons', v_defender_stats.research_weapons,
                'research_attack', v_defender_stats.research_attack,
                'research_defense', v_defender_stats.research_defense,
                'research_spy', v_defender_stats.research_spy,
                'research_sentry', v_defender_stats.research_sentry,
                'research_turns_per_min', v_defender_stats.research_turns_per_min,
                'research_hostage_convert', v_defender_stats.research_hostage_convert
            )
        );
    ELSE
        -- FAILURE
        RETURN json_build_object('success', false, 'message', 'Spy mission failed! Their sentries detected your agents.');
    END IF;
END;
$$;

-- Update attack_player to use configuration
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
    v_min_kill_rate numeric;
    v_max_kill_rate numeric;
    v_steal_pct float;
BEGIN
    v_attacker_id := auth.uid();
    v_min_kill_rate := public.get_game_config_variable('defense_kill_rate_min', 0.0);
    v_max_kill_rate := public.get_game_config_variable('defense_kill_rate_max', 0.02);

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
        
        -- Calculate Gold Stolen based on Research
        -- Get the steal percentage for the attacker's research level
        SELECT steal_percent INTO v_steal_pct 
        FROM public.gold_steal_configs 
        WHERE level = COALESCE(v_attacker_stats.research_gold_steal, 0);

        -- Fallback if configuration is missing (e.g. level higher than config)
        IF v_steal_pct IS NULL THEN
            -- Try to get the max level config
            SELECT steal_percent INTO v_steal_pct 
            FROM public.gold_steal_configs 
            ORDER BY level DESC LIMIT 1;
            
            -- Absolute fallback
            IF v_steal_pct IS NULL THEN
                v_steal_pct := 0.5; -- Default to 50%
            END IF;
        END IF;

        -- Calculate amount
        v_gold_stolen := floor(v_defender_stats.gold * v_steal_pct);
        
        -- Calculate Defender Casualties
        -- Use Configured rates
        v_kill_rate := v_min_kill_rate + (random() * (v_max_kill_rate - v_min_kill_rate));
        
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
        UPDATE public.user_stats
        SET gold = GREATEST(0, gold - v_gold_stolen),
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
                'enemy_killed', v_casualty_count,
                'steal_percent', v_steal_pct
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

        -- === OPTIMIZATION: Internal Achievement Tracking ===
        -- 1. Track Daily Attack
        PERFORM public.track_daily_attack();
        
        -- 2. Track Gold Stolen (if any)
        IF v_gold_stolen > 0 THEN
            PERFORM public.track_daily_gold_stolen(v_gold_stolen);
        END IF;

        -- 3. Check Rank Achievements
        PERFORM public.check_rank_achievements(v_attacker_id);
        -- ===================================================

        RETURN json_build_object(
            'success', true,
            'gold_stolen', v_gold_stolen,
            'casualties', v_casualty_count,
            'steal_percent', v_steal_pct,
            'message', 'Victory! You breached their defenses and stole ' || v_gold_stolen || ' gold.'
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
