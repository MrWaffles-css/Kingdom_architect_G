-- Turns Per Minute Research Configuration System
-- Allows admins to configure the "Increase Turns per Minute" research

-- 1. Create turns_research_configs table
CREATE TABLE IF NOT EXISTS public.turns_research_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Populate with default configuration (5 levels, matching current system)
DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
BEGIN
    v_levels := jsonb_build_array(
        jsonb_build_object('level', 1, 'cost', 1000, 'turns_per_min', 1),
        jsonb_build_object('level', 2, 'cost', 5000, 'turns_per_min', 2),
        jsonb_build_object('level', 3, 'cost', 25000, 'turns_per_min', 4),
        jsonb_build_object('level', 4, 'cost', 100000, 'turns_per_min', 8),
        jsonb_build_object('level', 5, 'cost', 500000, 'turns_per_min', 15)
    );

    IF EXISTS (SELECT 1 FROM turns_research_configs) THEN
        UPDATE turns_research_configs 
        SET levels = v_levels, 
            updated_at = NOW();
    ELSE
        INSERT INTO turns_research_configs (levels) 
        VALUES (v_levels);
    END IF;
END $$;

-- 3. Create function to get turns research config
CREATE OR REPLACE FUNCTION get_turns_research_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT to_jsonb(c) 
        FROM (
            SELECT levels, updated_at 
            FROM turns_research_configs 
            LIMIT 1
        ) c
    );
END;
$$;

-- 4. Create function to update turns research config (admin only)
CREATE OR REPLACE FUNCTION update_turns_research_config(
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
    
    -- Update with WHERE clause (update first row, or all rows if you prefer)
    UPDATE turns_research_configs
    SET levels = p_levels,
        updated_at = NOW()
    WHERE id = (SELECT MIN(id) FROM turns_research_configs);
        
    -- If no rows exist, insert
    IF NOT FOUND THEN
        INSERT INTO turns_research_configs (levels) 
        VALUES (p_levels);
    END IF;
END;
$$;

-- 5. Update upgrade_research_turns to use dynamic config
CREATE OR REPLACE FUNCTION public.upgrade_research_turns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
    v_config jsonb;
    v_level_config jsonb;
    v_max_level int;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats (XP instead of gold)
    SELECT experience, research_turns_per_min INTO v_current_xp, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    -- Get configuration
    SELECT levels INTO v_config FROM turns_research_configs LIMIT 1;
    
    IF v_config IS NOT NULL THEN
        v_max_level := (
            SELECT MAX((item->>'level')::int)
            FROM jsonb_array_elements(v_config) item
        );
    ELSE
        v_max_level := 5;
    END IF;

    -- Check Max Level
    IF v_current_level >= v_max_level THEN
        RAISE EXCEPTION 'Max research level reached';
    END IF;

    -- Get cost for next level from config
    IF v_config IS NOT NULL THEN
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = v_current_level + 1;
        
        IF v_level_config IS NULL THEN
            RAISE EXCEPTION 'Invalid level configuration';
        END IF;
        
        v_cost := (v_level_config->>'cost')::bigint;
    ELSE
        -- Fallback to hardcoded costs (XP costs)
        IF v_current_level = 0 THEN v_cost := 1000;
        ELSIF v_current_level = 1 THEN v_cost := 5000;
        ELSIF v_current_level = 2 THEN v_cost := 25000;
        ELSIF v_current_level = 3 THEN v_cost := 100000;
        ELSIF v_current_level = 4 THEN v_cost := 500000;
        ELSE
            RAISE EXCEPTION 'Invalid level';
        END IF;
    END IF;

    -- Validation (check XP instead of gold)
    IF v_current_xp < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % (Have %)', v_cost, v_current_xp;
    END IF;

    -- Deduct XP & Upgrade (not gold)
    UPDATE public.user_stats
    SET experience = experience - v_cost,
        research_turns_per_min = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 6. Create helper function to get turns per minute for a level
CREATE OR REPLACE FUNCTION get_turns_per_minute(p_level int)
RETURNS int
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_config jsonb;
    v_level_config jsonb;
BEGIN
    IF p_level <= 0 THEN RETURN 0; END IF;

    -- Get configuration
    SELECT levels INTO v_config FROM turns_research_configs LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Fallback to hardcoded values
        IF p_level = 1 THEN RETURN 1;
        ELSIF p_level = 2 THEN RETURN 2;
        ELSIF p_level = 3 THEN RETURN 4;
        ELSIF p_level = 4 THEN RETURN 8;
        ELSIF p_level >= 5 THEN RETURN 15;
        END IF;
        RETURN 0;
    ELSE
        -- Use dynamic configuration
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = p_level;
        
        IF v_level_config IS NULL THEN
            -- If level not found, return max turns from config
            RETURN (
                SELECT MAX((item->>'turns_per_min')::int)
                FROM jsonb_array_elements(v_config) item
            );
        END IF;
        
        RETURN (v_level_config->>'turns_per_min')::int;
    END IF;
END;
$$;

-- 7. Ensure game mechanic exists
INSERT INTO game_mechanics (key, enabled, description) 
VALUES ('turns_research_system', true, 'Research to increase turns generated per minute')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON turns_research_configs TO authenticated;
GRANT EXECUTE ON FUNCTION get_turns_research_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_turns_research_config(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_turns_per_minute(int) TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_research_turns() TO authenticated;
