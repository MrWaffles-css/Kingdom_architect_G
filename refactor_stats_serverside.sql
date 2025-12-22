-- =====================================================
-- REFACTOR: Move weapon strength calculation to server-side
-- =====================================================
-- This script updates the weapon and training functions to automatically
-- recalculate and store total strength in user_stats whenever changes occur.
-- Run this AFTER add_weapon_system.sql and fix_spy_weapon_stats.sql

-- =====================================================
-- HELPER: Recalculate all stats for a user
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_attack_soldiers INTEGER;
    v_defense_soldiers INTEGER;
    v_spies INTEGER;
    v_sentries INTEGER;
    v_attack_strength BIGINT;
    v_defense_strength BIGINT;
    v_spy_strength BIGINT;
    v_sentry_strength BIGINT;
BEGIN
    -- Get current soldier counts
    SELECT attack_soldiers, defense_soldiers, spies, sentries
    INTO v_attack_soldiers, v_defense_soldiers, v_spies, v_sentries
    FROM user_stats
    WHERE id = p_user_id;

    -- Calculate strengths using the weapon calculation function
    v_attack_strength := calculate_weapon_strength(p_user_id, 'attack', COALESCE(v_attack_soldiers, 0));
    v_defense_strength := calculate_weapon_strength(p_user_id, 'defense', COALESCE(v_defense_soldiers, 0));
    v_spy_strength := calculate_weapon_strength(p_user_id, 'spy', COALESCE(v_spies, 0));
    v_sentry_strength := calculate_weapon_strength(p_user_id, 'sentry', COALESCE(v_sentries, 0));

    -- Update user_stats with calculated values
    UPDATE user_stats
    SET 
        attack = v_attack_strength,
        defense = v_defense_strength,
        spy = v_spy_strength,
        sentry = v_sentry_strength
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- UPDATE: buy_weapon function
-- =====================================================
DROP FUNCTION IF EXISTS buy_weapon(text, int, int);
CREATE OR REPLACE FUNCTION public.buy_weapon(p_type text, p_tier int, p_quantity int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_research_level int;
    v_cost_per_unit bigint;
    v_total_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Validate inputs
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    IF p_tier < 0 OR p_tier > 5 THEN RAISE EXCEPTION 'Invalid tier'; END IF;

    -- Get user stats
    SELECT gold, research_weapons INTO v_current_gold, v_research_level
    FROM public.user_stats
    WHERE id = v_user_id;

    IF v_research_level IS NULL THEN v_research_level := 0; END IF;

    -- Check if unlocked
    IF p_tier > 0 AND p_tier > v_research_level THEN
        RAISE EXCEPTION 'Weapon tier not yet researched';
    END IF;

    -- Calculate Cost
    IF p_tier = 0 THEN v_cost_per_unit := 100;
    ELSIF p_tier = 1 THEN v_cost_per_unit := 1000;
    ELSIF p_tier = 2 THEN v_cost_per_unit := 10000;
    ELSIF p_tier = 3 THEN v_cost_per_unit := 100000;
    ELSIF p_tier = 4 THEN v_cost_per_unit := 1000000;
    ELSIF p_tier = 5 THEN v_cost_per_unit := 10000000;
    END IF;

    v_total_cost := v_cost_per_unit * p_quantity;

    IF v_current_gold < v_total_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold
    UPDATE public.user_stats
    SET gold = gold - v_total_cost
    WHERE id = v_user_id;

    -- Add Weapon
    INSERT INTO public.user_weapons (user_id, weapon_type, tier, quantity)
    VALUES (v_user_id, p_type, p_tier, p_quantity)
    ON CONFLICT (user_id, weapon_type, tier)
    DO UPDATE SET quantity = user_weapons.quantity + p_quantity, updated_at = now();

    -- Recalculate stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- =====================================================
-- UPDATE: sell_weapon function
-- =====================================================
DROP FUNCTION IF EXISTS sell_weapon(text, int, int);
CREATE OR REPLACE FUNCTION public.sell_weapon(p_type text, p_tier int, p_quantity int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_quantity int;
    v_cost_per_unit bigint;
    v_refund_total bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

    -- Check ownership
    SELECT quantity INTO v_current_quantity
    FROM public.user_weapons
    WHERE user_id = v_user_id AND weapon_type = p_type AND tier = p_tier;

    IF v_current_quantity IS NULL OR v_current_quantity < p_quantity THEN
        RAISE EXCEPTION 'Not enough weapons to sell';
    END IF;

    -- Calculate Refund (50% of cost)
    IF p_tier = 0 THEN v_cost_per_unit := 100;
    ELSIF p_tier = 1 THEN v_cost_per_unit := 1000;
    ELSIF p_tier = 2 THEN v_cost_per_unit := 10000;
    ELSIF p_tier = 3 THEN v_cost_per_unit := 100000;
    ELSIF p_tier = 4 THEN v_cost_per_unit := 1000000;
    ELSIF p_tier = 5 THEN v_cost_per_unit := 10000000;
    END IF;

    v_refund_total := floor((v_cost_per_unit * p_quantity) * 0.5);

    -- Remove Weapons
    UPDATE public.user_weapons
    SET quantity = quantity - p_quantity,
        updated_at = now()
    WHERE user_id = v_user_id AND weapon_type = p_type AND tier = p_tier;

    -- Add Refund to Vault (Ignore Capacity)
    UPDATE public.user_stats
    SET vault = COALESCE(vault, 0) + v_refund_total
    WHERE id = v_user_id;

    -- Recalculate stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- =====================================================
-- UPDATE: train_units function
-- =====================================================
-- First, let's check if this function exists and update it
DROP FUNCTION IF EXISTS train_units(text, int);
CREATE OR REPLACE FUNCTION public.train_units(p_unit_type text, p_quantity int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_current_citizens int;
    v_cost bigint;
    v_new_stats json;
    v_use_vault boolean;
    v_vault_gold bigint;
    v_available_gold bigint;
BEGIN
    v_user_id := auth.uid();
    
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

    -- Get user stats
    SELECT gold, citizens, use_vault_gold, vault
    INTO v_current_gold, v_current_citizens, v_use_vault, v_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Calculate available gold
    v_available_gold := v_current_gold;
    IF v_use_vault THEN
        v_available_gold := v_available_gold + COALESCE(v_vault_gold, 0);
    END IF;

    -- Calculate cost (1000 gold per unit)
    v_cost := p_quantity * 1000;

    -- Validate
    IF v_current_citizens < p_quantity THEN
        RAISE EXCEPTION 'Not enough citizens';
    END IF;

    IF v_available_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct gold (from main gold first, then vault if needed)
    IF v_current_gold >= v_cost THEN
        UPDATE public.user_stats
        SET gold = gold - v_cost
        WHERE id = v_user_id;
    ELSE
        -- Use all main gold, rest from vault
        UPDATE public.user_stats
        SET gold = 0,
            vault = vault - (v_cost - v_current_gold)
        WHERE id = v_user_id;
    END IF;

    -- Deduct citizens and add units
    IF p_unit_type = 'attack' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            attack_soldiers = attack_soldiers + p_quantity
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'defense' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            defense_soldiers = defense_soldiers + p_quantity
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'spy' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            spies = spies + p_quantity
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'sentry' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            sentries = sentries + p_quantity
        WHERE id = v_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid unit type';
    END IF;

    -- Recalculate stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- =====================================================
-- MIGRATION: Recalculate all existing users' stats
-- =====================================================
-- This ensures all existing players have correct calculated stats
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM user_stats LOOP
        PERFORM recalculate_user_stats(v_user.id);
    END LOOP;
END $$;
