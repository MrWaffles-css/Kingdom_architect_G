-- Create Kingdom Configs Table and Functions
-- This follows the pattern of the Hostage System (JSONB for levels)

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.kingdom_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert default configuration if empty
INSERT INTO public.kingdom_configs (id, levels)
SELECT 1, '[
    {"level": 1, "cost": 1000, "citizens_per_minute": 1},
    {"level": 2, "cost": 2500, "citizens_per_minute": 3},
    {"level": 3, "cost": 5000, "citizens_per_minute": 6},
    {"level": 4, "cost": 10000, "citizens_per_minute": 10},
    {"level": 5, "cost": 25000, "citizens_per_minute": 15},
    {"level": 6, "cost": 50000, "citizens_per_minute": 25},
    {"level": 7, "cost": 100000, "citizens_per_minute": 40},
    {"level": 8, "cost": 250000, "citizens_per_minute": 60},
    {"level": 9, "cost": 500000, "citizens_per_minute": 90},
    {"level": 10, "cost": 1000000, "citizens_per_minute": 135}
]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.kingdom_configs WHERE id = 1);

-- 3. Function to get config
CREATE OR REPLACE FUNCTION public.get_kingdom_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT row_to_json(kingdom_configs) FROM public.kingdom_configs WHERE id = 1);
END;
$$;

-- 4. Function to update config
CREATE OR REPLACE FUNCTION public.update_kingdom_config(
    p_levels jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    -- Check admin permission
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_user_id;
    
    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    UPDATE public.kingdom_configs
    SET levels = p_levels,
        updated_at = NOW()
    WHERE id = 1;
    
    RETURN (SELECT row_to_json(kingdom_configs) FROM public.kingdom_configs WHERE id = 1);
END;
$$;

-- 5. Add to mechanics list helper (optional, depends on how get_all_mechanics works)
-- If get_all_mechanics relies on a hardcoded list or DB table, we might need to update it.
-- Based on AdminPanel.jsx check, it fetches from `get_all_mechanics`.
-- Let's check `create_game_mechanics_system.sql` if we need to register this mechanic.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_mechanics') THEN
        INSERT INTO public.game_mechanics (key, enabled)
        VALUES ('kingdom_system', true)
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;
