-- Update Miner Training Cost to Flat Fee of 1,000 Gold
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
    v_unit_cost bigint := 1000; -- FLAT FEE UPDATED TO 1000
    v_total_cost bigint;
    v_current_gold bigint;
    v_vault_gold bigint;
    v_use_vault boolean;
    v_available_gold bigint;
    v_current_citizens bigint;
    v_current_level int;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();

    -- Get current stats (including vault info to properly calculate max affordability)
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

    -- Calculate total cost
    v_total_cost := p_quantity * v_unit_cost;

    -- Determine available gold based on setting
    IF v_use_vault THEN
        v_available_gold := v_current_gold + v_vault_gold;
    ELSE
        v_available_gold := v_current_gold;
    END IF;

    IF v_available_gold < v_total_cost THEN
         RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold logic (Prioritize main gold? Or just bulk deduct if using vault?)
    -- Logic: If using vault, we pool it. Ideally we burn hand-gold first then vault.
    
    IF v_use_vault THEN
        -- If we have enough in hand, take from hand
        IF v_current_gold >= v_total_cost THEN
             UPDATE public.user_stats
             SET gold = gold - v_total_cost,
                 citizens = citizens - p_quantity,
                 miners = miners + p_quantity
             WHERE id = v_user_id;
        ELSE
            -- Take all hand gold, rest from vault
            DECLARE
                v_remainder bigint;
            BEGIN
                v_remainder := v_total_cost - v_current_gold;
                UPDATE public.user_stats
                SET gold = 0,
                    vault = vault - v_remainder,
                    citizens = citizens - p_quantity,
                    miners = miners + p_quantity
                WHERE id = v_user_id;
            END;
        END IF;
    ELSE
        -- Normal deduction
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
