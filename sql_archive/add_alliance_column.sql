-- Add alliance column to user_stats table
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS alliance text DEFAULT NULL;

-- Update the handle_new_user function to include alliance
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

    INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level, attack, defense, spy, sentry, alliance)
    VALUES (
        NEW.id, 
        0,    -- gold
        1000, -- experience
        0,    -- turns
        0,    -- vault
        1,    -- rank
        2,    -- citizens
        0,    -- kingdom_level
        0,    -- attack
        0,    -- defense
        0,    -- spy
        0,    -- sentry
        NULL  -- alliance
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
