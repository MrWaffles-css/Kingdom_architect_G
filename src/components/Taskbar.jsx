import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { useGameTime } from '../contexts/TimeContext';
import { supabase } from '../supabase';
import AdModal from './AdModal';

const Taskbar = ({ openWindows, activeWindowId, onWindowClick, onStartClick, stats }) => {
    // Consume serverTime derived from TimeContext
    const { serverTime } = useGameTime() || {};
    const [showAdModal, setShowAdModal] = useState(false);
    const [adBonusEnd, setAdBonusEnd] = useState(null);
    const [adBonusActive, setAdBonusActive] = useState(false);
    const [adTimeLeft, setAdTimeLeft] = useState('');

    useEffect(() => {
        if (stats?.ad_bonus_ends_at) {
            setAdBonusEnd(new Date(stats.ad_bonus_ends_at));
        } else {
            setAdBonusActive(false);
        }
    }, [stats?.ad_bonus_ends_at]);

    useEffect(() => {
        if (!adBonusEnd) return;

        const timer = setInterval(() => {
            const now = new Date();
            const diff = adBonusEnd - now;
            if (diff > 0) {
                setAdBonusActive(true);
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setAdTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            } else {
                setAdBonusActive(false);
                setAdTimeLeft('');
                clearInterval(timer);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [adBonusEnd]);


    // Fallback to Bali time (UTC+8) if context unavailable
    const [displayTime, setDisplayTime] = useState(
        new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Singapore' // UTC+8 (same as Bali)
        })
    );
    const [showStats, setShowStats] = useState(() => {
        try {
            return localStorage.getItem('taskbarShowStats') === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        localStorage.setItem('taskbarShowStats', showStats);
    }, [showStats]);

    // Military Stats Toggle
    const [showMilitaryStats, setShowMilitaryStats] = useState(() => {
        try {
            return localStorage.getItem('taskbarShowMilitary') === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        localStorage.setItem('taskbarShowMilitary', showMilitaryStats);
    }, [showMilitaryStats]);

    useEffect(() => {
        // Use the passed serverTime from context which is synced to the server clock
        // Force Bali timezone (UTC+8) for all players
        if (serverTime) {
            setDisplayTime(new Date(serverTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Singapore' // UTC+8 (same as Bali)
            }));
        } else {
            // Fallback local clock (also in Bali timezone)
            const timer = setInterval(() => {
                setDisplayTime(new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Singapore' // UTC+8 (same as Bali)
                }));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [serverTime]);

    // Season Countdown Logic
    const { systemStatus } = useGame();
    const [timeLeft, setTimeLeft] = useState(null);
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const seasonEndTime = systemStatus?.end_time ? new Date(systemStatus.end_time) : null;

        if (!seasonEndTime) {
            setTimeLeft(null);
            return;
        }

        const updateTimer = () => {
            const now = new Date();
            const diff = seasonEndTime - now;

            setIsUrgent(diff < 24 * 60 * 60 * 1000);

            if (diff <= 0) {
                setTimeLeft('Ended'); // Show "Ended" instead of removing it immediately if desired, or null
                // User requirement: "see the end of season timer". If it ended, maybe just show 00:00:00?
                // Original logic was setTimeLeft(null). Let's stick to null if it's truly over, 
                // but usually the app redirects to "Season Ended" screen. 
                // However, if we are still on desktop, seeing 00:00:00 is better than disappearing.
                // improved:
                setTimeLeft('00:00:00');
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                const pad = (n) => n.toString().padStart(2, '0');

                let timeString = '';
                if (days > 0) {
                    timeString = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                } else {
                    timeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                }
                setTimeLeft(timeString);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [systemStatus]);


    return (
        <div className="fixed bottom-0 left-0 right-0 h-[calc(2.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-[#c0c0c0] border-t-2 border-white flex items-center px-1 z-50 select-none">
            <button
                className="flex items-center gap-1 font-bold px-2 py-1 mr-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white active:bg-gray-300 shadow active:shadow-none transition-none"
                onClick={onStartClick}
                style={{ minWidth: '60px' }}
            >
                <img src="https://win98icons.alexmeub.com/icons/png/windows_slanted-1.png" alt="" className="w-4 h-4" />
                Start
            </button>

            {/* Separator */}
            {/* Separator */}
            <div className="w-[2px] h-6 bg-gray-500 border-r border-white mx-1 hidden md:block"></div>

            <div className="hidden md:flex flex-1 items-center gap-1 overflow-x-auto h-full py-1">
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

            {/* Spacer for mobile to push tray to right */}
            <div className="flex-1 md:hidden"></div>

            {/* Tray Area */}
            <div className="flex items-center gap-1 pl-1 border border-gray-500 border-r-white border-b-white bg-[#c0c0c0] ml-2 font-sans text-xs shadow-[inset_1px_1px_0px_#000] h-[26px]">

                {/* Season Countdown */}
                {timeLeft && (
                    <div className={`flex items-center gap-1 px-2 border-r border-gray-400 mr-1 ${isUrgent ? 'text-red-800' : 'text-black'} font-bold`} title="Era Ends">
                        <span>⏳</span>
                        <span className="font-mono">{timeLeft}</span>
                    </div>
                )}

                {/* Ad Bonus Button */}
                <button
                    onClick={() => !adBonusActive && setShowAdModal(true)}
                    disabled={adBonusActive}
                    className={`flex items-center gap-1 px-2 border-r border-gray-400 mr-1 font-bold transition-colors
                        ${adBonusActive ? 'text-green-700 bg-green-100/50' : 'text-blue-800 hover:bg-blue-50 cursor-pointer'}`}
                    title={adBonusActive ? "2x Income Active" : "Watch Ad for 2x Income"}
                >
                    <span>{adBonusActive ? '⚡' : '📺'}</span>
                    <span className="font-mono text-[10px] md:text-xs">
                        {adBonusActive ? `2x: ${adTimeLeft}` : '2x Income'}
                    </span>
                </button>


                {/* Military Stats Toggle Button (Up Arrow) */}
                <button
                    onClick={() => setShowMilitaryStats(!showMilitaryStats)}
                    className="w-4 h-4 hidden md:flex items-center justify-center text-[10px] hover:font-bold ml-1"
                    aria-label="Toggle Military Stats"
                >
                    {showMilitaryStats ? '▼' : '▲'}
                </button>

                {/* Resource Stats Toggle Button */}
                <button
                    onClick={() => setShowStats(!showStats)}
                    className="w-4 h-4 hidden md:flex items-center justify-center text-[10px] hover:font-bold"
                    aria-label="Toggle Stats"
                >
                    {showStats ? '▶' : '◀'}
                </button>

                {/* Optional Resource Stats Display */}
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

            {/* Floating Military Stats Panel - Pops UP from taskbar */}
            {showMilitaryStats && stats && (
                <div className="absolute bottom-[42px] right-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black shadow-xl p-2 z-[60] min-w-[200px] animate-slide-up">
                    <div className="text-xs font-bold mb-2 pb-1 border-b border-gray-500 text-gray-700">Military Overview</div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center px-1 hover:bg-[#000080] hover:text-white group cursor-default">
                            <div className="flex items-center gap-2">
                                <span>🏆</span>
                                <span>Overall Rank</span>
                            </div>
                            <span className="font-mono font-bold">#{stats.overall_rank || stats.rank || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center px-1 hover:bg-[#000080] hover:text-white group cursor-default pt-1 border-t border-gray-400/50 mt-1">
                            <div className="flex items-center gap-2">
                                <span>⚔️</span>
                                <span>Attack</span>
                            </div>
                            <div className="flex flex-col items-end leading-none">
                                <span className="font-mono">{stats.attack?.toLocaleString()}</span>
                                <span className="text-[10px] opacity-70">#{stats.rank_attack || '-'}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-1 hover:bg-[#000080] hover:text-white group cursor-default">
                            <div className="flex items-center gap-2">
                                <span>🛡️</span>
                                <span>Defense</span>
                            </div>
                            <div className="flex flex-col items-end leading-none">
                                <span className="font-mono">{stats.defense?.toLocaleString()}</span>
                                <span className="text-[10px] opacity-70">#{stats.rank_defense || '-'}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-1 hover:bg-[#000080] hover:text-white group cursor-default">
                            <div className="flex items-center gap-2">
                                <span>🕵️</span>
                                <span>Spy</span>
                            </div>
                            <div className="flex flex-col items-end leading-none">
                                <span className="font-mono">{stats.spy?.toLocaleString()}</span>
                                <span className="text-[10px] opacity-70">#{stats.rank_spy || '-'}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-1 hover:bg-[#000080] hover:text-white group cursor-default">
                            <div className="flex items-center gap-2">
                                <span>👁️</span>
                                <span>Sentry</span>
                            </div>
                            <div className="flex flex-col items-end leading-none">
                                <span className="font-mono">{stats.sentry?.toLocaleString()}</span>
                                <span className="text-[10px] opacity-70">#{stats.rank_sentry || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAdModal && (
                <AdModal
                    onClose={() => setShowAdModal(false)}
                    onSuccess={(newStats) => {
                        // Optimistically update if available, or just rely on Realtime
                        // If onSuccess passes data back, use it
                        // The context handles realtime, but we can force a refresh if needed
                    }}
                />
            )}
        </div>
    );
};

export default Taskbar;
