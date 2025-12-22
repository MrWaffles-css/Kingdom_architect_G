-- =====================================================
-- FIX: Vault Gold Usage for Library & Research
-- =====================================================
-- This script updates the library and research upgrade functions
-- to correctly use gold from the Vault if the user has enabled
-- the 'use_vault_gold' preference.

-- 1. Upgrade Library
CREATE OR REPLACE FUNCTION public.upgrade_library()
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
    
    -- Get current stats including vault info
    SELECT gold, library_level, use_vault_gold, vault 
    INTO v_current_gold, v_current_level, v_use_vault, v_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Handle nulls
    IF v_current_level IS NULL THEN v_current_level := 1; END IF;
    IF v_vault_gold IS NULL THEN v_vault_gold := 0; END IF;
    IF v_use_vault IS NULL THEN v_use_vault := false; END IF;

    -- Calculate available gold
    v_available_gold := v_current_gold;
    IF v_use_vault THEN
        v_available_gold := v_available_gold + v_vault_gold;
    END IF;

    -- Check Max Level
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Max library level reached';
    END IF;

    -- Calculate Gold Cost
    IF v_current_level = 1 THEN v_cost := 100000;
    ELSIF v_current_level = 2 THEN v_cost := 300000;
    ELSIF v_current_level = 3 THEN v_cost := 600000;
    ELSIF v_current_level = 4 THEN v_cost := 900000;
    ELSIF v_current_level = 5 THEN v_cost := 2000000;
    ELSIF v_current_level = 6 THEN v_cost := 5000000;
    ELSIF v_current_level = 7 THEN v_cost := 25000000;
    ELSIF v_current_level = 8 THEN v_cost := 50000000;
    ELSIF v_current_level = 9 THEN v_cost := 100000000;
    ELSE
        RAISE EXCEPTION 'Invalid level';
    END IF;

    -- Validation
    IF v_available_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold (Main first, then Vault)
    IF v_current_gold >= v_cost THEN
        -- Enough in main balance
        UPDATE public.user_stats
        SET gold = gold - v_cost,
            library_level = v_current_level + 1
        WHERE id = v_user_id;
    ELSE
        -- Need to take from vault
        UPDATE public.user_stats
        SET gold = 0,
            vault = vault - (v_cost - v_current_gold),
            library_level = v_current_level + 1
        WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 2. Upgrade Weapon Research
CREATE OR REPLACE FUNCTION public.upgrade_research_weapons()
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
    
    -- Get current stats
    SELECT gold, research_weapons, use_vault_gold, vault 
    INTO v_current_gold, v_current_level, v_use_vault, v_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Default to 0 if null
    IF v_current_level IS NULL THEN v_current_level := 0; END IF;
    IF v_vault_gold IS NULL THEN v_vault_gold := 0; END IF;
    IF v_use_vault IS NULL THEN v_use_vault := false; END IF;
    
    -- Calculate available gold
    v_available_gold := v_current_gold;
    IF v_use_vault THEN
        v_available_gold := v_available_gold + v_vault_gold;
    END IF;

    -- Max level check (Max Tier is 5)
    IF v_current_level >= 5 THEN 
        RAISE EXCEPTION 'Max weapon research level reached'; 
    END IF;

    -- Cost Calculation
    IF v_current_level = 0 THEN v_cost := 100000;
    ELSIF v_current_level = 1 THEN v_cost := 300000;
    ELSIF v_current_level = 2 THEN v_cost := 900000;
    ELSIF v_current_level = 3 THEN v_cost := 2700000;
    ELSIF v_current_level = 4 THEN v_cost := 8100000;
    ELSE 
        RAISE EXCEPTION 'Invalid level';
    END IF;

    -- Check Gold
    IF v_available_gold < v_cost THEN 
        RAISE EXCEPTION 'Not enough gold'; 
    END IF;

    -- Deduct Gold & Increment Level
    IF v_current_gold >= v_cost THEN
        UPDATE public.user_stats
        SET gold = gold - v_cost,
            research_weapons = v_current_level + 1
        WHERE id = v_user_id;
    ELSE
        UPDATE public.user_stats
        SET gold = 0,
            vault = vault - (v_cost - v_current_gold),
            research_weapons = v_current_level + 1
        WHERE id = v_user_id;
    END IF;

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats 
    FROM public.user_stats us 
    WHERE id = v_user_id;
    
    RETURN v_new_stats;
END;
$$;

-- 3. Upgrade Turn Research
CREATE OR REPLACE FUNCTION public.upgrade_research_turns()
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
    
    -- Get current stats
    SELECT gold, research_turns_per_min, use_vault_gold, vault 
    INTO v_current_gold, v_current_level, v_use_vault, v_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Default to 0 if null
    IF v_current_level IS NULL THEN v_current_level := 0; END IF;
    IF v_vault_gold IS NULL THEN v_vault_gold := 0; END IF;
    IF v_use_vault IS NULL THEN v_use_vault := false; END IF;

    -- Calculate available gold
    v_available_gold := v_current_gold;
    IF v_use_vault THEN
        v_available_gold := v_available_gold + v_vault_gold;
    END IF;

    -- Max level check
    IF v_current_level >= 5 THEN 
        RAISE EXCEPTION 'Max research level reached'; 
    END IF;

    -- Cost Calculation
    IF v_current_level = 0 THEN v_cost := 10000;
    ELSIF v_current_level = 1 THEN v_cost := 60000;
    ELSIF v_current_level = 2 THEN v_cost := 250000;
    ELSIF v_current_level = 3 THEN v_cost := 1000000;
    ELSIF v_current_level = 4 THEN v_cost := 5000000;
    ELSE 
        RAISE EXCEPTION 'Invalid level';
    END IF;

    -- Check Gold
    IF v_available_gold < v_cost THEN 
        RAISE EXCEPTION 'Not enough gold'; 
    END IF;

    -- Deduct Gold & Increment Level
    IF v_current_gold >= v_cost THEN
        UPDATE public.user_stats
        SET gold = gold - v_cost,
            research_turns_per_min = v_current_level + 1
        WHERE id = v_user_id;
    ELSE
        UPDATE public.user_stats
        SET gold = 0,
            vault = vault - (v_cost - v_current_gold),
            research_turns_per_min = v_current_level + 1
        WHERE id = v_user_id;
    END IF;

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats 
    FROM public.user_stats us 
    WHERE id = v_user_id;
    
    RETURN v_new_stats;
END;
$$;
