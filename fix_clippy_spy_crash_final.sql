-- Final fix for Clippy Spy Crash
-- The previous attempt to insert into 'spy_reports' for Clippy failed because
-- the fake Clippy ID '00000000-0000-0000-0000-000000000000' does not exist in 'auth.users',
-- triggering a Foreign Key violation.
-- This script removes that specific INSERT for the Clippy case.

CREATE OR REPLACE FUNCTION public.spy_player(target_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    my_spy BIGINT;
    their_sentry BIGINT;
    target_stats RECORD;
    my_research_level INTEGER;
    steal_percent NUMERIC;
    stolen_amount BIGINT := 0;
    result JSONB;
BEGIN
    -- HANDLE CLIPPY (TUTORIAL)
    IF target_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        -- Insert fake report for tutorial detection (Feed)
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            auth.uid(),
            'spy_report',
            'Spy Report: Clippy',
            json_build_object(
                'gold', 50,
                'citizens', 10,
                'attack', 1,
                'defense', 1,
                'spy', 0,
                'sentry', 0,
                'from_tut', true
            )
        );

        -- NOTE: We CANNOT insert into 'public.spy_reports' for this fake ID 
        -- because 'spy_reports.target_user_id' references 'auth.users(id)',
        -- and the fake ID does not exist in auth.users. 
        -- We skip persistence for this specific tutorial action.

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Success! You spied on Clippy.',
            'data', jsonb_build_object(
                'gold', 50,
                'citizens', 10,
                'attack', 1,
                'defense', 1,
                'spy', 0, 
                'sentry', 0,
                'attack_soldiers', 0,
                'defense_soldiers', 0,
                'spies', 0,
                'sentries', 0
            )
        );
    END IF;

    -- REGULAR LOGIC
    SELECT spy, research_vault_steal INTO my_spy, my_research_level 
    FROM user_stats 
    WHERE id = auth.uid();
    
    IF my_research_level IS NULL THEN my_research_level := 0; END IF;
    
    SELECT * INTO target_stats FROM user_stats WHERE id = target_id;
    their_sentry := target_stats.sentry;
    
    IF my_spy > their_sentry THEN
        
        -- Logic: Vault Steal
        IF my_research_level > 0 AND target_stats.vault > 0 THEN
            steal_percent := my_research_level * 0.05;
            stolen_amount := FLOOR(target_stats.vault * steal_percent);
            
            IF stolen_amount > 0 THEN
                UPDATE user_stats
                SET vault = vault - stolen_amount
                WHERE id = target_id;
                
                UPDATE user_stats
                SET gold = gold + stolen_amount
                WHERE id = auth.uid();
            END IF;
        END IF;
    
        result := jsonb_build_object(
            'success', true,
            'message', 'Spy mission successful!',
            'data', jsonb_build_object(
                'gold', target_stats.gold,
                'citizens', target_stats.citizens,
                'attack', target_stats.attack,
                'defense', target_stats.defense,
                'spy', target_stats.spy,
                'sentry', target_stats.sentry,
                'attack_soldiers', target_stats.attack_soldiers,
                'defense_soldiers', target_stats.defense_soldiers,
                'spies', target_stats.spies,
                'sentries', target_stats.sentries,
                'vault_stolen', stolen_amount
            )
        );
        
        -- Create/Update Spy Report Entry
        -- This logic is fine for real users
        BEGIN
            INSERT INTO spy_reports (
                spy_user_id, target_user_id,
                gold, citizens, attack, defense, spy, sentry,
                attack_soldiers, defense_soldiers, spies, sentries,
                spied_at
            ) VALUES (
                auth.uid(), target_id,
                target_stats.gold, target_stats.citizens,
                target_stats.attack, target_stats.defense,
                target_stats.spy, target_stats.sentry,
                target_stats.attack_soldiers, target_stats.defense_soldiers,
                target_stats.spies, target_stats.sentries,
                NOW()
            )
            ON CONFLICT (spy_user_id, target_user_id)
            DO UPDATE SET
                gold = EXCLUDED.gold,
                citizens = EXCLUDED.citizens,
                attack = EXCLUDED.attack,
                defense = EXCLUDED.defense,
                spy = EXCLUDED.spy,
                sentry = EXCLUDED.sentry,
                attack_soldiers = EXCLUDED.attack_soldiers,
                defense_soldiers = EXCLUDED.defense_soldiers,
                spies = EXCLUDED.spies,
                sentries = EXCLUDED.sentries,
                spied_at = NOW();
        EXCEPTION WHEN OTHERS THEN
            -- Ignore spy_reports insert errors to prevent transaction failure
            -- but still return the spy result to the user
            RAISE WARNING 'Failed to save spy report: %', SQLERRM;
        END;
            
        -- Also insert into reports for unified feed validation
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            auth.uid(),
            'spy_report',
            'Spy Report: ' || (SELECT username FROM profiles WHERE id = target_id),
            result
        );

        RETURN result;
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Your spies were detected! Their sentry rating is too high.'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Fallback for non-existent users
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Spy mission failed: Target not found or error.'
    );
END;
$function$;
