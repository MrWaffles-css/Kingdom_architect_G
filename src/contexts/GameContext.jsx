import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'

const GameContext = createContext()

export function useGame() {
    return useContext(GameContext)
}

export function GameProvider({ children }) {
    const [session, setSession] = useState(null)
    const [stats, setStats] = useState(null) // Start as null to distinguish "loading" from "empty"
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastProcessedTime, setLastProcessedTime] = useState(Date.now())

    const [isAdmin, setIsAdmin] = useState(false)
    const [desktopLayout, setDesktopLayout] = useState({})
    const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)


    // Default stats structure
    const defaultStats = {
        gold: 0,
        experience: 0,
        turns: 0,
        vault: 0,
        rank: 1,
        citizens: 0,
        kingdom_level: 0,
        attack: 0,
        defense: 0,
        spy: 0,
        sentry: 0,
        attack_soldiers: 0,
        defense_soldiers: 0,
        spies: 0,
        sentries: 0,
        miners: 0,
        gold_mine_level: 0,
        vault_level: 0,
        library_level: 1,
        research_turns_per_min: 0,
        research_weapons: 0,
        research_vault_steal: 0,
        use_vault_gold: false
    }

    const isFetching = useRef(false)


    // Robust data fetching function
    const refreshUserData = useCallback(async (userId, retries = 3) => {
        console.log('[refreshUserData] Called with userId:', userId, 'retries:', retries)

        if (!userId) {
            console.warn('[refreshUserData] No userId provided, exiting')
            return
        }

        if (isFetching.current) {
            console.warn('[refreshUserData] Already fetching, skipping duplicate call')
            return
        }

        isFetching.current = true
        console.log('[refreshUserData] Starting data fetch...')

        try {
            setError(null)

            // Parallel Fetching: Get Core Data First
            const profileReq = supabase.from('profiles').select('is_admin, desktop_layout, avatar_id, alliance_id').eq('id', userId).single();
            const statsReq = supabase.from('user_stats').select('*').eq('id', userId).single();

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Data fetch timeout after 10 seconds')), 10000)
            )

            // Race between actual fetch and timeout
            const [profileResponse, statsResponse] = await Promise.race([
                Promise.all([profileReq, statsReq]),
                timeoutPromise
            ])

            console.log('[refreshUserData] Core fetch complete')

            // 1. Process Admin Status & Profile Data
            let profileData = {};
            if (profileResponse.data) {
                setIsAdmin(profileResponse.data.is_admin)
                setDesktopLayout(profileResponse.data.desktop_layout || {})
                profileData = profileResponse.data;
            } else if (profileResponse.error) {
                console.error('[refreshUserData] Profile fetch error:', profileResponse.error)
            }

            // 2. Process User Stats (The Core Data)
            let userStats = statsResponse.data
            let statsError = statsResponse.error

            // Handle "User Not Found" by creating them
            if (statsError && statsError.code === 'PGRST116') {
                console.log('[refreshUserData] User not found, initializing new user...')
                const { data: newData, error: insertError } = await supabase
                    .from('user_stats')
                    .insert([{ ...defaultStats, id: userId }])
                    .select()
                    .single()

                if (insertError) throw insertError
                userStats = newData
                console.log('[refreshUserData] New user created successfully')
            } else if (statsError) {
                console.error('[refreshUserData] Stats error:', statsError)
                throw statsError
            }

            // 3. Update State with Core Data IMMEDIATELY
            if (userStats) {
                const initialStats = {
                    ...defaultStats,
                    ...userStats,
                    avatar_id: profileData.avatar_id,
                    alliance_id: profileData.alliance_id // Add alliance_id
                }

                setStats(prev => {
                    // Timestamp Guard: Prevent overwriting newer data with stale fetch results
                    // This handles race conditions where an optimistic update (via RPC) is newer than a slow fetch
                    if (prev?.updated_at && userStats.updated_at) {
                        const prevTime = new Date(prev.updated_at).getTime();
                        const newTime = new Date(userStats.updated_at).getTime();

                        // If the fetched data is older than what we have, ignore the user_stats portion
                        // We still want to merge in profile data if possible, but usually that's stable.
                        if (newTime < prevTime) {
                            console.warn('[refreshUserData] Ignored stale user_stats (preserved newer local state)', { newTime, prevTime });
                            // We still merge profile data just in case, but keep stats from prev
                            return {
                                ...prev,
                                is_admin: isAdmin, // profile/admin data is separate
                                desktop_layout: desktopLayout, // separate state but synced here just in case? No, separate state.
                                // Don't revert other stats
                            };
                        }
                    }

                    return { ...prev, ...initialStats };
                })
                console.log('[refreshUserData] Core stats updated')

                // Sync time
                const dbTime = initialStats.updated_at ? new Date(initialStats.updated_at).getTime() : Date.now()
                setLastProcessedTime(dbTime)
            } else {
                throw new Error('No user stats available')
            }

            // 4. Fetch Leaderboard in background (Passive Update)
            supabase.from('leaderboard')
                .select('rank_attack, rank_defense, rank_spy, rank_sentry, overall_rank')
                .eq('id', userId)
                .maybeSingle()
                .then(({ data: rankData, error: rankError }) => {
                    if (rankData) {
                        console.log('[refreshUserData] Rank data loaded:', rankData)
                        setStats(prev => ({ ...prev, ...rankData }))
                    } else if (rankError) {
                        console.error('[refreshUserData] Rank fetch error:', rankError)
                    }
                })

        } catch (err) {
            console.error('[refreshUserData] Data fetch error:', err)
            if (retries > 0) {
                console.log(`[refreshUserData] Retrying... (${retries} attempts left)`)
                isFetching.current = false // Reset lock before retry
                setTimeout(() => refreshUserData(userId, retries - 1), 1000)
                return // Exit this execution
            } else {
                // Final retry failed - set error AND ensure loading is false
                console.error('[refreshUserData] All retries exhausted, setting error state')
                setError(err.message || 'Failed to load game data')
                setLoading(false)  // CRITICAL: Stop the loading state
            }
        } finally {
            isFetching.current = false
            console.log('[refreshUserData] Fetch lock released')
        }
    }, [])

    // Initial Session Setup
    useEffect(() => {
        let mounted = true

        // Safety timeout to prevent infinite loading
        const safetyTimer = setTimeout(() => {
            if (mounted) {
                console.warn('Loading timed out')
                setLoading(false)
                setStats(currentStats => {
                    if (!currentStats) {
                        setError('Connection timed out. Please refresh.')
                    }
                    return currentStats
                })
            }
        }, 15000) // Increased to 15s for cold starts

        const init = async () => {
            try {
                // Parallelize initial critical checks
                const [
                    { data: maintenanceData, error: maintenanceError },
                    { data: { session: initialSession }, error: sessionError }
                ] = await Promise.all([
                    supabase.rpc('get_maintenance_mode'),
                    supabase.auth.getSession()
                ]);

                if (!maintenanceError) {
                    setIsMaintenanceMode(maintenanceData);
                }

                if (sessionError) {
                    console.error('Session error:', sessionError)
                    await supabase.auth.signOut()
                    throw sessionError
                }

                if (mounted) {
                    setSession(initialSession)
                    if (initialSession) {
                        await refreshUserData(initialSession.user.id)
                    }
                    setLoading(false)
                }
            } catch (err) {
                console.error('Session init failed:', err)
                if (mounted) {
                    // Clear any stale auth data
                    try {
                        await supabase.auth.signOut()
                        localStorage.removeItem('kingdom-architect-auth')
                    } catch (cleanupError) {
                        console.error('Cleanup failed:', cleanupError)
                    }
                    setError('Failed to initialize session. Please refresh the page.')
                    setLoading(false)
                }
            } finally {
                clearTimeout(safetyTimer)
            }
        }

        init()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!mounted) return

            console.log('Auth change:', event)
            setSession(newSession)

            if (newSession) {
                // Only trigger fetch on actual sign-in, not token refresh
                // Token refresh happens automatically and doesn't need a data refetch
                if (event === 'SIGNED_IN') {
                    await refreshUserData(newSession.user.id)
                }
            } else {
                setStats(null)
                setLoading(false)  // Ensure we're not stuck loading after sign out
            }
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [refreshUserData])

    const generateResources = useCallback(async () => {
        if (!session?.user?.id) return

        try {
            // "Lazy Evaluation": Call RPC to calculate and grant pending resources
            const { data, error } = await supabase.rpc('generate_resources')

            if (error) {
                console.error('Resource generation error:', error)
                return
            }

            if (data) {
                console.log('Resources generated:', data)
                setStats(prev => ({ ...prev, ...data }))

                // Sync time to prevent drift
                if (data.updated_at) {
                    setLastProcessedTime(new Date(data.updated_at).getTime())
                }
            }
        } catch (err) {
            console.error('Resource generation failed:', err)
        }
    }, [session])

    // Realtime Subscription for Instant Updates
    useEffect(() => {
        if (!session?.user?.id) return

        console.log('[GameContext] Setting up Realtime subscription for user:', session.user.id)

        const channel = supabase
            .channel('user-stats-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'user_stats',
                    filter: `id=eq.${session.user.id}`
                },
                (payload) => {
                    console.log('[GameContext] Realtime update received:', payload.new)
                    setStats(prev => {
                        if (!prev) return prev
                        // Merge the new stats into the existing state
                        // This preserves rank/profile data that isn't in user_stats table
                        const updated = { ...prev, ...payload.new }

                        // Sync specific fields that might need explicit casting or handling? 
                        // Usually not needed if names match.

                        // Update processing time
                        if (updated.updated_at) {
                            setLastProcessedTime(new Date(updated.updated_at).getTime())
                        }
                        return updated
                    })
                }
            )
            .subscribe((status) => {
                console.log(`[GameContext] Realtime subscription status: ${status}`)
            })



        return () => {
            console.log('[GameContext] Cleaning up Realtime subscription')
            supabase.removeChannel(channel)
        }
    }, [session])





    // Server Time Sync & Safety Net Poller
    // MOVED TO TimeContext.jsx
    // We still keep lastProcessedTime here for Realtime updates tracking but no longer update a 1-second clock state.

    // Helper to force a full reload and clear all cached auth data
    const fixSession = async () => {
        try {
            // Sign out from Supabase
            await supabase.auth.signOut()
            // Clear the auth storage key
            localStorage.removeItem('kingdom-architect-auth')
            // Clear any other Supabase keys (they start with 'sb-')
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) {
                    localStorage.removeItem(key)
                }
            })
        } catch (error) {
            console.error('Error during session cleanup:', error)
        } finally {
            // Force reload regardless of errors
            window.location.reload()
        }
    }

    const value = {
        session,
        stats,
        loading,
        error,
        isAdmin,
        isMaintenanceMode,

        refreshUserData,
        setStats, // Expose for optimistic updates from components
        fixSession,
        desktopLayout,

        saveDesktopLayout: async (newLayout) => {
            if (!session?.user?.id) return;
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ desktop_layout: newLayout })
                    .eq('id', session.user.id);

                if (error) throw error;

                // Optimistically update local state if we had a separate state for this
                // For now, we rely on the next fetch or local state in Desktop.jsx
                // But it's better to update a local context state here
                setDesktopLayout(newLayout);
            } catch (err) {
                console.error("Failed to save desktop layout:", err);
            }
        },
        generateResources
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    )
}
