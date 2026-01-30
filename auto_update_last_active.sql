-- Trigger to automatically update last_active_at on stats change
-- This ensures that "playing the game" (checking stats, buying units) updates activity status

CREATE OR REPLACE FUNCTION public.sync_last_active_from_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET last_active_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_last_active_from_stats ON public.user_stats;

CREATE TRIGGER trigger_update_last_active_from_stats
AFTER UPDATE ON public.user_stats
FOR EACH ROW
EXECUTE FUNCTION public.sync_last_active_from_stats();

NOTIFY pgrst, 'reload schema';
