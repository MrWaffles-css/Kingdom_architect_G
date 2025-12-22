-- Add Gold Mine Feature
-- Run this in Supabase SQL Editor

-- 1. Add columns to user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS miners bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS gold_mine_level int DEFAULT 0;

-- 2. Update handle_new_user to initialize new columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, is_admin)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), 
        NEW.email, 
        false
    );

    INSERT INTO public.user_stats (
        id, gold, experience, turns, vault, rank, citizens, kingdom_level, 
        attack, defense, spy, sentry, alliance,
        attack_soldiers, defense_soldiers, spies, sentries,
        miners, gold_mine_level
    )
    VALUES (
        NEW.id, 
        0,    -- gold
        1000, -- experience
        0,    -- turns
        0,    -- vault
        1,    -- rank
        2,    -- citizens
        0,    -- kingdom_level
        0,    -- attack
        0,    -- defense
        0,    -- spy
        0,    -- sentry
        NULL, -- alliance
        0, 0, 0, 0, -- units
        0, 0  -- miners, gold_mine_level
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to Upgrade Gold Mine
CREATE OR REPLACE FUNCTION public.upgrade_gold_mine()
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
    
    -- Get current stats
    SELECT gold, gold_mine_level INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check Max Level
    IF v_current_level >= 25 THEN
        RAISE EXCEPTION 'Max level reached';
    END IF;

    -- Calculate Cost based on current level (Cost to reach next level)
    -- Level 0 -> 1: 1,000
    -- Level 1 -> 2: 5,000
    -- Level 2 -> 3: 15,000
    -- Level 3 -> 4: 45,000
    -- Level 4+ -> Previous * 3
    
    IF v_current_level = 0 THEN
        v_cost := 1000;
    ELSIF v_current_level = 1 THEN
        v_cost := 5000;
    ELSIF v_current_level = 2 THEN
        v_cost := 15000;
    ELSIF v_current_level = 3 THEN
        v_cost := 45000;
    ELSE
        -- For level 4 and above (upgrading to 5+), use formula
        -- Base at level 3 is 45,000. 
        -- Level 4 cost = 45,000 * 3 = 135,000
        -- Formula: 45000 * (3 ^ (current_level - 3))
        v_cost := 45000 * (3 ^ (v_current_level - 3));
    END IF;

    -- Validation & Cost Deduction
    IF (SELECT use_vault_gold FROM public.user_stats WHERE id = v_user_id) THEN
        -- Spending from Vault
        IF (SELECT vault FROM public.user_stats WHERE id = v_user_id) < v_cost THEN
            RAISE EXCEPTION 'Not enough gold in vault';
        END IF;
        
        UPDATE public.user_stats
        SET vault = vault - v_cost,
            gold_mine_level = v_current_level + 1
        WHERE id = v_user_id;
    ELSE
        -- Spending from Main Gold
        IF v_current_gold < v_cost THEN
            RAISE EXCEPTION 'Not enough gold';
        END IF;
        
        UPDATE public.user_stats
        SET gold = gold - v_cost,
            gold_mine_level = v_current_level + 1
        WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 4. Function to Train Miners
CREATE OR REPLACE FUNCTION public.train_miners(
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_unit_cost bigint;
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

    -- Calculate Dynamic Cost: 2000 * (1.1 ^ (current_level - 1))
    v_unit_cost := floor(2000 * (1.1 ^ (v_current_level - 1)));
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
