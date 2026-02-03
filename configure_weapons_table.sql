-- Create table for weapon configurations
CREATE TABLE IF NOT EXISTS public.game_weapon_configs (
    id SERIAL PRIMARY KEY,
    weapon_type TEXT NOT NULL, -- 'attack', 'defense', 'spy', 'sentry'
    tier INTEGER NOT NULL, -- 0-5
    name TEXT NOT NULL,
    cost BIGINT NOT NULL,
    strength BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(weapon_type, tier)
);

-- Enable RLS
ALTER TABLE public.game_weapon_configs ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Allow public read access" ON public.game_weapon_configs
    FOR SELECT USING (true);

-- Allow write access to admins only (using existing profile check if available, or just authenticated for now)
-- Assuming check_is_admin function exists or we trust the rpc. 
-- For simplicity, let's allow authenticated users to view, but only RPCs will update.
-- Ideally we restrict updates.
CREATE POLICY "Allow admin update" ON public.game_weapon_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Insert initial data
INSERT INTO public.game_weapon_configs (weapon_type, tier, name, cost, strength)
VALUES
    -- Attack
    ('attack', 0, 'Rusty Dagger', 100, 1),
    ('attack', 1, 'Iron Sword', 1000, 12),
    ('attack', 2, 'Steel Mace', 10000, 150),
    ('attack', 3, 'Knight''s Lance', 100000, 2000),
    ('attack', 4, 'Royal Claymore', 1000000, 25000),
    ('attack', 5, 'Void Blade', 10000000, 300000),
    -- Defense
    ('defense', 0, 'Tattered Tunic', 100, 1),
    ('defense', 1, 'Leather Jerkin', 1000, 12),
    ('defense', 2, 'Chainmail Hauberk', 10000, 150),
    ('defense', 3, 'Steel Plate', 100000, 2000),
    ('defense', 4, 'Enchanted Shield', 1000000, 25000),
    ('defense', 5, 'Divine Barrier', 10000000, 300000),
    -- Spy
    ('spy', 0, 'Hooded Cloak', 100, 1),
    ('spy', 1, 'Lockpicks', 1000, 12),
    ('spy', 2, 'Smoke Bomb', 10000, 150),
    ('spy', 3, 'Poison Vial', 100000, 2000),
    ('spy', 4, 'Assassin''s Blade', 1000000, 25000),
    ('spy', 5, 'Shadow Essence', 10000000, 300000),
    -- Sentry
    ('sentry', 0, 'Wooden Torch', 100, 1),
    ('sentry', 1, 'Signal Horn', 1000, 12),
    ('sentry', 2, 'Watchtower Lens', 10000, 150),
    ('sentry', 3, 'Guard Dog', 100000, 2000),
    ('sentry', 4, 'Mystic Ward', 1000000, 25000),
    ('sentry', 5, 'All-Seeing Eye', 10000000, 300000)
ON CONFLICT (weapon_type, tier) DO NOTHING;

-- RPC to get configs
CREATE OR REPLACE FUNCTION get_weapon_configs()
RETURNS SETOF public.game_weapon_configs
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.game_weapon_configs ORDER BY weapon_type, tier;
$$;

-- RPC to update config
CREATE OR REPLACE FUNCTION update_weapon_config(
    p_id INTEGER,
    p_name TEXT,
    p_cost BIGINT,
    p_strength BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    UPDATE public.game_weapon_configs
    SET name = p_name,
        cost = p_cost,
        strength = p_strength,
        updated_at = now()
    WHERE id = p_id;
END;
$$;

-- ==========================================
-- UPDATE GAME LOGIC TO USE CONFIG TABLE
-- ==========================================

-- 1. calculate_weapon_strength
CREATE OR REPLACE FUNCTION calculate_weapon_strength(
    p_user_id UUID,
    p_weapon_type TEXT,
    p_soldier_count INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_base_strength CONSTANT INTEGER := 1; 
    v_total_strength BIGINT := 0;
    v_remaining_soldiers INTEGER := p_soldier_count;
    v_weapon RECORD;
    v_weapon_strength BIGINT; -- changed to BIGINT
    v_count INTEGER;
BEGIN
    if p_soldier_count IS NULL OR p_soldier_count <= 0 THEN
        RETURN 0;
    END IF;

    -- Get weapons for this type, ordered by tier (best first)
    FOR v_weapon IN 
        SELECT uw.tier, uw.quantity, gwc.strength as config_strength
        FROM user_weapons uw
        JOIN game_weapon_configs gwc ON uw.weapon_type = gwc.weapon_type AND uw.tier = gwc.tier
        WHERE uw.user_id = p_user_id 
        AND uw.weapon_type = p_weapon_type 
        ORDER BY uw.tier DESC
    LOOP
        EXIT WHEN v_remaining_soldiers <= 0;
        
        -- Get weapon strength from config
        v_weapon_strength := v_weapon.config_strength;
        
        -- Calculate how many soldiers get this weapon
        v_count := LEAST(v_remaining_soldiers, v_weapon.quantity);
        
        -- Add strength: Unit Base + Weapon Strength
        v_total_strength := v_total_strength + (v_count * (v_base_strength + v_weapon_strength));
        v_remaining_soldiers := v_remaining_soldiers - v_count;
    END LOOP;
    
    -- Remaining soldiers without weapons have base strength
    IF v_remaining_soldiers > 0 THEN
        v_total_strength := v_total_strength + (v_remaining_soldiers * v_base_strength);
    END IF;
    
    RETURN v_total_strength;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. buy_weapon
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
    v_use_vault boolean;
    v_vault_gold bigint;
    v_available_gold bigint;
    v_gold_paid bigint;
    v_vault_paid bigint;
    us record; 
BEGIN
    v_user_id := auth.uid();
    
    -- Validate inputs
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    
    -- Get Config Cost
    SELECT cost INTO v_cost_per_unit
    FROM public.game_weapon_configs
    WHERE weapon_type = p_type AND tier = p_tier;

    IF v_cost_per_unit IS NULL THEN
        RAISE EXCEPTION 'Invalid weapon type or tier';
    END IF;

    -- Get user stats
    SELECT gold, research_weapons, use_vault_gold, vault 
    INTO v_current_gold, v_research_level, v_use_vault, v_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    IF v_research_level IS NULL THEN v_research_level := 0; END IF;

    -- Check if unlocked
    IF p_tier > 0 AND p_tier > v_research_level THEN
        RAISE EXCEPTION 'Weapon tier not yet researched';
    END IF;

    v_total_cost := v_cost_per_unit * p_quantity;

    -- Calculate Available Gold (including Vault if enabled)
    v_available_gold := v_current_gold;
    IF v_use_vault THEN
        v_available_gold := v_available_gold + COALESCE(v_vault_gold, 0);
    END IF;

    IF v_available_gold < v_total_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Spend Gold
    v_gold_paid := LEAST(v_current_gold, v_total_cost);
    v_vault_paid := v_total_cost - v_gold_paid;

    IF v_vault_paid > 0 AND NOT v_use_vault THEN
         RAISE EXCEPTION 'Not enough gold (Vault spending disabled)';
    END IF;

    -- Update Balances
    UPDATE public.user_stats
    SET gold = gold - v_gold_paid,
        vault = vault - v_vault_paid
    WHERE id = v_user_id;

    -- Add Weapon
    INSERT INTO public.user_weapons (user_id, weapon_type, tier, quantity)
    VALUES (v_user_id, p_type, p_tier, p_quantity)
    ON CONFLICT (user_id, weapon_type, tier)
    DO UPDATE SET quantity = user_weapons.quantity + p_quantity, updated_at = now();

    -- Recalculate stats immediately
    PERFORM recalculate_user_stats(v_user_id);

    -- Return updated stats
    SELECT * INTO us FROM public.user_stats WHERE id = v_user_id;
    RETURN row_to_json(us);
END;
$$;

-- 3. sell_weapon
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

    -- Get Config Cost
    SELECT cost INTO v_cost_per_unit
    FROM public.game_weapon_configs
    WHERE weapon_type = p_type AND tier = p_tier;

    IF v_cost_per_unit IS NULL THEN
         RAISE EXCEPTION 'Invalid weapon configuration';
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

    -- Recalculate stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
