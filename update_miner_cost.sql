-- Update Miner Training Cost to Flat Fee of 2,000 Gold
-- Sets a fixed cost per miner, regardless of mine level or current miner count

CREATE OR REPLACE FUNCTION public.train_miners(
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_unit_cost bigint := 2000; -- FLAT FEE UPDATED TO 2000
    v_total_cost bigint;
    v_current_gold bigint;
    v_current_citizens bigint;
    v_current_level int;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();

    -- Get current stats
    SELECT gold, citizens, gold_mine_level INTO v_current_gold, v_current_citizens, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Validation
    IF v_current_level < 1 THEN
        RAISE EXCEPTION 'You must build a Gold Mine first';
    END IF;

    v_total_cost := p_quantity * v_unit_cost;

    -- Validation & Cost Deduction
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
