-- FIXED DB Update
-- Adds automatic "Resource Catch-Up" to ALL spending functions.

-- Helper: Ensure generate_resources_for_user allows manual calling if needed
CREATE OR REPLACE FUNCTION public.generate_resources_for_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_result json;
BEGIN
    -- Context switching hack for RLS to work properly inside RPCs if needed
    PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
    PERFORM public.generate_resources();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. BUY WEAPON (Dropping first to avoid signature conflicts)
DROP FUNCTION IF EXISTS public.buy_weapon(text, integer, integer);

CREATE OR REPLACE FUNCTION public.buy_weapon(
    p_type TEXT,        -- Renamed back to match original: p_type
    p_tier INTEGER,
    p_quantity INTEGER
)
RETURNS JSON AS $$
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
    
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);

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

    -- Calculate Cost (UPDATED PRICES from logic)
    -- Tier 0: 100
    -- Tier 1: 1,000
    -- Tier 2: 10,000
    -- Tier 3: 100,000
    -- Tier 4: 1,000,000
    -- Tier 5: 10,000,000
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. TRAIN UNITS (Soldiers, Spies, etc.)
CREATE OR REPLACE FUNCTION public.train_units(
    p_unit_type TEXT,
    p_quantity INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_gold_cost BIGINT;
    v_citizen_cost INTEGER;
    v_new_stats JSON;
BEGIN
    v_user_id := auth.uid();
    v_citizen_cost := p_quantity;
    
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);

    -- Calculate Gold Cost based on unit type
    -- Attack/Defense: 10 Gold
    -- Spy/Sentry: 20 Gold
    IF p_unit_type IN ('attack_soldiers', 'defense_soldiers') THEN
        v_gold_cost := 10 * p_quantity;
    ELSIF p_unit_type IN ('spies', 'sentries') THEN
        v_gold_cost := 20 * p_quantity;
    ELSE
        RAISE EXCEPTION 'Invalid unit type';
    END IF;

    -- Check resources
    IF (SELECT gold FROM public.user_stats WHERE id = v_user_id) < v_gold_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;
    
    IF (SELECT citizens FROM public.user_stats WHERE id = v_user_id) < v_citizen_cost THEN
        RAISE EXCEPTION 'Not enough citizens';
    END IF;

    -- Deduct Resources & Add Units
    IF p_unit_type = 'attack_soldiers' THEN
        UPDATE public.user_stats SET gold = gold - v_gold_cost, citizens = citizens - v_citizen_cost, attack_soldiers = COALESCE(attack_soldiers, 0) + p_quantity WHERE id = v_user_id;
    ELSIF p_unit_type = 'defense_soldiers' THEN
         UPDATE public.user_stats SET gold = gold - v_gold_cost, citizens = citizens - v_citizen_cost, defense_soldiers = COALESCE(defense_soldiers, 0) + p_quantity WHERE id = v_user_id;
    ELSIF p_unit_type = 'spies' THEN
         UPDATE public.user_stats SET gold = gold - v_gold_cost, citizens = citizens - v_citizen_cost, spies = COALESCE(spies, 0) + p_quantity WHERE id = v_user_id;
    ELSIF p_unit_type = 'sentries' THEN
         UPDATE public.user_stats SET gold = gold - v_gold_cost, citizens = citizens - v_citizen_cost, sentries = COALESCE(sentries, 0) + p_quantity WHERE id = v_user_id;
    END IF;

    -- Recalculate Stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. TRAIN MINERS
CREATE OR REPLACE FUNCTION public.train_miners(
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_unit_cost bigint := 2000; -- Flat fee 2000
    v_total_cost bigint;
    v_current_gold bigint;
    v_current_citizens bigint;
    v_current_level int;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);

    -- Get current stats
    SELECT gold, citizens, gold_mine_level INTO v_current_gold, v_current_citizens, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Validation
    IF v_current_level < 1 THEN
        RAISE EXCEPTION 'You must build a Gold Mine first';
    END IF;

    v_total_cost := p_quantity * v_unit_cost;

    -- Check Resources (Handle Vault vs Main Gold logic if needed, simplied here to Main Gold check for brevity/safety unless logic requires Vault check)
    -- Re-implementing the vault/main switch logic from original function:
    
    IF (SELECT use_vault_gold FROM public.user_stats WHERE id = v_user_id) THEN
        -- Spending from Vault
        IF (SELECT vault FROM public.user_stats WHERE id = v_user_id) < v_total_cost THEN
            RAISE EXCEPTION 'Not enough gold in vault';
        END IF;
        
        UPDATE public.user_stats
        SET vault = vault - v_total_cost,
            citizens = citizens - p_quantity,
            miners = miners + p_quantity
        WHERE id = v_user_id;
    ELSE
        -- Spending from Main Gold
        IF v_current_gold < v_total_cost THEN
            RAISE EXCEPTION 'Not enough gold';
        END IF;
        
        UPDATE public.user_stats
        SET gold = gold - v_total_cost,
            citizens = citizens - p_quantity,
            miners = miners + p_quantity
        WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;


-- 4. UPGRADE VAULT
CREATE OR REPLACE FUNCTION public.upgrade_vault()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);
    
    -- Get current stats
    SELECT gold, vault_level
    INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check Max Level
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Max vault level reached';
    END IF;

    -- Calculate Gold Cost based on level
    IF v_current_level = 0 THEN v_cost := 5000;
    ELSIF v_current_level = 1 THEN v_cost := 100000;
    ELSIF v_current_level = 2 THEN v_cost := 1000000;
    ELSIF v_current_level = 3 THEN v_cost := 4000000;
    ELSIF v_current_level = 4 THEN v_cost := 8000000;
    ELSIF v_current_level = 5 THEN v_cost := 20000000;
    ELSIF v_current_level = 6 THEN v_cost := 75000000;
    ELSIF v_current_level = 7 THEN v_cost := 200000000;
    ELSIF v_current_level = 8 THEN v_cost := 1000000000;
    ELSIF v_current_level = 9 THEN v_cost := 5000000000;
    END IF;

    -- Check if user has enough Gold
    IF v_current_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold (need %, have %)', v_cost, v_current_gold;
    END IF;
    
    -- Deduct Gold and upgrade vault
    UPDATE public.user_stats
    SET gold = gold - v_cost,
        vault_level = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;


-- 5. UPGRADE RESEARCH (ATTACK, DEFENSE, SPY, SENTRY)
-- ATTACK
CREATE OR REPLACE FUNCTION public.upgrade_research_attack()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);

    SELECT experience, COALESCE(research_attack, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_attack = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;

-- DEFENSE
CREATE OR REPLACE FUNCTION public.upgrade_research_defense()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);

    SELECT experience, COALESCE(research_defense, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_defense = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;

-- SPY
CREATE OR REPLACE FUNCTION public.upgrade_research_spy()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);

    SELECT experience, COALESCE(research_spy, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_spy = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;

-- SENTRY
CREATE OR REPLACE FUNCTION public.upgrade_research_sentry()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);

    SELECT experience, COALESCE(research_sentry, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_sentry = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;

-- 6. UPGRADE KINGDOM
CREATE OR REPLACE FUNCTION public.upgrade_kingdom()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_current_level int;
    v_use_vault boolean;
    v_vault_gold bigint;
    v_available_gold bigint;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- [FIX] Catch up resources first
    PERFORM public.generate_resources_for_user(v_user_id);
    
    -- Get current stats
    SELECT gold, kingdom_level, use_vault_gold, vault 
    INTO v_current_gold, v_current_level, v_use_vault, v_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Handle nulls
    IF v_current_level IS NULL THEN v_current_level := 0; END IF;
    IF v_vault_gold IS NULL THEN v_vault_gold := 0; END IF;
    IF v_use_vault IS NULL THEN v_use_vault := false; END IF;

    -- Calculate available gold
    v_available_gold := v_current_gold;
    IF v_use_vault THEN
        v_available_gold := v_available_gold + v_vault_gold;
    END IF;

    -- Cost Logic: Can be customized. Using 10k * 2^(Level-1) as placeholder or 1000
    -- Assuming a simple progression:
    IF v_current_level = 0 THEN v_cost := 1000;
    ELSE v_cost := 1000 * (2 ^ v_current_level);
    END IF;

    -- Validation
    IF v_available_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold & Upgrade
    IF v_current_gold >= v_cost THEN
        UPDATE public.user_stats SET gold = gold - v_cost, kingdom_level = v_current_level + 1 WHERE id = v_user_id;
    ELSE
         UPDATE public.user_stats SET gold = 0, vault = vault - (v_cost - v_current_gold), kingdom_level = v_current_level + 1 WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
