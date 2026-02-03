-- Vault Stealing Configuration System
-- Allows admins to configure the "Increase Stolen %" research

-- 1. Create vault_stealing_configs table
CREATE TABLE IF NOT EXISTS public.vault_stealing_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Populate with default configuration
DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
BEGIN
    v_levels := jsonb_build_array(
        jsonb_build_object('level', 1, 'cost', 5000, 'steal_percent', 5),
        jsonb_build_object('level', 2, 'cost', 10000, 'steal_percent', 10),
        jsonb_build_object('level', 3, 'cost', 15000, 'steal_percent', 15),
        jsonb_build_object('level', 4, 'cost', 20000, 'steal_percent', 20),
        jsonb_build_object('level', 5, 'cost', 25000, 'steal_percent', 25)
    );

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
    
    -- Get current stats (use research_vault_steal)
    SELECT experience, research_vault_steal INTO v_current_xp, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    -- Get configuration
    SELECT levels INTO v_config FROM vault_stealing_configs LIMIT 1;
    
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
        -- Fallback to hardcoded costs
        v_cost := (v_current_level + 1) * 5000;
    END IF;

    -- Validation
    IF v_current_xp < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % (Have %)', v_cost, v_current_xp;
    END IF;

    -- Deduct XP & Upgrade
    UPDATE public.user_stats
    SET experience = experience - v_cost,
        research_vault_steal = research_vault_steal + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Recalculate stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 6. Create helper function to get steal percent for a level
CREATE OR REPLACE FUNCTION get_steal_percent(p_level int)
RETURNS int
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_config jsonb;
    v_level_config jsonb;
BEGIN
    IF p_level <= 0 THEN RETURN 0; END IF;

    SELECT levels INTO v_config FROM vault_stealing_configs LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Fallback
        RETURN p_level * 5;
    ELSE
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = p_level;
        
        IF v_level_config IS NULL THEN
            RETURN (
                SELECT MAX((item->>'steal_percent')::int)
                FROM jsonb_array_elements(v_config) item
            );
        END IF;
        
        RETURN (v_level_config->>'steal_percent')::int;
    END IF;
END;
$$;

-- 7. Ensure game mechanic exists
INSERT INTO game_mechanics (key, enabled, description) 
VALUES ('vault_stealing', true, 'Allow players to steal from vaults with research')
ON CONFLICT (key) DO NOTHING;

-- Grant access
GRANT SELECT ON vault_stealing_configs TO authenticated;
GRANT EXECUTE ON FUNCTION get_vault_stealing_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_vault_stealing_config(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_steal_percent(int) TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_research_vault_steal() TO authenticated;
