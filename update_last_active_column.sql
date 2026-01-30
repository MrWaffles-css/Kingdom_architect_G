-- Add last_active_at column to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_active_at') THEN
        ALTER TABLE public.profiles ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create RPC to safely update last_active_at for the current user
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET last_active_at = NOW()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
