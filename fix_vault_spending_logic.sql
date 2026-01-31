-- Fix Upgrades to Respect "Use Vault Gold" Toggle
-- This updates upgrade_vault, upgrade_barracks, and upgrade_gold_mine to properly check and use vault funds.

-- 1. Helper Function: Calculate Vault Available Gold
-- Returns (gold + available_vault) if toggle is on, else just gold.
CREATE OR REPLACE FUNCTION public.get_available_gold(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_gold bigint;
    v_vault bigint;
    v_use_vault boolean;
BEGIN
    SELECT gold, vault, use_vault_gold 
    INTO v_gold, v_vault, v_use_vault
    FROM public.user_stats 
    WHERE id = p_user_id;
    
    RETURN CASE 
        WHEN v_use_vault THEN (COALESCE(v_gold, 0) + COALESCE(v_vault, 0))
        ELSE COALESCE(v_gold, 0)
    END;
END;
$$;


-- 2. Helper Procedure: Deduct Gold (Smart)
-- Deducts from Main first, then Vault if needed/allowed.
CREATE OR REPLACE FUNCTION public.deduct_gold(p_user_id uuid, p_amount bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gold bigint;
    v_vault bigint;
    v_use_vault boolean;
    v_remainder bigint;
BEGIN
    SELECT gold, vault, use_vault_gold 
    INTO v_gold, v_vault, v_use_vault
    FROM public.user_stats 
    WHERE id = p_user_id;

    -- Check sufficiency
    IF (v_use_vault AND (COALESCE(v_gold, 0) + COALESCE(v_vault, 0) < p_amount)) OR
       (NOT v_use_vault AND COALESCE(v_gold, 0) < p_amount) THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    IF v_gold >= p_amount THEN
        -- Pay entirely from hand
        UPDATE public.user_stats SET gold = gold - p_amount WHERE id = p_user_id;
    ELSIF v_use_vault THEN
        -- Pay all hand, rest from vault
        v_remainder := p_amount - v_gold;
        UPDATE public.user_stats 
        SET gold = 0, vault = vault - v_remainder 
        WHERE id = p_user_id;
    ELSE
        RAISE EXCEPTION 'Not enough gold (Hand funds insufficient and Vault disabled)';
    END IF;
END;
$$;


-- 3. Update Upgrade Vault
CREATE OR REPLACE FUNCTION public.upgrade_vault()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    SELECT vault_level INTO v_current_level FROM public.user_stats WHERE id = v_user_id;
    
    -- Costs (From Vault.jsx/update_vault_system.sql)
    -- Level 0->1: 5000
    -- Level 1->2: 100,000
    -- Level 2->3: 1,000,000
    -- Level 3->4: 4,000,000
    -- Level 4->5: 8,000,000
    -- Level 5->6: 20,000,000
    -- Level 6->7: 75,000,000
    -- Level 7->8: 200,000,000
    -- Level 8->9: 1,000,000,000
    -- Level 9->10: 5,000,000,000
    
    IF v_current_level >= 10 THEN RAISE EXCEPTION 'Max vault level reached'; END IF;

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

    -- Reformatted to use helper
    PERFORM public.deduct_gold(v_user_id, v_cost);

    UPDATE public.user_stats SET vault_level = v_current_level + 1 WHERE id = v_user_id;

    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- 4. Update Upgrade Barracks
CREATE OR REPLACE FUNCTION public.upgrade_barracks(p_target_level int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    SELECT barracks_level INTO v_current_level FROM public.user_stats WHERE id = v_user_id;
    v_current_level := COALESCE(v_current_level, 1);

    IF p_target_level IS NULL OR p_target_level = 0 THEN p_target_level := v_current_level + 1; END IF;
    
    IF p_target_level != v_current_level + 1 THEN RAISE EXCEPTION 'Invalid upgrade target level'; END IF;
    IF v_current_level >= 10 THEN RAISE EXCEPTION 'Barracks are already at max level'; END IF;

    -- Costs (From gameConfig.js / add_barracks_upgrades.sql)
    -- Target Level 2: 10k, 3: 25k, 4: 50k, 5: 100k, 6: 250k, 7: 500k, 8: 1M, 9: 2.5M, 10: 5M
    v_cost := CASE p_target_level
        WHEN 2 THEN 10000
        WHEN 3 THEN 25000
        WHEN 4 THEN 50000
        WHEN 5 THEN 100000
        WHEN 6 THEN 250000
        WHEN 7 THEN 500000
        WHEN 8 THEN 1000000
        WHEN 9 THEN 2500000
        WHEN 10 THEN 5000000
        ELSE 999999999
    END;

    PERFORM public.deduct_gold(v_user_id, v_cost);

    UPDATE user_stats SET barracks_level = p_target_level WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);

    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- 5. Update Upgrade Gold Mine
CREATE OR REPLACE FUNCTION public.upgrade_gold_mine()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    SELECT gold_mine_level INTO v_current_level FROM public.user_stats WHERE id = v_user_id;
    v_current_level := COALESCE(v_current_level, 0);

    IF v_current_level >= 25 THEN RAISE EXCEPTION 'Max mine level reached'; END IF;

    -- Costs (From gameConfig.js)
    -- 0->1: 1000
    -- 1->2: 5000
    -- 2->3: 15000
    -- 3->4: 45000
    -- 4+: 45000 * 3^(lvl-3)
    CASE v_current_level
        WHEN 0 THEN v_cost := 1000;
        WHEN 1 THEN v_cost := 5000;
        WHEN 2 THEN v_cost := 15000;
        WHEN 3 THEN v_cost := 45000;
        WHEN 4 THEN v_cost := 135000;
        WHEN 5 THEN v_cost := 405000;
        WHEN 6 THEN v_cost := 1215000;
        WHEN 7 THEN v_cost := 3645000;
        WHEN 8 THEN v_cost := 10935000;
        WHEN 9 THEN v_cost := 32805000;
        WHEN 10 THEN v_cost := 98415000;
        WHEN 11 THEN v_cost := 295245000;
        WHEN 12 THEN v_cost := 885735000;
        WHEN 13 THEN v_cost := 2657205000;
        WHEN 14 THEN v_cost := 7971615000;
        WHEN 15 THEN v_cost := 23914845000;
        WHEN 16 THEN v_cost := 71744535000;
        WHEN 17 THEN v_cost := 215233605000;
        WHEN 18 THEN v_cost := 645700815000;
        WHEN 19 THEN v_cost := 1937102445000;
        WHEN 20 THEN v_cost := 5811307335000;
        WHEN 21 THEN v_cost := 17433922005000;
        WHEN 22 THEN v_cost := 52301766015000;
        WHEN 23 THEN v_cost := 156905298045000;
        WHEN 24 THEN v_cost := 470715894135000;
        ELSE RAISE EXCEPTION 'Cost calculation error';
    END CASE;

    PERFORM public.deduct_gold(v_user_id, v_cost);

    UPDATE user_stats SET gold_mine_level = v_current_level + 1 WHERE id = v_user_id;

    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
