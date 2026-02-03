-- Vault Stealing Configuration System
-- Allows admins to configure vault stealing research levels, costs, and percentages

-- 1. Create vault_stealing_configs table
CREATE TABLE IF NOT EXISTS public.vault_stealing_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Populate with default configuration (5 levels, matching current system)
DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
    i int;
BEGIN
    FOR i IN 1..5 LOOP
        v_levels := v_levels || jsonb_build_object(
            'level', i,
            'cost', CASE i
                WHEN 1 THEN 5000
                WHEN 2 THEN 10000
                WHEN 3 THEN 15000
                WHEN 4 THEN 20000
                WHEN 5 THEN 25000
                ELSE 0
            END,
            'steal_percent', i * 5  -- 5%, 10%, 15%, 20%, 25%
        );
    END LOOP;

    IF EXISTS (SELECT 1 FROM vault_stealing_configs) THEN
        UPDATE vault_stealing_configs 
        SET levels = v_levels, 
            updated_at = NOW();
    ELSE
        INSERT INTO vault_stealing_configs (levels) 
        VALUES (v_levels);
    END IF;
END $$;

-- 3. Create function to get vault stealing config
CREATE OR REPLACE FUNCTION get_vault_stealing_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT to_jsonb(c) 
        FROM (
            SELECT levels, updated_at 
            FROM vault_stealing_configs 
            LIMIT 1
        ) c
    );
END;
$$;

-- 4. Create function to update vault stealing config (admin only)
CREATE OR REPLACE FUNCTION update_vault_stealing_config(
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
    
    UPDATE vault_stealing_configs
    SET levels = p_levels,
        updated_at = NOW();
        
    IF NOT FOUND THEN
        INSERT INTO vault_stealing_configs (levels) 
        VALUES (p_levels);
    END IF;
END;
$$;

-- 5. Update upgrade_research_vault_steal to use dynamic config
CREATE OR REPLACE FUNCTION public.upgrade_research_vault_steal()
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
    v_level_config jsonb;
    v_max_level int;
BEGIN
    SELECT research_vault_steal, experience
    INTO v_current_level, v_experience
    FROM user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    -- Get configuration
    SELECT levels INTO v_config FROM vault_stealing_configs LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Fallback to hardcoded values
        IF v_current_level >= 5 THEN
            RAISE EXCEPTION 'Already at maximum level';
        END IF;
        
        v_cost := CASE v_current_level
            WHEN 0 THEN 5000
            WHEN 1 THEN 10000
            WHEN 2 THEN 15000
            WHEN 3 THEN 20000
            WHEN 4 THEN 25000
            ELSE 0
        END;
    ELSE
        -- Use dynamic configuration
        v_max_level := (
            SELECT MAX((item->>'level')::int)
            FROM jsonb_array_elements(v_config) item
        );
        
        IF v_current_level >= v_max_level THEN
            RAISE EXCEPTION 'Already at maximum level';
        END IF;
        
        -- Get cost for next level
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = v_current_level + 1;
        
        IF v_level_config IS NULL THEN
            RAISE EXCEPTION 'Configuration error: level % not found', v_current_level + 1;
        END IF;
        
        v_cost := (v_level_config->>'cost')::bigint;
    END IF;

    IF v_experience < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % (Have %)', v_cost, v_experience;
    END IF;

    UPDATE user_stats
    SET experience = experience - v_cost,
        research_vault_steal = research_vault_steal + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    PERFORM recalculate_user_stats(v_user_id);

    SELECT row_to_json(us) INTO v_new_stats
    FROM user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 6. Ensure game mechanic exists
INSERT INTO game_mechanics (key, enabled, description) 
VALUES ('vault_stealing', true, 'Allow players to steal from vaults with research')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON vault_stealing_configs TO authenticated;
GRANT EXECUTE ON FUNCTION get_vault_stealing_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_vault_stealing_config(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_research_vault_steal() TO authenticated;
