-- Fix Buy Weapon Stats Update

-- 1. Ensure calculate_weapon_strength is correct
CREATE OR REPLACE FUNCTION calculate_weapon_strength(
    p_user_id UUID,
    p_weapon_type TEXT,
    p_soldier_count INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_base_strength CONSTANT INTEGER := 1; 
    v_total_strength BIGINT := 0;
    v_remaining_soldiers INTEGER := p_soldier_count;
    v_weapon RECORD;
    v_weapon_strength INTEGER;
    v_count INTEGER;
BEGIN
    if p_soldier_count IS NULL OR p_soldier_count <= 0 THEN
        RETURN 0;
    END IF;

    -- Get weapons for this type, ordered by tier (best first)
    FOR v_weapon IN 
        SELECT tier, quantity 
        FROM user_weapons 
        WHERE user_id = p_user_id 
        AND weapon_type = p_weapon_type 
        ORDER BY tier DESC
    LOOP
        EXIT WHEN v_remaining_soldiers <= 0;
        
        -- Get weapon strength based on tier
        v_weapon_strength := CASE v_weapon.tier
            WHEN 0 THEN 1
            WHEN 1 THEN 12
            WHEN 2 THEN 150
            WHEN 3 THEN 2000
            WHEN 4 THEN 25000
            WHEN 5 THEN 300000
            ELSE 1
        END;
        
        -- Calculate how many soldiers get this weapon
        v_count := LEAST(v_remaining_soldiers, v_weapon.quantity);
        
        -- Add strength: Unit Base + Weapon Strength
        v_total_strength := v_total_strength + (v_count * (v_base_strength + v_weapon_strength));
        v_remaining_soldiers := v_remaining_soldiers - v_count;
    END LOOP;
    
    -- Remaining soldiers without weapons have base strength
    IF v_remaining_soldiers > 0 THEN
        v_total_strength := v_total_strength + (v_remaining_soldiers * v_base_strength);
    END IF;
    
    RETURN v_total_strength;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure recalculate_user_stats works and updates the table
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

    -- Calculate strengths
    v_attack_strength := calculate_weapon_strength(p_user_id, 'attack', COALESCE(v_attack_soldiers, 0));
    v_defense_strength := calculate_weapon_strength(p_user_id, 'defense', COALESCE(v_defense_soldiers, 0));
    v_spy_strength := calculate_weapon_strength(p_user_id, 'spy', COALESCE(v_spies, 0));
    v_sentry_strength := calculate_weapon_strength(p_user_id, 'sentry', COALESCE(v_sentries, 0));

    -- Update user_stats
    UPDATE user_stats
    SET 
        attack = v_attack_strength,
        defense = v_defense_strength,
        spy = v_spy_strength,
        sentry = v_sentry_strength
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update buy_weapon to ensure it calls recalculate and returns full stats
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
    v_vault_gold bigint;
    v_use_vault boolean;
    v_available_gold bigint;
    v_gold_paid bigint;
    v_vault_paid bigint;
    us record; -- Used for row_to_json
BEGIN
    v_user_id := auth.uid();
    
    -- Validate inputs
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    IF p_tier < 0 OR p_tier > 5 THEN RAISE EXCEPTION 'Invalid tier'; END IF;

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

    -- Calculate Cost
    IF p_tier = 0 THEN v_cost_per_unit := 100;
    ELSIF p_tier = 1 THEN v_cost_per_unit := 1000;
    ELSIF p_tier = 2 THEN v_cost_per_unit := 10000;
    ELSIF p_tier = 3 THEN v_cost_per_unit := 100000;
    ELSIF p_tier = 4 THEN v_cost_per_unit := 1000000;
    ELSIF p_tier = 5 THEN v_cost_per_unit := 10000000;
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
