-- Update the handle_new_user function to give 2 citizens and 600 EXP by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, is_admin)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), 
        NEW.email, 
        false
    );

    INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level)
    VALUES (
        NEW.id, 
        0,    -- gold
        600,  -- experience (UPDATED FROM 1000)
        0,    -- turns
        0,    -- vault
        1,    -- rank
        2,    -- citizens
        0     -- kingdom_level
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
