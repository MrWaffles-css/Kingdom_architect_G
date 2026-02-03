-- Create table for hostage configuration
CREATE TABLE IF NOT EXISTS public.hostage_configs (
    id integer PRIMARY KEY DEFAULT 1,
    convert_cost_gold integer DEFAULT 2000,
    research_bonus_percent integer DEFAULT 10,
    research_costs jsonb DEFAULT '[100000, 200000, 500000, 750000, 1000000, 2000000, 10000000, 50000000, 100000000, 1000000000]'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default row if not exists
INSERT INTO public.hostage_configs (id, convert_cost_gold, research_bonus_percent, research_costs)
VALUES (1, 2000, 10, '[100000, 200000, 500000, 750000, 1000000, 2000000, 10000000, 50000000, 100000000, 1000000000]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS (though table is public read effectively through RPCs)
ALTER TABLE public.hostage_configs ENABLE ROW LEVEL SECURITY;

-- 1. Get Config RPC
CREATE OR REPLACE FUNCTION public.get_hostage_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT row_to_json(hostage_configs) FROM public.hostage_configs WHERE id = 1);
END;
$$;

-- 2. Update Config RPC
CREATE OR REPLACE FUNCTION public.update_hostage_config(
    p_convert_cost_gold integer,
    p_research_bonus_percent integer,
    p_research_costs jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.hostage_configs
    SET convert_cost_gold = p_convert_cost_gold,
        research_bonus_percent = p_research_bonus_percent,
        research_costs = p_research_costs,
        updated_at = now()
    WHERE id = 1;
    
    RETURN (SELECT row_to_json(hostage_configs) FROM public.hostage_configs WHERE id = 1);
END;
$$;

-- 3. Update Upgrade Research Function to use Config
CREATE OR REPLACE FUNCTION public.upgrade_research_hostage_convert()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_stats record;
    v_current_level int;
    v_cost bigint;
    v_available_gold bigint;
    v_config record;
    v_costs_array jsonb;
    v_array_len int;
BEGIN
    -- Fetch Config
    SELECT * INTO v_config FROM public.hostage_configs WHERE id = 1;
    v_costs_array := v_config.research_costs;
    v_array_len := jsonb_array_length(v_costs_array);

    SELECT * INTO v_stats FROM user_stats WHERE id = v_user_id;
    v_current_level := COALESCE(v_stats.research_hostage_convert, 0);

    -- Check if max level reached
    IF v_current_level >= v_array_len THEN
        RAISE EXCEPTION 'Max research level reached';
    END IF;

    -- Get Cost from JSON Array
    v_cost := (v_costs_array ->> v_current_level)::bigint;

    -- Calculate Available Gold (Vault + Gold if setting enabled)
    IF v_stats.use_vault_gold THEN
        v_available_gold := v_stats.gold + v_stats.vault;
    ELSE
        v_available_gold := v_stats.gold;
    END IF;

    IF v_available_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold (Need %)', v_cost;
    END IF;

    -- Deduct Cost
    IF v_stats.use_vault_gold THEN
         -- Prioritize Gold, then Vault
         IF v_stats.gold >= v_cost THEN
             UPDATE user_stats SET gold = gold - v_cost WHERE id = v_user_id;
         ELSE
             -- Drain gold, take rest from vault
             DECLARE
                 remaining_cost bigint := v_cost - v_stats.gold;
             BEGIN
                 UPDATE user_stats SET gold = 0, vault = vault - remaining_cost WHERE id = v_user_id;
             END;
         END IF;
    ELSE
        UPDATE user_stats SET gold = gold - v_cost WHERE id = v_user_id;
    END IF;

    -- Update Research Level
    UPDATE user_stats 
    SET research_hostage_convert = v_current_level + 1 
    WHERE id = v_user_id;

    -- Return updated stats
    RETURN (SELECT row_to_json(user_stats) FROM user_stats WHERE id = v_user_id);
END;
$$;

-- 4. Update Convert Hostages Function to use Config
CREATE OR REPLACE FUNCTION public.convert_hostages_to_citizens(p_quantity int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_stats record;
    v_cost_per_unit int;
    v_total_cost bigint;
    v_available_gold bigint;
    v_config record;
BEGIN
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

    -- Fetch Config
    SELECT * INTO v_config FROM public.hostage_configs WHERE id = 1;
    v_cost_per_unit := v_config.convert_cost_gold;

    SELECT * INTO v_stats FROM user_stats WHERE id = v_user_id;
    
    IF COALESCE(v_stats.hostages, 0) < p_quantity THEN
        RAISE EXCEPTION 'Not enough hostages';
    END IF;

    v_total_cost := p_quantity * v_cost_per_unit;

    -- Calculate Available Gold
    IF v_stats.use_vault_gold THEN
        v_available_gold := v_stats.gold + v_stats.vault;
    ELSE
        v_available_gold := v_stats.gold;
    END IF;

    IF v_available_gold < v_total_cost THEN
        RAISE EXCEPTION 'Not enough gold (Need %)', v_total_cost;
    END IF;

    -- Deduct Cost
    IF v_stats.use_vault_gold THEN
         IF v_stats.gold >= v_total_cost THEN
             UPDATE user_stats SET gold = gold - v_total_cost WHERE id = v_user_id;
         ELSE
             DECLARE
                 remaining_cost bigint := v_total_cost - v_stats.gold;
             BEGIN
                 UPDATE user_stats SET gold = 0, vault = vault - remaining_cost WHERE id = v_user_id;
             END;
         END IF;
    ELSE
        UPDATE user_stats SET gold = gold - v_total_cost WHERE id = v_user_id;
    END IF;

    -- Execute Conversion
    UPDATE user_stats
    SET hostages = hostages - p_quantity,
        citizens = citizens + p_quantity
    WHERE id = v_user_id;

    RETURN (SELECT row_to_json(user_stats) FROM user_stats WHERE id = v_user_id);
END;
$$;

-- 5. Update Attack Function to use Config for Hostage Capture Rate
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
    
    -- Hostage Variables
    v_hostages_captured bigint := 0;
    v_hostage_rate float;
    v_config record;
    v_base_percent int;
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
        
        -- Calculate Hostage Capture
        -- Fetch Config for Rate
        SELECT * INTO v_config FROM public.hostage_configs WHERE id = 1;
        v_base_percent := COALESCE(v_config.research_bonus_percent, 10);
        
        -- Rate: v_base_percent% per research level
        v_hostage_rate := (COALESCE(v_attacker_stats.research_hostage_convert, 0) * v_base_percent)::float / 100.0;
        
        IF v_hostage_rate > 0 AND v_casualty_count > 0 THEN
            v_hostages_captured := floor(v_casualty_count * v_hostage_rate);
        END IF;

        -- Calculate Vault Capacity for Attacker
        v_vault_cap := public.calculate_vault_capacity(COALESCE(v_attacker_stats.vault_level, 0));
        
        -- Update Attacker (Gain Gold to Vault, Gain Hostages)
        UPDATE public.user_stats
        SET vault = LEAST(vault + v_gold_stolen, v_vault_cap),
            experience = experience + 100,
            hostages = COALESCE(hostages, 0) + v_hostages_captured
        WHERE id = v_attacker_id;

        -- Update Defender (Lose Gold, Soldiers)
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
                'enemy_killed', v_casualty_count,
                'hostages_captured', v_hostages_captured
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
        PERFORM public.track_daily_attack();
        IF v_gold_stolen > 0 THEN
            PERFORM public.track_daily_gold_stolen(v_gold_stolen);
        END IF;
        PERFORM public.check_rank_achievements(v_attacker_id);
        -- ===================================================

        RETURN json_build_object(
            'success', true,
            'gold_stolen', v_gold_stolen,
            'casualties', v_casualty_count,
            'hostages_captured', v_hostages_captured,
            'message', 'Victory! Killed ' || v_casualty_count || ' soldiers. Captured ' || v_hostages_captured || ' hostages.'
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
