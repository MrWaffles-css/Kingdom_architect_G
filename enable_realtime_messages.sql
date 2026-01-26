-- Enable Realtime for alliance_messages
-- This is often required for the client to receive INSERT events
-- Add the table to the supabase_realtime publication

BEGIN;
  -- Remove if already exists to be safe, or just adding to publication usually handles duplicates gracefully or errors.
  -- Better to alter publication.
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alliance_messages;
COMMIT;
