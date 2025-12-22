-- Update Tech Multiplier Function - Every Level Increases Stats
-- Run this to replace the multiplier function with one that increases every level

CREATE OR REPLACE FUNCTION public.get_tech_multiplier(p_level int)
RETURNS float
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_level <= 0 THEN RETURN 1.0; END IF;
    CASE p_level
        WHEN 0 THEN RETURN 1.00;   -- +0%
        WHEN 1 THEN RETURN 1.05;   -- +5%
        WHEN 2 THEN RETURN 1.10;   -- +10%
        WHEN 3 THEN RETURN 1.15;   -- +15%
        WHEN 4 THEN RETURN 1.20;   -- +20%
        WHEN 5 THEN RETURN 1.25;   -- +25%
        WHEN 6 THEN RETURN 1.30;   -- +30%
        WHEN 7 THEN RETURN 1.35;   -- +35%
        WHEN 8 THEN RETURN 1.40;   -- +40%
        WHEN 9 THEN RETURN 1.45;   -- +45%
        WHEN 10 THEN RETURN 1.50;  -- +50%
        WHEN 11 THEN RETURN 1.55;  -- +55%
        WHEN 12 THEN RETURN 1.60;  -- +60%
        WHEN 13 THEN RETURN 1.65;  -- +65%
        WHEN 14 THEN RETURN 1.70;  -- +70%
        WHEN 15 THEN RETURN 1.75;  -- +75%
        WHEN 16 THEN RETURN 1.80;  -- +80%
        WHEN 17 THEN RETURN 1.85;  -- +85%
        WHEN 18 THEN RETURN 1.90;  -- +90%
        WHEN 19 THEN RETURN 1.95;  -- +95%
        WHEN 20 THEN RETURN 2.00;  -- +100%
        WHEN 21 THEN RETURN 2.10;  -- +110%
        WHEN 22 THEN RETURN 2.20;  -- +120%
        WHEN 23 THEN RETURN 2.30;  -- +130%
        WHEN 24 THEN RETURN 2.40;  -- +140%
        WHEN 25 THEN RETURN 2.50;  -- +150%
        WHEN 26 THEN RETURN 2.60;  -- +160%
        WHEN 27 THEN RETURN 2.70;  -- +170%
        WHEN 28 THEN RETURN 2.80;  -- +180%
        WHEN 29 THEN RETURN 2.90;  -- +190%
        WHEN 30 THEN RETURN 3.00;  -- +200%
        WHEN 31 THEN RETURN 3.15;  -- +215%
        WHEN 32 THEN RETURN 3.30;  -- +230%
        WHEN 33 THEN RETURN 3.45;  -- +245%
        WHEN 34 THEN RETURN 3.60;  -- +260%
        WHEN 35 THEN RETURN 3.75;  -- +275%
        WHEN 36 THEN RETURN 3.90;  -- +290%
        WHEN 37 THEN RETURN 4.05;  -- +305%
        WHEN 38 THEN RETURN 4.20;  -- +320%
        WHEN 39 THEN RETURN 4.35;  -- +335%
        WHEN 40 THEN RETURN 4.50;  -- +350%
        WHEN 41 THEN RETURN 4.70;  -- +370%
        WHEN 42 THEN RETURN 4.90;  -- +390%
        WHEN 43 THEN RETURN 5.10;  -- +410%
        WHEN 44 THEN RETURN 5.30;  -- +430%
        WHEN 45 THEN RETURN 5.50;  -- +450%
        WHEN 46 THEN RETURN 5.70;  -- +470%
        WHEN 47 THEN RETURN 5.90;  -- +490%
        WHEN 48 THEN RETURN 6.10;  -- +510%
        WHEN 49 THEN RETURN 6.30;  -- +530%
        WHEN 50 THEN RETURN 6.50;  -- +550%
        WHEN 51 THEN RETURN 6.75;  -- +575%
        WHEN 52 THEN RETURN 7.00;  -- +600%
        WHEN 53 THEN RETURN 7.25;  -- +625%
        WHEN 54 THEN RETURN 7.50;  -- +650%
        WHEN 55 THEN RETURN 7.75;  -- +675%
        WHEN 56 THEN RETURN 8.00;  -- +700%
        WHEN 57 THEN RETURN 8.30;  -- +730%
        WHEN 58 THEN RETURN 8.60;  -- +760%
        WHEN 59 THEN RETURN 8.90;  -- +790%
        WHEN 60 THEN RETURN 9.20;  -- +820%
        WHEN 61 THEN RETURN 9.50;  -- +850%
        WHEN 62 THEN RETURN 9.80;  -- +880%
        WHEN 63 THEN RETURN 10.00; -- +900%
        ELSE RETURN 10.00; -- Cap at +900%
    END CASE;
END;
$$;

-- Recalculate all user stats with new multipliers
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM user_stats LOOP
        PERFORM recalculate_user_stats(v_user.id);
    END LOOP;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
