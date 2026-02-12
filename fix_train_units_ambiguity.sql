-- Fix duplicate train_units functions causing ambiguity
-- Consolidate into a single function with optional idempotency_key

-- Drop both existing functions
DROP FUNCTION IF EXISTS public.train_units(text, int);
DROP FUNCTION IF EXISTS public.train_units(text, int, uuid);

-- Recreate single robust function
CREATE OR REPLACE FUNCTION public.train_units(
    p_unit_type text, 
    p_quantity int, 
    idempotency_key uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_unit_cost bigint;
    v_total_cost bigint;
    v_available_gold bigint;
    v_training_costs jsonb;
    v_new_stats json;
    v_column_name text;
    v_result json;
    v_stats record;
BEGIN
    -- Mutual Exclusion to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext('train_units' || v_user_id::text));

    -- Idempotency Check
    IF idempotency_key IS NOT NULL THEN
        SELECT response INTO v_result FROM idempotency_keys WHERE user_id = v_user_id AND key = idempotency_key;
        IF FOUND THEN RETURN v_result; END IF;
    END IF;

    -- Validate Inputs
    IF p_unit_type NOT IN ('attack', 'defense', 'spy', 'sentry') THEN RAISE EXCEPTION 'Invalid unit type'; END IF;
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

    -- Get Current Stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;

    IF v_stats.citizens < p_quantity THEN RAISE EXCEPTION 'Not enough citizens'; END IF;

    -- Get Cost from Config or Fallback
    SELECT training_costs INTO v_training_costs FROM barracks_configs LIMIT 1;
    v_unit_cost := COALESCE((v_training_costs->>p_unit_type)::bigint, 1000);
    v_total_cost := p_quantity * v_unit_cost;

    -- Check Funds
    IF v_stats.use_vault_gold THEN 
        v_available_gold := v_stats.gold + COALESCE(v_stats.vault, 0);
    ELSE 
        v_available_gold := v_stats.gold; 
    END IF;

    IF v_available_gold < v_total_cost THEN RAISE EXCEPTION 'Not enough gold'; END IF;

    -- Determine Column to Update
    v_column_name := CASE p_unit_type
        WHEN 'attack' THEN 'attack_soldiers'
        WHEN 'defense' THEN 'defense_soldiers'
        WHEN 'spy' THEN 'spies'
        WHEN 'sentry' THEN 'sentries'
    END;

    -- Execute Transaction (Update Gold, Citizens, and Unit Count)
    IF v_stats.use_vault_gold AND v_stats.gold < v_total_cost THEN
        -- Need to dip into vault
        EXECUTE format('UPDATE public.user_stats SET gold = 0, vault = vault - $1, citizens = citizens - $2, %I = %I + $2, updated_at = NOW() WHERE id = $3', v_column_name, v_column_name) 
        USING (v_total_cost - v_stats.gold), p_quantity, v_user_id;
    ELSE
        -- Pay with main gold
        EXECUTE format('UPDATE public.user_stats SET gold = gold - $1, citizens = citizens - $2, %I = %I + $2, updated_at = NOW() WHERE id = $3', v_column_name, v_column_name) 
        USING v_total_cost, p_quantity, v_user_id;
    END IF;

    -- Recalculate Stats (Strength, etc.)
    PERFORM recalculate_user_stats(v_user_id);

    -- Prepare Result
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    v_result := v_new_stats;

    -- Save Idempotency Result
    IF idempotency_key IS NOT NULL THEN
        INSERT INTO idempotency_keys (user_id, key, response) VALUES (v_user_id, idempotency_key, v_result);
    END IF;

    RETURN v_result;
END;
$$;
