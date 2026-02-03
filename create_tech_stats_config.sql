-- Tech Stats Configuration System
-- Allows admins to configure Attack, Defense, Spy, and Sentry technology levels
-- All four techs share the same progression (costs and multipliers)

-- 1. Create tech_stats_configs table
CREATE TABLE IF NOT EXISTS public.tech_stats_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Populate with default configuration (63 levels, matching current system)
DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
    v_costs int[] := ARRAY[
        300, 340, 385, 435, 490, 550, 620, 700, 790, 890,
        1000, 1130, 1275, 1440, 1625, 1830, 2065, 2330, 2625, 2960,
        3340, 3765, 4245, 4785, 5395, 6080, 6855, 7725, 8710, 9820,
        11070, 12480, 14070, 15860, 17880, 20155, 22720, 25610, 28870, 32545,
        36685, 41350, 46610, 52540, 59225, 66760, 75255, 84830, 95625, 107790,
        121505, 136965, 154390, 174035, 196175, 221135, 249275, 281000, 316750, 357055,
        402490, 453700, 800000
    ];
    v_multipliers float[] := ARRAY[
        1.0, 1.10, 1.10, 1.20, 1.30, 1.30, 1.40, 1.50, 1.50, 1.60,
        1.70, 1.80, 1.80, 1.90, 2.00, 2.10, 2.20, 2.30, 2.50, 2.60,
        2.70, 2.80, 3.00, 3.10, 3.30, 3.40, 3.60, 3.80, 4.00, 4.20,
        4.40, 4.60, 4.80, 5.00, 5.30, 5.60, 5.80, 6.10, 6.40, 6.70,
        7.10, 7.40, 7.80, 8.20, 8.60, 9.00, 9.50, 10.00, 10.40, 11.00,
        11.50, 12.10, 12.70, 13.30, 14.00, 14.70, 15.40, 16.20, 17.00, 17.80,
        18.70, 19.70, 20.60, 21.70
    ];
    v_bonuses int[] := ARRAY[
        0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
        50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
        100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
        200, 215, 230, 245, 260, 275, 290, 305, 320, 335,
        350, 370, 390, 410, 430, 450, 470, 490, 510, 530,
        550, 575, 600, 625, 650, 675, 700, 730, 760, 790,
        820, 850, 880, 900
    ];
    i int;
BEGIN
    FOR i IN 1..63 LOOP
        v_levels := v_levels || jsonb_build_object(
            'level', i,
            'cost', v_costs[i],
            'multiplier', v_multipliers[i + 1],  -- +1 because level 1 uses multiplier[2]
            'bonus_percent', v_bonuses[i + 1]     -- +1 for same reason
        );
    END LOOP;

    IF EXISTS (SELECT 1 FROM tech_stats_configs) THEN
        UPDATE tech_stats_configs 
        SET levels = v_levels, 
            updated_at = NOW();
    ELSE
        INSERT INTO tech_stats_configs (levels) 
        VALUES (v_levels);
    END IF;
END $$;

-- 3. Create function to get tech stats config
CREATE OR REPLACE FUNCTION get_tech_stats_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT to_jsonb(c) 
        FROM (
            SELECT levels, updated_at 
            FROM tech_stats_configs 
            LIMIT 1
        ) c
    );
END;
$$;

-- 4. Create function to update tech stats config (admin only)
CREATE OR REPLACE FUNCTION update_tech_stats_config(
    p_levels jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_user_id;
    
    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    
    UPDATE tech_stats_configs
    SET levels = p_levels,
        updated_at = NOW();
        
    IF NOT FOUND THEN
        INSERT INTO tech_stats_configs (levels) 
        VALUES (p_levels);
    END IF;
END;
$$;

-- 5. Update get_tech_multiplier to use dynamic config
CREATE OR REPLACE FUNCTION public.get_tech_multiplier(p_level int)
RETURNS float
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_config jsonb;
    v_level_config jsonb;
BEGIN
    IF p_level <= 0 THEN RETURN 1.0; END IF;

    -- Get configuration
    SELECT levels INTO v_config FROM tech_stats_configs LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Fallback to hardcoded max multiplier
        IF p_level >= 63 THEN RETURN 21.70; END IF;
        RETURN 1.0;
    ELSE
        -- Use dynamic configuration
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = p_level;
        
        IF v_level_config IS NULL THEN
            -- If level not found, return max multiplier from config
            RETURN (
                SELECT MAX((item->>'multiplier')::float)
                FROM jsonb_array_elements(v_config) item
            );
        END IF;
        
        RETURN (v_level_config->>'multiplier')::float;
    END IF;
END;
$$;

-- 6. Update get_tech_video_cost to use dynamic config
CREATE OR REPLACE FUNCTION public.get_tech_video_cost(p_current_level int)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_config jsonb;
    v_level_config jsonb;
BEGIN
    -- Get configuration
    SELECT levels INTO v_config FROM tech_stats_configs LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Fallback to hardcoded max cost
        IF p_current_level >= 62 THEN RETURN 999999999; END IF;
        RETURN 300;
    ELSE
        -- Use dynamic configuration - get cost for NEXT level
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = p_current_level + 1;
        
        IF v_level_config IS NULL THEN
            -- Max level reached
            RETURN 999999999;
        END IF;
        
        RETURN (v_level_config->>'cost')::bigint;
    END IF;
END;
$$;

-- 7. Update upgrade functions to use dynamic config
CREATE OR REPLACE FUNCTION public.upgrade_research_attack()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_level int;
    v_experience bigint;
    v_cost bigint;
    v_new_stats json;
    v_config jsonb;
    v_max_level int;
BEGIN
    SELECT research_attack, experience
    INTO v_current_level, v_experience
    FROM user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    -- Get max level from config
    SELECT levels INTO v_config FROM tech_stats_configs LIMIT 1;
    IF v_config IS NOT NULL THEN
        v_max_level := (
            SELECT MAX((item->>'level')::int)
            FROM jsonb_array_elements(v_config) item
        );
    ELSE
        v_max_level := 63;
    END IF;

    IF v_current_level >= v_max_level THEN
        RAISE EXCEPTION 'Already at maximum level';
    END IF;

    v_cost := get_tech_video_cost(v_current_level);

    IF v_experience < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % (Have %)', v_cost, v_experience;
    END IF;

    UPDATE user_stats
    SET experience = experience - v_cost,
        research_attack = research_attack + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    PERFORM recalculate_user_stats(v_user_id);

    SELECT row_to_json(us) INTO v_new_stats
    FROM user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_research_defense()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_level int;
    v_experience bigint;
    v_cost bigint;
    v_new_stats json;
    v_config jsonb;
    v_max_level int;
BEGIN
    SELECT research_defense, experience
    INTO v_current_level, v_experience
    FROM user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    SELECT levels INTO v_config FROM tech_stats_configs LIMIT 1;
    IF v_config IS NOT NULL THEN
        v_max_level := (
            SELECT MAX((item->>'level')::int)
            FROM jsonb_array_elements(v_config) item
        );
    ELSE
        v_max_level := 63;
    END IF;

    IF v_current_level >= v_max_level THEN
        RAISE EXCEPTION 'Already at maximum level';
    END IF;

    v_cost := get_tech_video_cost(v_current_level);

    IF v_experience < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % (Have %)', v_cost, v_experience;
    END IF;

    UPDATE user_stats
    SET experience = experience - v_cost,
        research_defense = research_defense + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    PERFORM recalculate_user_stats(v_user_id);

    SELECT row_to_json(us) INTO v_new_stats
    FROM user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_research_spy()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_level int;
    v_experience bigint;
    v_cost bigint;
    v_new_stats json;
    v_config jsonb;
    v_max_level int;
BEGIN
    SELECT research_spy, experience
    INTO v_current_level, v_experience
    FROM user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    SELECT levels INTO v_config FROM tech_stats_configs LIMIT 1;
    IF v_config IS NOT NULL THEN
        v_max_level := (
            SELECT MAX((item->>'level')::int)
            FROM jsonb_array_elements(v_config) item
        );
    ELSE
        v_max_level := 63;
    END IF;

    IF v_current_level >= v_max_level THEN
        RAISE EXCEPTION 'Already at maximum level';
    END IF;

    v_cost := get_tech_video_cost(v_current_level);

    IF v_experience < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % (Have %)', v_cost, v_experience;
    END IF;

    UPDATE user_stats
    SET experience = experience - v_cost,
        research_spy = research_spy + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    PERFORM recalculate_user_stats(v_user_id);

    SELECT row_to_json(us) INTO v_new_stats
    FROM user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_research_sentry()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_level int;
    v_experience bigint;
    v_cost bigint;
    v_new_stats json;
    v_config jsonb;
    v_max_level int;
BEGIN
    SELECT research_sentry, experience
    INTO v_current_level, v_experience
    FROM user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    SELECT levels INTO v_config FROM tech_stats_configs LIMIT 1;
    IF v_config IS NOT NULL THEN
        v_max_level := (
            SELECT MAX((item->>'level')::int)
            FROM jsonb_array_elements(v_config) item
        );
    ELSE
        v_max_level := 63;
    END IF;

    IF v_current_level >= v_max_level THEN
        RAISE EXCEPTION 'Already at maximum level';
    END IF;

    v_cost := get_tech_video_cost(v_current_level);

    IF v_experience < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % (Have %)', v_cost, v_experience;
    END IF;

    UPDATE user_stats
    SET experience = experience - v_cost,
        research_sentry = research_sentry + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    PERFORM recalculate_user_stats(v_user_id);

    SELECT row_to_json(us) INTO v_new_stats
    FROM user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 8. Ensure game mechanic exists
INSERT INTO game_mechanics (key, enabled, description) 
VALUES ('tech_stats_system', true, 'Technology research for Attack, Defense, Spy, and Sentry stats')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON tech_stats_configs TO authenticated;
GRANT EXECUTE ON FUNCTION get_tech_stats_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_tech_stats_config(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tech_multiplier(int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tech_video_cost(int) TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_research_attack() TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_research_defense() TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_research_spy() TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_research_sentry() TO authenticated;
