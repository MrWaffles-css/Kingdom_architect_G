-- Add Barracks Features
-- Run this in Supabase SQL Editor

-- 1. Add unit count columns to user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS attack_soldiers bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS defense_soldiers bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS spies bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentries bigint DEFAULT 0;

-- 2. Create function to train units
-- Handles cost deduction, citizen conversion, and stat updates
CREATE OR REPLACE FUNCTION public.train_units(
    p_unit_type text,
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_gold_cost bigint;
    v_current_gold bigint;
    v_current_citizens bigint;
    v_stat_increase bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    v_gold_cost := p_quantity * 1000;
    v_stat_increase := p_quantity * 100;

    -- Get current stats
    SELECT gold, citizens INTO v_current_gold, v_current_citizens
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Validation
    -- Validation & Cost Deduction
    IF (SELECT use_vault_gold FROM public.user_stats WHERE id = v_user_id) THEN
        -- Spending from Vault
        IF (SELECT vault FROM public.user_stats WHERE id = v_user_id) < v_gold_cost THEN
            RAISE EXCEPTION 'Not enough gold in vault';
        END IF;
        
        UPDATE public.user_stats
        SET vault = vault - v_gold_cost
        WHERE id = v_user_id;
    ELSE
        -- Spending from Main Gold
        IF v_current_gold < v_gold_cost THEN
            RAISE EXCEPTION 'Not enough gold';
        END IF;
        
        UPDATE public.user_stats
        SET gold = gold - v_gold_cost
        WHERE id = v_user_id;
    END IF;

    IF v_current_citizens < p_quantity THEN
        RAISE EXCEPTION 'Not enough citizens';
    END IF;

    -- Update stats based on unit type
    IF p_unit_type = 'attack' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            attack_soldiers = attack_soldiers + p_quantity,
            attack = attack + v_stat_increase
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'defense' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            defense_soldiers = defense_soldiers + p_quantity,
            defense = defense + v_stat_increase
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'spy' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            spies = spies + p_quantity,
            spy = spy + v_stat_increase
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'sentry' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            sentries = sentries + p_quantity,
            sentry = sentry + v_stat_increase
        WHERE id = v_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid unit type';
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
