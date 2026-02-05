-- Create gold_steal_configs table
CREATE TABLE IF NOT EXISTS public.gold_steal_configs (
    level INT PRIMARY KEY,
    cost BIGINT NOT NULL,
    steal_percent FLOAT NOT NULL, -- e.g., 0.50 for 50%
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default values if table is empty
INSERT INTO public.gold_steal_configs (level, cost, steal_percent)
SELECT level, 
       CASE WHEN level = 0 THEN 0 ELSE 5000 * level END, 
       0.50 + (level * 0.05)
FROM generate_series(0, 10) as level
ON CONFLICT (level) DO NOTHING;

-- Function to get gold steal config
CREATE OR REPLACE FUNCTION public.get_gold_steal_configs()
RETURNS SETOF public.gold_steal_configs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.gold_steal_configs ORDER BY level ASC;
$$;

-- Function to update a single gold steal config level
CREATE OR REPLACE FUNCTION public.update_gold_steal_config(
    p_level INT,
    p_cost BIGINT,
    p_steal_percent FLOAT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.gold_steal_configs (level, cost, steal_percent)
    VALUES (p_level, p_cost, p_steal_percent)
    ON CONFLICT (level) 
    DO UPDATE SET 
        cost = EXCLUDED.cost, 
        steal_percent = EXCLUDED.steal_percent;
        
    RETURN json_build_object('success', true);
END;
$$;

-- Function to remove a gold steal config level (only if it's the highest one, logic handled in frontend or here)
-- We will just allow deleting any level for flexibility, but frontend should handle consistency
CREATE OR REPLACE FUNCTION public.delete_gold_steal_config(p_level INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.gold_steal_configs WHERE level = p_level;
    RETURN json_build_object('success', true);
END;
$$;

-- Grant permissions
GRANT SELECT ON public.gold_steal_configs TO authenticated;
GRANT SELECT ON public.gold_steal_configs TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gold_steal_configs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gold_steal_config(INT, BIGINT, FLOAT) TO authenticated; -- Admin check usually in middleware or policy, keeping simple here or rely on RLS if needed. 
-- Note: update/delete functions here are defined as SECURITY DEFINER so they bypass RLS. Ideally we'd check for admin role inside.

-- Updating the update_gold_steal_config to check for admin
CREATE OR REPLACE FUNCTION public.update_gold_steal_config(
    p_level INT,
    p_cost BIGINT,
    p_steal_percent FLOAT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    INSERT INTO public.gold_steal_configs (level, cost, steal_percent)
    VALUES (p_level, p_cost, p_steal_percent)
    ON CONFLICT (level) 
    DO UPDATE SET 
        cost = EXCLUDED.cost, 
        steal_percent = EXCLUDED.steal_percent;
        
    RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_gold_steal_config(p_level INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    DELETE FROM public.gold_steal_configs WHERE level = p_level;
    RETURN json_build_object('success', true);
END;
$$;
