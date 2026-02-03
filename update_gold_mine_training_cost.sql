-- Add Training Cost to Gold Mine Configs

-- 1. Update Existing Data to include default training_cost (1000)
DO $$
DECLARE
    v_rows record;
    v_levels jsonb;
    v_new_levels jsonb;
    v_item jsonb;
BEGIN
    FOR v_rows IN SELECT id, levels FROM gold_mine_configs LOOP
        v_new_levels := '[]'::jsonb;
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_rows.levels) LOOP
            v_new_levels := v_new_levels || jsonb_build_object(
                'level', v_item->>'level',
                'upgrade_cost', v_item->>'upgrade_cost',
                'production_rate', v_item->>'production_rate',
                'training_cost', COALESCE((v_item->>'training_cost')::int, 1000) -- Default 1000
            );
        END LOOP;
        
        UPDATE gold_mine_configs SET levels = v_new_levels WHERE id = v_rows.id;
    END LOOP;
END $$;

-- 2. Update train_miners to use dynamic config
CREATE OR REPLACE FUNCTION public.train_miners(
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_unit_cost bigint;
    v_total_cost bigint;
    v_current_gold bigint;
    v_vault_gold bigint;
    v_use_vault boolean;
    v_available_gold bigint;
    v_current_citizens bigint;
    v_current_level int;
    v_config jsonb;
    v_level_config jsonb;
    v_new_stats json;
BEGIN
    -- Get current stats
    SELECT gold, vault, use_vault_gold, citizens, gold_mine_level 
    INTO v_current_gold, v_vault_gold, v_use_vault, v_current_citizens, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Validation
    IF v_current_level < 1 THEN
        RAISE EXCEPTION 'You must build a Gold Mine first';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    IF v_current_citizens < p_quantity THEN
        RAISE EXCEPTION 'Not enough citizens';
    END IF;

    -- Get Config for Cost
    SELECT levels INTO v_config FROM gold_mine_configs LIMIT 1;
    IF v_config IS NULL THEN
        -- Fallback if config missing, though it shouldn't be
        v_unit_cost := 1000;
    ELSE
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = v_current_level;

        -- Fallback if specific level not found?
        IF v_level_config IS NULL THEN
             v_unit_cost := 1000;
        ELSE
             v_unit_cost := COALESCE((v_level_config->>'training_cost')::bigint, 1000);
        END IF;
    END IF;

    -- Calculate total cost
    v_total_cost := p_quantity * v_unit_cost;

    -- Determine available gold
    IF v_use_vault THEN
        v_available_gold := v_current_gold + v_vault_gold;
    ELSE
        v_available_gold := v_current_gold;
    END IF;

    IF v_available_gold < v_total_cost THEN
         RAISE EXCEPTION 'Not enough gold. Need % (Have %)', v_total_cost, v_available_gold;
    END IF;

    -- Deduct Gold logic
    IF v_use_vault THEN
        IF v_current_gold >= v_total_cost THEN
             UPDATE public.user_stats
             SET gold = gold - v_total_cost,
                 citizens = citizens - p_quantity,
                 miners = miners + p_quantity,
                 updated_at = NOW()
             WHERE id = v_user_id;
        ELSE
            DECLARE
                v_remainder bigint;
            BEGIN
                v_remainder := v_total_cost - v_current_gold;
                UPDATE public.user_stats
                SET gold = 0,
                    vault = vault - v_remainder,
                    citizens = citizens - p_quantity,
                    miners = miners + p_quantity,
                    updated_at = NOW()
                WHERE id = v_user_id;
            END;
        END IF;
    ELSE
        UPDATE public.user_stats
        SET gold = gold - v_total_cost,
            citizens = citizens - p_quantity,
            miners = miners + p_quantity,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
