-- Add Barracks Upgrades and Triangular Strength Logic

-- 1. Ensure barracks_level exists (safe check)
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS barracks_level INT DEFAULT 1;

-- 2. Update Strength Calculation with Triangle Formula
-- Formula: (Level * (Level + 1)) / 2
-- Lvl 1: 1, Lvl 2: 3, Lvl 3: 6 ... Lvl 10: 55
CREATE OR REPLACE FUNCTION calculate_weapon_strength(
    p_user_id UUID,
    p_weapon_type TEXT,
    p_soldier_count INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_barracks_level INTEGER;
    v_base_strength INTEGER;
    v_total_strength BIGINT := 0;
    v_remaining_soldiers INTEGER := p_soldier_count;
    v_weapon RECORD;
    v_weapon_strength INTEGER;
    v_count INTEGER;
BEGIN
    -- If no soldiers, return 0
    IF p_soldier_count <= 0 THEN
        RETURN 0;
    END IF;

    -- Get Barracks Level
    SELECT COALESCE(barracks_level, 1) INTO v_barracks_level
    FROM user_stats
    WHERE id = p_user_id;

    -- Triangular Number Formula
    v_base_strength := (v_barracks_level * (v_barracks_level + 1)) / 2;

    -- Get weapons for this type, ordered by tier (best first)
    FOR v_weapon IN 
        SELECT tier, quantity 
        FROM user_weapons 
        WHERE user_id = p_user_id 
        AND weapon_type = p_weapon_type 
        ORDER BY tier DESC
    LOOP
        EXIT WHEN v_remaining_soldiers <= 0;
        
        -- Get weapon strength based on tier
        v_weapon_strength := CASE v_weapon.tier
            WHEN 0 THEN 1
            WHEN 1 THEN 12
            WHEN 2 THEN 150
            WHEN 3 THEN 2000
            WHEN 4 THEN 25000
            WHEN 5 THEN 300000
            ELSE 1
        END;
        
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

-- 3. Create Upgrade Barracks Function
CREATE OR REPLACE FUNCTION upgrade_barracks(p_target_level INT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_level int;
    v_gold bigint;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();

    -- Get current stats
    SELECT barracks_level, gold INTO v_current_level, v_gold
    FROM user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 1);

    -- If target level is not provided (0 or null), assume next level
    IF p_target_level IS NULL OR p_target_level = 0 THEN
        p_target_level := v_current_level + 1;
    END IF;

    -- Validate Request
    IF p_target_level != v_current_level + 1 THEN
        RAISE EXCEPTION 'Invalid upgrade target level';
    END IF;

    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Barracks are already at max level';
    END IF;

    -- Calculate Cost
    -- Level 2: 10k, 3: 25k, 4: 50k, 5: 100k, 6: 250k, 7: 500k, 8: 1M, 9: 2.5M, 10: 5M
    v_cost := CASE p_target_level
        WHEN 2 THEN 10000
        WHEN 3 THEN 25000
        WHEN 4 THEN 50000
        WHEN 5 THEN 100000
        WHEN 6 THEN 250000
        WHEN 7 THEN 500000
        WHEN 8 THEN 1000000
        WHEN 9 THEN 2500000
        WHEN 10 THEN 5000000
        ELSE 999999999 -- Should not happen due to level check
    END;

    IF v_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold and Upgrade
    UPDATE user_stats
    SET gold = gold - v_cost,
        barracks_level = p_target_level
    WHERE id = v_user_id;

    -- Recalculate Stats (Strength checks barracks level now)
    PERFORM recalculate_user_stats(v_user_id);

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;

-- 4. Recalculate existing stats to apply new base strength immediately
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM user_stats LOOP
        PERFORM recalculate_user_stats(v_user.id);
    END LOOP;
END $$;
