DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
    i int;
BEGIN
    -- Generate 100 levels mirroring src/gameConfig.js
    FOR i IN 1..100 LOOP
        v_levels := v_levels || jsonb_build_object(
            'level', i,
            'cost', i * 100,            -- Cost in Experience
            'citizens_per_minute', i    -- Citizens per minute
        );
    END LOOP;

    -- Update the config table
    -- If multiple rows exist (unlikely), update all or just one. Assuming one config row.
    IF EXISTS (SELECT 1 FROM kingdom_configs) THEN
        UPDATE kingdom_configs
        SET levels = v_levels,
            updated_at = NOW();
    ELSE
        INSERT INTO kingdom_configs (levels) VALUES (v_levels);
    END IF;
    
    RAISE NOTICE 'Kingdom configs populated with 100 levels.';
END $$;
