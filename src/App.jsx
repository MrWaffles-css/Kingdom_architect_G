import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useGame } from './contexts/GameContext'
import WelcomePage from './components/WelcomePage'
import Desktop from './components/Desktop'

export default function App() {
    const {
        session,
        stats,
        loading,
        error,
        isAdmin,
        serverTime,
        refreshUserData,
        setStats,
        fixSession,
        isMaintenanceMode
    } = useGame()

    const [showAdmin, setShowAdmin] = useState(false)
    const [viewingUserId, setViewingUserId] = useState(null)

    // Setup Wizard State (Lifted to top level to avoid conditional hook error)
    const [progress, setProgress] = useState(0);
    const [statusIndex, setStatusIndex] = useState(0);
    const [nextSeasonStart, setNextSeasonStart] = useState(null);
    const [timeLeftToStart, setTimeLeftToStart] = useState('');

    // Animation Logic
    useEffect(() => {
        // We can run this effect regardless, or just return early inside if inactive
        // IMPORTANT: If hooks are called conditionally, React breaks. 
        // This effect is now top-level safe.
        // Run this effect if we are in maintenance mode and not an admin
        // We still run hooks unconditionally, but the logic inside depends on state
        // Checking 'session' in the condition might be redundant if the parent component already handles it, 
        // but let's stick to the render condition: isMaintenanceMode && !isAdmin
        if (isMaintenanceMode && !isAdmin) {
            const statuses = [
                "Initializing terrain generation...",
                "Compiling user statistics...",
                "Archiving previous era data...",
                "Reticulating splines...",
                "Polishing gold coins...",
                "Constructing new castles...",
                "Summoning Clippy...",
                "Allocating server resources..."
            ];

            // Fetch Next Season Start and update constantly
            const fetchNextSeasonStart = async () => {
                const { data } = await supabase
                    .from('game_settings')
                    .select('value')
                    .eq('key', 'next_season_start')
                    .single();
                if (data?.value?.start_time) {
                    setNextSeasonStart(new Date(data.value.start_time));
                }
            };
            fetchNextSeasonStart();

            // Refetch occasionally in case admin changes it
            const scheduleRefetch = setInterval(fetchNextSeasonStart, 30000);

            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    const next = prev + Math.random() * 5;
                    return next > 100 ? 0 : next;
                });
            }, 500);

            const statusInterval = setInterval(() => {
                setStatusIndex(prev => (prev + 1) % statuses.length);
            }, 2000);

            // Countdown Timer
            const timerInterval = setInterval(() => {
                if (nextSeasonStart) {
                    const now = new Date();
                    const diff = nextSeasonStart - now;
                    if (diff <= 0) {
                        setTimeLeftToStart('Starting now...');
                    } else {
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                        const pad = n => n.toString().padStart(2, '0');

                        let str = '';
                        if (days > 0) str += `${days}d `;
                        str += `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                        setTimeLeftToStart(str);
                    }
                }
            }, 1000);

            return () => {
                clearInterval(progressInterval);
                clearInterval(statusInterval);
                clearInterval(timerInterval);
                clearInterval(scheduleRefetch);
            };
        }
    }, [loading, error, session, isAdmin, isMaintenanceMode]);




    const handleKingdomAction = async () => {
        try {
            const { data, error } = await supabase.rpc('upgrade_kingdom');
            if (error) throw error;
            if (data) {
                setStats(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error('Error upgrading kingdom:', error);
            alert('Failed to upgrade kingdom: ' + error.message);
        }
    };

    const handleBuildKingdom = handleKingdomAction;
    const handleUpgradeKingdom = handleKingdomAction;

    const handleViewProfile = (userId) => {
        setViewingUserId(userId);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setShowAdmin(false)
        setViewingUserId(null)
    }

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-[#008080] flex items-center justify-center p-4">
                <div className="window w-full max-w-[300px]">
                    <div className="title-bar">
                        <div className="title-bar-text">Loading...</div>
                        <div className="title-bar-controls"></div>
                    </div>
                    <div className="window-body text-center p-4">
                        <p>Loading Kingdom Architect...</p>
                        <div className="h-4 w-full bg-white border border-gray-600 mt-2 relative">
                            <div className="absolute top-0 left-0 h-full bg-[#000080] animate-[shimmer_2s_infinite]"></div>
                            {/* Simple loading bars */}
                            <div className="h-full bg-blue-800 w-1/2 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Auth State
    if (!session) {
        return <WelcomePage onLogin={() => { }} />;
    }

    // Maintenance Mode Check (Between Seasons)
    // const { isMaintenanceMode } = useGame(); // Removed duplicate call



    if (isMaintenanceMode && !isAdmin) {
        return (
            <div className="min-h-screen bg-[#008080] flex items-center justify-center font-sans p-2">

                {/* Wizard Window */}
                <div className="w-full h-full md:h-auto md:max-w-[500px] bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 shadow-xl flex flex-col p-[2px]">

                    {/* Title Bar */}
                    <div className="bg-[#000080] h-5 flex items-center justify-between px-1 mb-1">
                        <div className="text-white font-bold text-xs flex items-center gap-1">
                            <span className="text-xs">💿</span> Kingdom Architect Setup
                        </div>
                        <button className="w-4 h-3 bg-[#c0c0c0] border border-white border-r-black border-b-black text-[8px] flex items-center justify-center font-bold active:translate-y-[1px]">✕</button>
                    </div>

                    {/* Window Content */}
                    <div className="flex-1 flex gap-0 h-[320px]">

                        {/* Left Banner */}
                        <div className="w-[140px] bg-[#000080] p-4 flex flex-col justify-between text-yellow-300 relative overflow-hidden">
                            <div className="font-bold text-xl italic z-10 font-serif leading-tight">
                                New Era<br />Setup
                            </div>
                            <div className="absolute top-10 left-[-10px] text-[100px] opacity-20 rotate-12 select-none">🏗️</div>
                            <div className="absolute bottom-10 right-[-10px] text-[80px] opacity-20 -rotate-12 select-none">⚔️</div>
                            <div className="z-10 text-[10px] text-white opacity-70">
                                v2.0.25 (Build 98)
                            </div>
                        </div>

                        {/* Right Content Area */}
                        <div className="flex-1 p-6 flex flex-col text-sm relative">
                            <h2 className="font-bold text-lg mb-4">The previous Era has concluded</h2>

                            <p className="mb-4">
                                The Kingdom Architect server is currently transitioning to the next Season.
                                A new Era is being generated and prepared for your arrival.
                            </p>

                            <p className="mb-2">Setup will continue automatically. Please check back shortly.</p>

                            {nextSeasonStart && (
                                <div className="mb-4 bg-blue-100 border border-blue-400 p-2 text-center shadow-inner">
                                    <div className="font-bold text-blue-900 text-xs uppercase mb-1">New Era Starts In</div>
                                    <div className="font-mono text-xl font-bold text-blue-800">{timeLeftToStart || '--:--:--'}</div>
                                </div>
                            )}

                            {/* Status Box */}
                            <div className="mt-auto mb-4">
                                <div className="text-xs mb-1 font-bold">Current Action:</div>
                                <div className="border inset-border p-1 h-6 flex items-center bg-white whitespace-nowrap overflow-hidden text-xs font-mono">
                                    {["Initializing terrain generation...", "Compiling user statistics...", "Archiving previous era data...", "Reticulating splines...", "Polishing gold coins...", "Constructing new castles...", "Summoning Clippy...", "Allocating server resources..."][statusIndex]}
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="border border-gray-600 border-r-white border-b-white p-[1px] h-6 bg-gray-200 relative mb-6">
                                <div
                                    className="h-full bg-[#000080] relative overflow-hidden transition-all duration-500 ease-out"
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                >
                                    {/* Shine effect */}
                                    <div className="absolute top-0 left-0 right-0 h-[50%] bg-white opacity-20"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Buttons */}
                    <div className="border-t border-gray-400 p-3 flex justify-end gap-2 bg-[#c0c0c0]">
                        <button
                            className="px-6 py-1 border-2 border-white border-r-black border-b-black opacity-50 cursor-not-allowed text-xs"
                            disabled
                        >
                            {'< Back'}
                        </button>
                        <button
                            className="px-6 py-1 border-2 border-white border-r-black border-b-black opacity-50 cursor-not-allowed text-xs"
                            disabled
                        >
                            {'Next >'}
                        </button>
                        <button
                            onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                            className="px-6 py-1 border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white active:translate-y-[1px] ml-4 text-xs"
                        >
                            Cancel
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="min-h-screen bg-[#008080] flex items-center justify-center p-4">
                <div className="window w-full max-w-[350px]">
                    <div className="title-bar">
                        <div className="title-bar-text">Error</div>
                        <div className="title-bar-controls">
                            <button aria-label="Close"></button>
                        </div>
                    </div>
                    <div className="window-body">
                        <div className="flex gap-4 items-center">
                            <div className="text-4xl">❌</div>
                            <p>{error}</p>
                        </div>
                        <div className="flex justify-center gap-2 mt-4">
                            <button onClick={() => refreshUserData(session?.user?.id)}>Retry</button>
                            <button onClick={fixSession}>Fix Session</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }



    // Main App UI (Desktop)
    return (
        <Desktop
            stats={stats}
            session={session}
            handleBuildKingdom={handleBuildKingdom}
            handleUpgradeKingdom={handleUpgradeKingdom}
            handleNavigate={() => { }} // Legacy, mostly unused now
            handleLogout={handleLogout}
            handleViewProfile={handleViewProfile}
            setStats={setStats}
            refreshUserData={refreshUserData}
            viewingUserId={viewingUserId}
            setViewingUserId={setViewingUserId}
            showAdmin={showAdmin}
            setShowAdmin={setShowAdmin}
            isAdmin={isAdmin}
        />
    )
}
