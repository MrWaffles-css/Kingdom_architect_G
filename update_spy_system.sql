DO $$ 
BEGIN 
    -- Core Relationships
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN attacker_id uuid REFERENCES public.user_stats(id); EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN defender_id uuid REFERENCES public.user_stats(id); EXCEPTION WHEN duplicate_column THEN END;

    -- Infrastructure
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN kingdom_level int DEFAULT 1; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN gold_mine_level int DEFAULT 1; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN barracks_level int DEFAULT 1; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN vault_level int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN library_level int DEFAULT 1; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Units / Resources
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN gold bigint DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN vault bigint DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END; -- Added vault gold
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN citizens int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN miners int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN land int DEFAULT 100; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN hostages int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;

    -- Combat Stats
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN attack int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN defense int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN spy int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN sentry int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Unit Counts
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN attack_soldiers int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN defense_soldiers int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN spies int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN sentries int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Research
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN research_weapons int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN research_attack int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN research_defense int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN research_spy int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN research_sentry int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN research_turns_per_min int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.spy_reports ADD COLUMN research_hostage_convert int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;
    
    -- Make sure user_stats has the research column too (for the attacker check)
    BEGIN ALTER TABLE public.user_stats ADD COLUMN research_spy_report int DEFAULT 0; EXCEPTION WHEN duplicate_column THEN END;

END $$;

-- 2. Helper Function to get latest report with age calculation
DROP FUNCTION IF EXISTS public.get_latest_spy_report(uuid);

CREATE OR REPLACE FUNCTION public.get_latest_spy_report(target_id uuid)
RETURNS TABLE (
    id uuid, created_at timestamptz,
    attacker_id uuid, defender_id uuid,
    gold bigint, vault bigint, citizens int, land int,
    attack int, defense int, spy int, sentry int,
    attack_soldiers int, defense_soldiers int, spies int, sentries int, miners int,
    kingdom_level int, gold_mine_level int, barracks_level int, vault_level int, library_level int,
    research_weapons int, research_attack int, research_defense int, research_spy int, research_sentry int, research_turns_per_min int,
    hostages int, research_hostage_convert int,
    hours_old float
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sr.id, sr.created_at,
        sr.attacker_id, sr.defender_id,
        sr.gold, sr.vault, sr.citizens, sr.land,
        sr.attack, sr.defense, sr.spy, sr.sentry,
        sr.attack_soldiers, sr.defense_soldiers, sr.spies, sr.sentries, sr.miners,
        sr.kingdom_level, sr.gold_mine_level, sr.barracks_level, sr.vault_level, sr.library_level,
        sr.research_weapons, sr.research_attack, sr.research_defense, sr.research_spy, sr.research_sentry, sr.research_turns_per_min,
        sr.hostages, sr.research_hostage_convert,
        EXTRACT(EPOCH FROM (now() - sr.created_at)) / 3600.0 AS hours_old
    FROM public.spy_reports sr
    WHERE sr.attacker_id = auth.uid() AND sr.defender_id = target_id
    ORDER BY sr.created_at DESC
    LIMIT 1;
END;
$$;

-- 3. Update spy_player function
DROP FUNCTION IF EXISTS public.spy_player(uuid);

CREATE OR REPLACE FUNCTION public.spy_player(target_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
BEGIN
    v_attacker_id := auth.uid();

    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot spy on yourself';
    END IF;

    -- Get Attacker Stats
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;

    -- Get Defender Stats
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Target not found'; END IF;

    -- Spy Logic
    -- Simple check: if Spy > Sentry (with variance), Success.
    IF (v_attacker_stats.spy * (0.8 + random() * 0.4)) > (v_defender_stats.sentry * (0.8 + random() * 0.4)) THEN
        -- SUCCESS: Insert Report
        INSERT INTO public.spy_reports (
            attacker_id, defender_id, 
            gold, vault, citizens, land,
            attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries, miners,
            kingdom_level, gold_mine_level, barracks_level, vault_level, library_level,
            research_weapons, research_attack, research_defense, research_spy, research_sentry, research_turns_per_min,
            hostages, research_hostage_convert
        ) VALUES (
            v_attacker_id, target_id,
            v_defender_stats.gold, v_defender_stats.vault, v_defender_stats.citizens, v_defender_stats.land,
            v_defender_stats.attack, v_defender_stats.defense, v_defender_stats.spy, v_defender_stats.sentry,
            v_defender_stats.attack_soldiers, v_defender_stats.defense_soldiers, v_defender_stats.spies, v_defender_stats.sentries, v_defender_stats.miners,
            v_defender_stats.kingdom_level, v_defender_stats.gold_mine_level, v_defender_stats.barracks_level, v_defender_stats.vault_level, v_defender_stats.library_level,
            v_defender_stats.research_weapons, v_defender_stats.research_attack, v_defender_stats.research_defense, v_defender_stats.research_spy, v_defender_stats.research_sentry, v_defender_stats.research_turns_per_min,
            v_defender_stats.hostages, v_defender_stats.research_hostage_convert
        );

        RETURN json_build_object(
            'success', true, 
            'message', 'Spy report generated successfully.',
            'data', json_build_object(
                'gold', v_defender_stats.gold,
                'vault', v_defender_stats.vault,
                'citizens', v_defender_stats.citizens,
                'land', v_defender_stats.land,
                'attack', v_defender_stats.attack,
                'defense', v_defender_stats.defense,
                'spy', v_defender_stats.spy,
                'sentry', v_defender_stats.sentry,
                'attack_soldiers', v_defender_stats.attack_soldiers,
                'defense_soldiers', v_defender_stats.defense_soldiers,
                'spies', v_defender_stats.spies,
                'sentries', v_defender_stats.sentries,
                'miners', v_defender_stats.miners,
                'hostages', v_defender_stats.hostages,
                'kingdom_level', v_defender_stats.kingdom_level,
                'gold_mine_level', v_defender_stats.gold_mine_level,
                'barracks_level', v_defender_stats.barracks_level,
                'vault_level', v_defender_stats.vault_level,
                'library_level', v_defender_stats.library_level,
                'research_weapons', v_defender_stats.research_weapons,
                'research_attack', v_defender_stats.research_attack,
                'research_defense', v_defender_stats.research_defense,
                'research_spy', v_defender_stats.research_spy,
                'research_sentry', v_defender_stats.research_sentry,
                'research_turns_per_min', v_defender_stats.research_turns_per_min,
                'research_hostage_convert', v_defender_stats.research_hostage_convert
            )
        );
    ELSE
        -- FAILURE
        RETURN json_build_object('success', false, 'message', 'Spy mission failed! Their sentries detected your agents.');
    END IF;
END;
$$;

-- Function to upgrade spy report research
-- Cost: 5000 * (current_level + 1) XP
-- Max Level: 5

CREATE OR REPLACE FUNCTION public.upgrade_research_spy_report()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats record;
    v_cost int;
    v_new_level int;
BEGIN
    v_user_id := auth.uid();

    -- Get user stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;

    -- Calculate next level and cost
    -- Current Level 0 -> Next Level 1 -> Cost 5000
    -- Current Level 1 -> Next Level 2 -> Cost 10000
    v_new_level := COALESCE(v_stats.research_spy_report, 0) + 1;
    v_cost := 5000 * v_new_level;

    -- Validation
    IF v_new_level > 5 THEN
        RAISE EXCEPTION 'Max level of 5 reached for Spy Reports';
    END IF;

    IF v_stats.experience < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % XP', v_cost;
    END IF;

    -- Update
    UPDATE public.user_stats 
    SET 
        experience = experience - v_cost,
        research_spy_report = v_new_level
    WHERE id = v_user_id;

    -- Return updated stats for frontend
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;
    RETURN row_to_json(v_stats);
END;
$$;
