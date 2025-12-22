-- Weapon System Implementation
-- Run this in Supabase SQL Editor

-- 1. Add research_weapons column to user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS research_weapons int DEFAULT 0;

-- 2. Create user_weapons table
CREATE TABLE IF NOT EXISTS public.user_weapons (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.user_stats(id) ON DELETE CASCADE,
    weapon_type text NOT NULL, -- 'attack', 'defense', 'spy', 'sentry'
    tier int NOT NULL, -- 0 (Basic) to 5
    quantity int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, weapon_type, tier)
);

-- Enable RLS
ALTER TABLE public.user_weapons ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own weapons
CREATE POLICY "Users can view own weapons" ON public.user_weapons
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own weapons (via functions mostly, but good for safety)
CREATE POLICY "Users can update own weapons" ON public.user_weapons
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can insert their own weapons
CREATE POLICY "Users can insert own weapons" ON public.user_weapons
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 3. Function: Upgrade Weapon Research
CREATE OR REPLACE FUNCTION public.upgrade_research_weapons()
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
    
    SELECT gold, research_weapons INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    IF v_current_level IS NULL THEN v_current_level := 0; END IF;
    IF v_current_level >= 5 THEN RAISE EXCEPTION 'Max research level reached'; END IF;

    -- Cost: 100k, 300k, 900k, 2.7M, 8.1M
    IF v_current_level = 0 THEN v_cost := 100000;
    ELSIF v_current_level = 1 THEN v_cost := 300000;
    ELSIF v_current_level = 2 THEN v_cost := 900000;
    ELSIF v_current_level = 3 THEN v_cost := 2700000;
    ELSIF v_current_level = 4 THEN v_cost := 8100000;
    ELSE RAISE EXCEPTION 'Invalid level';
    END IF;

    IF v_current_gold < v_cost THEN RAISE EXCEPTION 'Not enough gold'; END IF;

    UPDATE public.user_stats
    SET gold = gold - v_cost,
        research_weapons = v_current_level + 1
    WHERE id = v_user_id;

    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- 4. Function: Buy Weapon
CREATE OR REPLACE FUNCTION public.buy_weapon(p_type text, p_tier int, p_quantity int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_research_level int;
    v_cost_per_unit bigint;
    v_total_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Validate inputs
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    IF p_tier < 0 OR p_tier > 5 THEN RAISE EXCEPTION 'Invalid tier'; END IF;

    -- Get user stats
    SELECT gold, research_weapons INTO v_current_gold, v_research_level
    FROM public.user_stats
    WHERE id = v_user_id;

    IF v_research_level IS NULL THEN v_research_level := 0; END IF;

    -- Check if unlocked
    -- Tier 0 (Basic) is always unlocked. Tier 1 needs Research 1, etc.
    IF p_tier > 0 AND p_tier > v_research_level THEN
        RAISE EXCEPTION 'Weapon tier not yet researched';
    END IF;

    -- Calculate Cost
    -- Basic: 100, T1: 1k, T2: 10k, T3: 100k, T4: 1M, T5: 10M
    IF p_tier = 0 THEN v_cost_per_unit := 100;
    ELSIF p_tier = 1 THEN v_cost_per_unit := 1000;
    ELSIF p_tier = 2 THEN v_cost_per_unit := 10000;
    ELSIF p_tier = 3 THEN v_cost_per_unit := 100000;
    ELSIF p_tier = 4 THEN v_cost_per_unit := 1000000;
    ELSIF p_tier = 5 THEN v_cost_per_unit := 10000000;
    END IF;

    v_total_cost := v_cost_per_unit * p_quantity;

    IF v_current_gold < v_total_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold
    UPDATE public.user_stats
    SET gold = gold - v_total_cost
    WHERE id = v_user_id;

    -- Add Weapon
    INSERT INTO public.user_weapons (user_id, weapon_type, tier, quantity)
    VALUES (v_user_id, p_type, p_tier, p_quantity)
    ON CONFLICT (user_id, weapon_type, tier)
    DO UPDATE SET quantity = user_weapons.quantity + p_quantity, updated_at = now();

    -- Return updated stats (for gold update)
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- 5. Function: Sell Weapon
CREATE OR REPLACE FUNCTION public.sell_weapon(p_type text, p_tier int, p_quantity int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_quantity int;
    v_cost_per_unit bigint;
    v_refund_total bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

    -- Check ownership
    SELECT quantity INTO v_current_quantity
    FROM public.user_weapons
    WHERE user_id = v_user_id AND weapon_type = p_type AND tier = p_tier;

    IF v_current_quantity IS NULL OR v_current_quantity < p_quantity THEN
        RAISE EXCEPTION 'Not enough weapons to sell';
    END IF;

    -- Calculate Refund (50% of cost)
    IF p_tier = 0 THEN v_cost_per_unit := 100;
    ELSIF p_tier = 1 THEN v_cost_per_unit := 1000;
    ELSIF p_tier = 2 THEN v_cost_per_unit := 10000;
    ELSIF p_tier = 3 THEN v_cost_per_unit := 100000;
    ELSIF p_tier = 4 THEN v_cost_per_unit := 1000000;
    ELSIF p_tier = 5 THEN v_cost_per_unit := 10000000;
    END IF;

    v_refund_total := floor((v_cost_per_unit * p_quantity) * 0.5);

    -- Remove Weapons
    UPDATE public.user_weapons
    SET quantity = quantity - p_quantity,
        updated_at = now()
    WHERE user_id = v_user_id AND weapon_type = p_type AND tier = p_tier;

    -- Add Refund to Vault (Ignore Capacity)
    UPDATE public.user_stats
    SET vault = COALESCE(vault, 0) + v_refund_total
    WHERE id = v_user_id;

    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
