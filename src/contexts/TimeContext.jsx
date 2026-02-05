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
                triggerGeneration('exact :00');
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
                console.log('[TimeContext] Tab became visible, checking for missed resources...');

                // Give a small delay to ensure browser is fully active
                setTimeout(() => {
                    const currentTimestamp = Date.now() + offset;
                    const now = new Date(currentTimestamp);
                    const currentMinute = now.getMinutes();
                    const currentHour = now.getHours();
                    const minuteOfDay = currentHour * 60 + currentMinute;
                    const lastMinuteOfDay = getLastGenerationMinute();

                    // If we're in a different minute, trigger generation
                    if (minuteOfDay !== lastMinuteOfDay) {
                        console.log('[TimeContext] Generating resources after tab return');
                        triggerGeneration('tab return');
                        setLastGenerationMinute(minuteOfDay);
                    }
                }, 500);
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
