import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { supabase } from '../supabase';

const Taskbar = ({ openWindows, activeWindowId, onWindowClick, onStartClick, stats }) => {
    // Consume serverTime derived from GameContext updates
    const { serverTime } = useGame() || {};


    // Fallback to local time if context unavailable (for robust rendering)
    const [displayTime, setDisplayTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        // Use the passed serverTime from context which is synced to the server clock
        // If serverTime is not available, we fall back to a local interval
        if (serverTime) {
            setDisplayTime(new Date(serverTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } else {
            // Fallback local clock
            const timer = setInterval(() => {
                setDisplayTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [serverTime]);

    // Season Countdown Logic
    const [seasonEndTime, setSeasonEndTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        // Fetch initially
        fetchSeasonEnd();

        // Refresh schedule occasionally (e.g., every minute) in case it changes
        const scheduleInterval = setInterval(fetchSeasonEnd, 60000);
        return () => clearInterval(scheduleInterval);
    }, []);

    const fetchSeasonEnd = async () => {
        const { data, error } = await supabase.rpc('get_season_end_time');
        if (!error && data) {
            setSeasonEndTime(new Date(data));
        }
    };

    useEffect(() => {
        if (!seasonEndTime) return;

        const updateTimer = () => {
            const now = new Date();
            const diff = seasonEndTime - now;

            setIsUrgent(diff < 24 * 60 * 60 * 1000);

            if (diff <= 0) {
                setTimeLeft(null);
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                const pad = (n) => n.toString().padStart(2, '0');

                let timeString = '';
                if (days > 0) {
                    timeString = `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                } else {
                    timeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                }

                setTimeLeft(timeString);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [seasonEndTime]);


    return (
        <div className="fixed bottom-0 left-0 right-0 h-10 bg-[#c0c0c0] border-t-2 border-white flex items-center px-1 z-50 select-none">
            <button
                className="flex items-center gap-1 font-bold px-2 py-1 mr-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white active:bg-gray-300 shadow active:shadow-none transition-none"
                onClick={onStartClick}
                style={{ minWidth: '60px' }}
            >
                <img src="https://win98icons.alexmeub.com/icons/png/windows_slanted-1.png" alt="" className="w-4 h-4" />
                Start
            </button>

            {/* Separator */}
            <div className="w-[2px] h-6 bg-gray-500 border-r border-white mx-1"></div>

            <div className="flex-1 flex items-center gap-1 overflow-x-auto h-full py-1">
                {openWindows.map(win => {
                    const isActive = activeWindowId === win.id && !win.isMinimized;
                    return (
                        <button
                            key={win.id}
                            className={`text-left px-2 h-7 min-w-[120px] max-w-[200px] truncate flex items-center gap-2 text-xs font-sans
                                ${isActive
                                    ? 'bg-[#e0e0e0] border-2 border-gray-600 border-b-white border-r-white border-t-black border-l-black font-bold shadow-[inset_1px_1px_0px_#000]'
                                    : 'bg-[#c0c0c0] border-2 border-white border-r-black border-b-black'
                                }`}
                            onClick={() => onWindowClick(win.id)}
                        >
                            <span className="text-sm">{typeof win.icon === 'string' ? win.icon : '📄'}</span>
                            <span className="truncate">{win.title}</span>
                        </button>
                    )
                })}
            </div>

            {/* Tray Area */}
            <div className="flex items-center gap-1 pl-1 border border-gray-500 border-r-white border-b-white bg-[#c0c0c0] ml-2 font-sans text-xs shadow-[inset_1px_1px_0px_#000] h-[26px]">

                {/* Season Countdown */}
                {timeLeft && (
                    <div className={`flex items-center gap-1 px-2 border-r border-gray-400 mr-1 ${isUrgent ? 'text-red-800' : 'text-black'} font-bold`} title="Time until end of era">
                        <span>⏳ Era Ends:</span>
                        <span className="font-mono">{timeLeft}</span>
                    </div>
                )}


                {/* Stats Toggle Button */}
                <button
                    onClick={() => setShowStats(!showStats)}
                    className="w-4 h-4 flex items-center justify-center text-[10px] hover:font-bold"
                    aria-label="Toggle Stats"
                >
                    {showStats ? '▶' : '◀'}
                </button>

                {/* Optional Stats Display */}
                {showStats && stats && (
                    <div className="flex items-center gap-3 px-2 border-r border-gray-400 mr-2">
                        <div className="flex items-center gap-1" title="Gold">
                            <span>💰</span>
                            <span className="font-mono">{stats.gold?.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Vault">
                            <span>🏦</span>
                            <span className="font-mono">{stats.vault?.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Experience">
                            <span>⭐</span>
                            <span className="font-mono">{stats.experience?.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1" title="Turns">
                            <span>⏳</span>
                            <span className="font-mono">{stats.turns?.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {/* Clock */}
                <div className="px-2 w-[70px] text-center" title="Server Time">
                    {displayTime}
                </div>
            </div>
        </div>
    );
};

export default Taskbar;
