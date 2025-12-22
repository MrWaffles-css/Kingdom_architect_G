import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        // Use localStorage but with better error handling
        storage: window.localStorage,
        storageKey: 'kingdom-architect-auth',
        // Auto-refresh tokens before they expire
        autoRefreshToken: true,
        // Persist session across page reloads
        persistSession: true,
        // Detect session from URL (for magic links, etc.)
        detectSessionInUrl: true,
        // Flow type for authentication
        flowType: 'pkce'
    }
})

