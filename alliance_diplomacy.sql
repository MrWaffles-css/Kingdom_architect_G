-- Alliance Diplomacy System
-- Allows alliance leaders to set diplomatic relations with other alliances

-- Create alliance_relations table
CREATE TABLE IF NOT EXISTS public.alliance_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alliance_id UUID NOT NULL REFERENCES public.alliances(id) ON DELETE CASCADE,
    target_alliance_id UUID NOT NULL REFERENCES public.alliances(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL CHECK (relation_type IN ('neutral', 'ally', 'enemy')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alliance_id, target_alliance_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alliance_relations_alliance ON public.alliance_relations(alliance_id);
CREATE INDEX IF NOT EXISTS idx_alliance_relations_target ON public.alliance_relations(target_alliance_id);

-- RLS Policies
ALTER TABLE public.alliance_relations ENABLE ROW LEVEL SECURITY;

-- Anyone can view relations
CREATE POLICY "Anyone can view alliance relations"
    ON public.alliance_relations FOR SELECT
    USING (true);

-- Only alliance leaders can insert/update/delete relations
CREATE POLICY "Alliance leaders can manage relations"
    ON public.alliance_relations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.alliances a
            WHERE a.id = alliance_relations.alliance_id
            AND a.leader_id = auth.uid()
        )
    );

-- Function to get all alliances with their relation status
CREATE OR REPLACE FUNCTION public.get_alliance_diplomacy()
RETURNS TABLE (
    alliance_id UUID,
    alliance_name TEXT,
    alliance_description TEXT,
    member_count INTEGER,
    relation_type TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_alliance_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Get user's alliance
    SELECT p.alliance_id INTO v_alliance_id
    FROM public.profiles p
    WHERE p.id = v_user_id;
    
    IF v_alliance_id IS NULL THEN
        RAISE EXCEPTION 'You are not in an alliance';
    END IF;
    
    -- Return all other alliances with their relation status
    RETURN QUERY
    SELECT 
        a.id,
        a.name,
        a.description,
        a.member_count,
        COALESCE(ar.relation_type, 'neutral') as relation_type
    FROM public.alliances a
    LEFT JOIN public.alliance_relations ar 
        ON ar.alliance_id = v_alliance_id 
        AND ar.target_alliance_id = a.id
    WHERE a.id != v_alliance_id
    ORDER BY a.name ASC;
END;
$$;

-- Function to set alliance relation
CREATE OR REPLACE FUNCTION public.set_alliance_relation(
    p_target_alliance_id UUID,
    p_relation_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_alliance_id UUID;
    v_is_leader BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Validate relation type
    IF p_relation_type NOT IN ('neutral', 'ally', 'enemy') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid relation type');
    END IF;
    
    -- Get user's alliance and check if leader
    SELECT p.alliance_id INTO v_alliance_id
    FROM public.profiles p
    WHERE p.id = v_user_id;
    
    IF v_alliance_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'You are not in an alliance');
    END IF;
    
    -- Check if user is the leader
    SELECT (a.leader_id = v_user_id) INTO v_is_leader
    FROM public.alliances a
    WHERE a.id = v_alliance_id;
    
    IF NOT v_is_leader THEN
        RETURN jsonb_build_object('success', false, 'message', 'Only the alliance leader can set diplomatic relations');
    END IF;
    
    -- Check if target alliance exists
    IF NOT EXISTS (SELECT 1 FROM public.alliances WHERE id = p_target_alliance_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Target alliance does not exist');
    END IF;
    
    -- Cannot set relation with own alliance
    IF p_target_alliance_id = v_alliance_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot set diplomatic relation with your own alliance');
    END IF;
    
    -- If neutral, delete the relation record (default is neutral)
    IF p_relation_type = 'neutral' THEN
        DELETE FROM public.alliance_relations
        WHERE alliance_id = v_alliance_id
        AND target_alliance_id = p_target_alliance_id;
    ELSE
        -- Insert or update the relation
        INSERT INTO public.alliance_relations (alliance_id, target_alliance_id, relation_type)
        VALUES (v_alliance_id, p_target_alliance_id, p_relation_type)
        ON CONFLICT (alliance_id, target_alliance_id)
        DO UPDATE SET 
            relation_type = p_relation_type,
            updated_at = NOW();
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Diplomatic relation updated');
END;
$$;
