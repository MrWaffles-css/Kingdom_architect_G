-- Fix buy_weapon signature mismatch
-- The database has buy_weapon(p_weapon_type, ...) but frontend calls buy_weapon(p_type, ...)
-- This migration aligns them to p_type to match the frontend call.

-- Drop the function with the old signature if it exists to clean up
DROP FUNCTION IF EXISTS public.buy_weapon(text, int, int);

-- Recreate buy_weapon using game_weapon_configs table
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
    v_use_vault boolean;
    v_vault_gold bigint;
    v_available_gold bigint;
    v_gold_paid bigint;
    v_vault_paid bigint;
    us record; 
BEGIN
    v_user_id := auth.uid();
    
    -- Validate inputs
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    
    -- Get Config Cost
    SELECT cost INTO v_cost_per_unit
    FROM public.game_weapon_configs
    WHERE weapon_type = p_type AND tier = p_tier;

    IF v_cost_per_unit IS NULL THEN
        RAISE EXCEPTION 'Invalid weapon type or tier';
    END IF;

    -- Get user stats
    SELECT gold, research_weapons, use_vault_gold, vault 
    INTO v_current_gold, v_research_level, v_use_vault, v_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    IF v_research_level IS NULL THEN v_research_level := 0; END IF;

    -- Check if unlocked
    IF p_tier > 0 AND p_tier > v_research_level THEN
        RAISE EXCEPTION 'Weapon tier not yet researched';
    END IF;

    v_total_cost := v_cost_per_unit * p_quantity;

    -- Calculate Available Gold (including Vault if enabled)
    v_available_gold := v_current_gold;
    IF v_use_vault THEN
        v_available_gold := v_available_gold + COALESCE(v_vault_gold, 0);
    END IF;

    IF v_available_gold < v_total_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Spend Gold
    v_gold_paid := LEAST(v_current_gold, v_total_cost);
    v_vault_paid := v_total_cost - v_gold_paid;

    IF v_vault_paid > 0 AND NOT v_use_vault THEN
         RAISE EXCEPTION 'Not enough gold (Vault spending disabled)';
    END IF;

    -- Update Balances
    UPDATE public.user_stats
    SET gold = gold - v_gold_paid,
        vault = vault - v_vault_paid
    WHERE id = v_user_id;

    -- Add Weapon
    INSERT INTO public.user_weapons (user_id, weapon_type, tier, quantity)
    VALUES (v_user_id, p_type, p_tier, p_quantity)
    ON CONFLICT (user_id, weapon_type, tier)
    DO UPDATE SET quantity = user_weapons.quantity + p_quantity, updated_at = now();

    -- Recalculate stats immediately
    PERFORM recalculate_user_stats(v_user_id);

    -- Return updated stats
    SELECT * INTO us FROM public.user_stats WHERE id = v_user_id;
    RETURN row_to_json(us);
END;
$$;
