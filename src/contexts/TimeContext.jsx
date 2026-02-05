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

        // Main 1-second timer for UI updates and minute detection
        timer = setInterval(() => {
            const currentTimestamp = Date.now() + offset;
            const now = new Date(currentTimestamp);

            // Update the serverTime state for UI clocks
            setServerTime(now);

            // AUTO-REFRESH AT TOP OF MINUTE
            const currentMinute = now.getMinutes();
            const currentHour = now.getHours();

            // Create a unique minute identifier (0-1439 for minutes in a day)
            const minuteOfDay = currentHour * 60 + currentMinute;
            const lastMinuteOfDay = getLastGenerationMinute();

            // Check if we've crossed into a new minute
            // This is more reliable than checking currentSecond === 1
            if (minuteOfDay !== lastMinuteOfDay && session?.user?.id) {
                // Make sure we haven't already processed this minute
                // (handles the case where the interval fires multiple times in the same minute)
                const timeSinceLastGen = minuteOfDay - lastMinuteOfDay;

                // If it's been at least 1 minute (or we wrapped around midnight)
                if (timeSinceLastGen >= 1 || timeSinceLastGen < 0) {
                    triggerGeneration('minute boundary');
                    setLastGenerationMinute(minuteOfDay);
                }
            }

        }, 1000);

        // Safety net: Check every 10 seconds if we missed a minute boundary
        // This catches cases where the tab was throttled or suspended
        safetyTimer = setInterval(() => {
            if (!session?.user?.id) return;

            const currentTimestamp = Date.now() + offset;
            const now = new Date(currentTimestamp);
            const currentMinute = now.getMinutes();
            const currentHour = now.getHours();
            const minuteOfDay = currentHour * 60 + currentMinute;
            const lastMinuteOfDay = getLastGenerationMinute();

            // If we're in a different minute than last generation, trigger it
            if (minuteOfDay !== lastMinuteOfDay) {
                console.log('[TimeContext] Safety net: Caught missed minute boundary');
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
