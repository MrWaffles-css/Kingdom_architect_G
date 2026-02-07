import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useGame } from './GameContext';

const TimeContext = createContext();

export function useGameTime() {
    return useContext(TimeContext);
}

export function TimeProvider({ children }) {
    const { session, refreshUserData, setLoading, setError, setStats, generateResources } = useGame();
    const [serverTime, setServerTime] = useState(new Date());
    const [lastProcessedTime, setLastProcessedTime] = useState(Date.now());

    const [serverOffset, setServerOffset] = useState(0);

    // We keep lastRefreshedMinute in a ref so it doesn't trigger re-renders itself
    const lastRefreshedMinute = useRef(-1);

    // Server Time Sync & Safety Net Poller
    useEffect(() => {
        let timer = null;
        let safetyTimer = null;
        let offset = 0;

        const syncTime = async () => {
            // Get database NOW() to calculate offset (via get_server_time RPC)
            const { data, error } = await supabase.rpc('get_server_time');
            if (data) {
                const serverNow = new Date(data).getTime();
                const localNow = Date.now();
                offset = serverNow - localNow;
                setServerOffset(offset);
                console.log('[TimeContext] Server time sync offset:', offset, 'ms');
            }
        };

        // Get the last generation timestamp from localStorage
        const getLastGenerationMinute = () => {
            const stored = localStorage.getItem('last_generation_minute');
            return stored ? parseInt(stored, 10) : -1;
        };

        const setLastGenerationMinute = (minute) => {
            localStorage.setItem('last_generation_minute', minute.toString());
            lastRefreshedMinute.current = minute;
        };

        // Function to trigger resource generation
        const triggerGeneration = (reason = 'scheduled') => {
            if (!session?.user?.id) return;

            console.log(`[TimeContext] Triggering resource generation (${reason})`);

            // Trigger passive generation
            generateResources();

            // Refresh data (stats will be updated via generateResources return or next fetch)
            refreshUserData(session.user.id);
        };

        syncTime();

        // Main 1-second timer for UI updates and :00 second detection
        timer = setInterval(() => {
            const currentTimestamp = Date.now() + offset;
            const now = new Date(currentTimestamp);

            // Update the serverTime state for UI clocks
            setServerTime(now);

            // AUTO-REFRESH AT EXACTLY :00 SECONDS OF EACH MINUTE
            const currentMinute = now.getMinutes();
            const currentHour = now.getHours();
            const currentSecond = now.getSeconds();

            // Create a unique minute identifier (0-1439 for minutes in a day)
            const minuteOfDay = currentHour * 60 + currentMinute;
            const lastMinuteOfDay = getLastGenerationMinute();

            // Trigger at exactly :00 seconds AND we haven't processed this minute yet
            // Use seconds 0-1 window to be more forgiving (in case interval fires at 0.9s)
            if (currentSecond <= 1 && minuteOfDay !== lastMinuteOfDay && session?.user?.id) {
                console.log(`[TimeContext] Exact :00 trigger at ${currentHour}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')}`);

                // OPTIMIZATION: Do NOT generate resources on client. 
                // Rely on server-side cron job 'process_game_tick' which runs every minute.
                // triggering generation here causes a race condition/lock handling mess.
                // triggerGeneration('exact :00'); <-- REMOVED

                // Instead, just REFRESH data after a short delay to let server finish
                // Use a FIXED delay (e.g., 2s) so all players update at the same time (fairness)
                // but we still avoid the race condition of reading before the cron job commits.
                // Thundering herd of READS is acceptable for Postgres; Writes were the issue.
                const delay = 2000;

                console.log(`[TimeContext] Scheduling data refresh in ${delay}ms (syncing with server tick)`);
                setTimeout(() => {
                    refreshUserData(session.user.id);
                }, delay);

                setLastGenerationMinute(minuteOfDay);
            }

        }, 1000);

        // Safety net: Check every 10 seconds if we missed a minute
        // This catches cases where the :00 second was missed due to throttling
        safetyTimer = setInterval(() => {
            if (!session?.user?.id) return;

            const currentTimestamp = Date.now() + offset;
            const now = new Date(currentTimestamp);
            const currentMinute = now.getMinutes();
            const currentHour = now.getHours();
            const minuteOfDay = currentHour * 60 + currentMinute;
            const lastMinuteOfDay = getLastGenerationMinute();

            // If we're in a different minute than last generation, trigger it
            // This is a backup in case we missed the :00 second
            if (minuteOfDay !== lastMinuteOfDay) {
                console.log('[TimeContext] Safety net: Caught missed minute at :' + now.getSeconds());
                triggerGeneration('safety net');
                setLastGenerationMinute(minuteOfDay);
            }
        }, 10000); // Check every 10 seconds

        // Handle visibility change (when user returns to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && session?.user?.id) {
                console.log('[TimeContext] Tab became visible, syncing...');

                // 1. Calculate time
                const currentTimestamp = Date.now() + offset;
                const now = new Date(currentTimestamp);
                const currentMinute = now.getMinutes();
                const currentHour = now.getHours();
                const minuteOfDay = currentHour * 60 + currentMinute;
                const lastMinuteOfDay = getLastGenerationMinute();

                // 2. Check logic
                if (minuteOfDay !== lastMinuteOfDay) {
                    // If we missed a minute, trigger full generation (which includes refresh)
                    console.log('[TimeContext] Catching up on resources (minute change detected)');
                    triggerGeneration('tab return');
                    setLastGenerationMinute(minuteOfDay);
                } else {
                    // If just a quick tab switch, just refresh data to show latest attacks/etc
                    console.log('[TimeContext] Refreshing user data (no resource generation needed)');
                    refreshUserData(session.user.id);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(timer);
            clearInterval(safetyTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [session, refreshUserData, generateResources]);

    const value = {
        serverTime,
        serverOffset
    };

    return (
        <TimeContext.Provider value={value}>
            {children}
        </TimeContext.Provider>
    );
}
