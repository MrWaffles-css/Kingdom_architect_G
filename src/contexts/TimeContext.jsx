import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useGame } from './GameContext';

const TimeContext = createContext();

export function useGameTime() {
    return useContext(TimeContext);
}

export function TimeProvider({ children }) {
    const { session, refreshUserData, setLoading, setError, setStats } = useGame();
    const [serverTime, setServerTime] = useState(new Date());
    const [lastProcessedTime, setLastProcessedTime] = useState(Date.now());

    // We keep lastRefreshedMinute in a ref so it doesn't trigger re-renders itself
    const lastRefreshedMinute = useRef(-1);

    // Server Time Sync & Safety Net Poller
    useEffect(() => {
        let timer = null;
        let offset = 0;

        const syncTime = async () => {
            // Get database NOW() to calculate offset
            // We assume get_server_time RPC exists, otherwise we'll fall back to local or specific query
            const { data, error } = await supabase.rpc('get_server_time');
            if (data) {
                const serverNow = new Date(data).getTime();
                const localNow = Date.now();
                offset = serverNow - localNow;
                console.log('[TimeContext] Server time sync offset:', offset, 'ms');
            }
        };

        syncTime();

        timer = setInterval(() => {
            const currentTimestamp = Date.now() + offset;
            const now = new Date(currentTimestamp);

            // Update the serverTime state for UI clocks
            setServerTime(now);

            // AUTO-REFRESH AT TOP OF MINUTE
            const currentMinute = now.getMinutes();
            const currentSecond = now.getSeconds();

            if (currentSecond === 1 && lastRefreshedMinute.current !== currentMinute && session?.user?.id) {
                console.log('[TimeContext] Top of minute: Refreshing data...');
                refreshUserData(session.user.id);
                lastRefreshedMinute.current = currentMinute;
            }

        }, 1000);

        return () => clearInterval(timer);
    }, [session, refreshUserData]);

    const value = {
        serverTime
    };

    return (
        <TimeContext.Provider value={value}>
            {children}
        </TimeContext.Provider>
    );
}
