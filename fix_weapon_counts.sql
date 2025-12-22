-- Fix Weapon Counts in User Stats
-- The Tutorial expects 'stats.attack_weapons' to exist, but the weapon system
-- stored counts in a separate 'user_weapons' table without aggregating them back to 'user_stats'.
-- This script adds the aggregate columns and ensures they are updated.

-- 1. Add aggregate columns to user_stats if they don't exist
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS attack_weapons int DEFAULT 0,
ADD COLUMN IF NOT EXISTS defense_weapons int DEFAULT 0,
ADD COLUMN IF NOT EXISTS spy_weapons int DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentry_weapons int DEFAULT 0;

-- 2. Update buy_weapon to also update user_stats
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

    -- Deduct Gold & Update Aggregate Count
    UPDATE public.user_stats
    SET gold = gold - v_total_cost,
        attack_weapons = CASE WHEN p_type = 'attack' THEN COALESCE(attack_weapons, 0) + p_quantity ELSE attack_weapons END,
        defense_weapons = CASE WHEN p_type = 'defense' THEN COALESCE(defense_weapons, 0) + p_quantity ELSE defense_weapons END,
        spy_weapons = CASE WHEN p_type = 'spy' THEN COALESCE(spy_weapons, 0) + p_quantity ELSE spy_weapons END,
        sentry_weapons = CASE WHEN p_type = 'sentry' THEN COALESCE(sentry_weapons, 0) + p_quantity ELSE sentry_weapons END
    WHERE id = v_user_id;

    -- Add Weapon
    INSERT INTO public.user_weapons (user_id, weapon_type, tier, quantity)
    VALUES (v_user_id, p_type, p_tier, p_quantity)
    ON CONFLICT (user_id, weapon_type, tier)
    DO UPDATE SET quantity = user_weapons.quantity + p_quantity, updated_at = now();

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- 3. Update sell_weapon to also update user_stats
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

    -- Calculate Refund
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

    -- Add Refund & Update Aggregate Count
    UPDATE public.user_stats
    SET vault = COALESCE(vault, 0) + v_refund_total,
        attack_weapons = CASE WHEN p_type = 'attack' THEN GREATEST(0, COALESCE(attack_weapons, 0) - p_quantity) ELSE attack_weapons END,
        defense_weapons = CASE WHEN p_type = 'defense' THEN GREATEST(0, COALESCE(defense_weapons, 0) - p_quantity) ELSE defense_weapons END,
        spy_weapons = CASE WHEN p_type = 'spy' THEN GREATEST(0, COALESCE(spy_weapons, 0) - p_quantity) ELSE spy_weapons END,
        sentry_weapons = CASE WHEN p_type = 'sentry' THEN GREATEST(0, COALESCE(sentry_weapons, 0) - p_quantity) ELSE sentry_weapons END
    WHERE id = v_user_id;

    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- 4. Backfill existing data
WITH weapon_counts AS (
    SELECT 
        user_id,
        COALESCE(SUM(quantity) FILTER (WHERE weapon_type = 'attack'), 0) as total_attack,
        COALESCE(SUM(quantity) FILTER (WHERE weapon_type = 'defense'), 0) as total_defense,
        COALESCE(SUM(quantity) FILTER (WHERE weapon_type = 'spy'), 0) as total_spy,
        COALESCE(SUM(quantity) FILTER (WHERE weapon_type = 'sentry'), 0) as total_sentry
    FROM public.user_weapons
    GROUP BY user_id
)
UPDATE public.user_stats us
SET 
    attack_weapons = wc.total_attack,
    defense_weapons = wc.total_defense,
    spy_weapons = wc.total_spy,
    sentry_weapons = wc.total_sentry
FROM weapon_counts wc
WHERE us.id = wc.user_id;
