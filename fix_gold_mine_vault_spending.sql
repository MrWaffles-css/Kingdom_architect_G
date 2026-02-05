-- Fix Gold Mine Upgrade to Use Vault Gold
-- This updates the upgrade_gold_mine function to respect the "Use Vault Gold" toggle

-- Ensure helper functions exist (from fix_vault_spending_logic.sql)
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
        RAISE EXCEPTION 'Insufficient Gold. Need % (Have %)', 
            p_amount, 
            CASE WHEN v_use_vault THEN (COALESCE(v_gold, 0) + COALESCE(v_vault, 0)) ELSE COALESCE(v_gold, 0) END;
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

-- Update upgrade_gold_mine to use vault spending logic
CREATE OR REPLACE FUNCTION upgrade_gold_mine()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_stats record;
    v_config jsonb;
    v_target_level int;
    v_level_config jsonb;
    v_cost bigint;
    v_new_stats jsonb;
BEGIN
    -- Get user stats
    SELECT * INTO v_stats FROM user_stats WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Get Config
    SELECT levels INTO v_config FROM gold_mine_configs LIMIT 1;
    IF v_config IS NULL THEN RAISE EXCEPTION 'Gold Mine configuration not found'; END IF;

    v_target_level := COALESCE(v_stats.gold_mine_level, 0) + 1;

    -- Finding the config for CURRENT level to determine UPGRADE cost
    SELECT item INTO v_level_config
    FROM jsonb_array_elements(v_config) item
    WHERE (item->>'level')::int = v_stats.gold_mine_level; -- Current Level

    IF v_level_config IS NULL THEN
        RAISE EXCEPTION 'Maximum level reached (Current Level % configuration missing)', v_stats.gold_mine_level;
    END IF;

    v_cost := (v_level_config->>'upgrade_cost')::bigint;

    -- Use the deduct_gold helper which respects vault toggle
    PERFORM public.deduct_gold(v_user_id, v_cost);

    -- Perform Upgrade
    UPDATE user_stats
    SET gold_mine_level = gold_mine_level + 1,
        updated_at = NOW()
    WHERE id = v_user_id
    RETURNING * INTO v_stats;

    RETURN to_jsonb(v_stats);
END;
$$;
