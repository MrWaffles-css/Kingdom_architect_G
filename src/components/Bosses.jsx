import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

export default function Bosses({ session }) {
    const [userStats, setUserStats] = useState(null);
    const [activeFight, setActiveFight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTarget, setSelectedTarget] = useState({});
    const [processing, setProcessing] = useState(false);
    const processingRef = useRef(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [bossKills, setBossKills] = useState({});
    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
    const [showInfo, setShowInfo] = useState(() => localStorage.getItem('bosses_showInfo') !== 'false');
    const [bosses, setBosses] = useState([]);

    useEffect(() => {
        localStorage.setItem('bosses_showInfo', showInfo);
    }, [showInfo]);

    // Fetch Initial Data
    const fetchData = async (skipFightUpdate = false) => {
        try {
            const { data: stats, error: statsError } = await supabase
                .from('user_stats')
                .select('*')
                .eq('id', session.user.id)
                .single();
            if (statsError) throw statsError;
            setUserStats(stats);

            if (!skipFightUpdate) {
                const { data: fight, error: fightError } = await supabase
                    .from('user_boss_fights')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .maybeSingle(); // Use maybeSingle to avoid 406 on empty
                if (fightError && fightError.code !== 'PGRST116') throw fightError;
                setActiveFight(fight);
            }

            // Fetch Boss Kills
            const { data: kills, error: killsError } = await supabase
                .from('user_boss_kills')
                .select('boss_id, kill_count')
                .eq('user_id', session.user.id);

            if (killsError) console.error('Error fetching kills:', killsError);

            const killsMap = {};
            if (kills) {
                kills.forEach(k => {
                    killsMap[k.boss_id] = k.kill_count;
                });
            }
            setBossKills(killsMap);

            // Fetch Boss Configurations from database
            const { data: bossConfigs, error: bossError } = await supabase.rpc('get_all_bosses');
            if (bossError) {
                console.error('Error fetching boss configs:', bossError);
                // Fallback to empty array if fetch fails
                setBosses([]);
            } else {
                console.log('Loaded bosses from database:', bossConfigs);
                setBosses(bossConfigs || []);
            }

        } catch (error) {
            console.error('Error fetching boss data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll every 10s for sync
        return () => clearInterval(interval);
    }, [session]);

    // Timer Logic for Active Fight
    useEffect(() => {
        if (!activeFight) {
            setTimeLeft(0);
            return;
        }


        const boss = bosses.find(b => b.id === activeFight.boss_id);
        if (!boss) return;


        // Calculate and set initial time immediately
        const updateTimer = async () => {
            const now = new Date().getTime();
            const start = new Date(activeFight.last_claim_time).getTime();
            const end = start + (boss.duration_seconds * 1000);

            const diff = end - now;
            setTimeLeft(Math.max(0, diff));

            if (diff <= 0) {
                // Trigger processor (Check Ref to prevent parallel execution)
                if (!processingRef.current) {
                    await processFight();
                }
            }
        };

        // Run immediately on mount
        updateTimer();

        // Then run every second
        const timer = setInterval(updateTimer, 1000);

        return () => clearInterval(timer);
    }, [activeFight, bosses]);

    const [lastReward, setLastReward] = useState(null);

    // Clear reward popup after 1.5 seconds
    useEffect(() => {
        if (lastReward) {
            const timer = setTimeout(() => setLastReward(null), 1500);
            return () => clearTimeout(timer);
        }
    }, [lastReward]);

    const processFight = async () => {
        if (processingRef.current) return;

        processingRef.current = true;
        setProcessing(true);

        try {
            console.log('Processing boss fight...');
            const { data, error } = await supabase.rpc('process_boss_fight');
            if (error) throw error;

            console.log('Boss fight process result:', data);

            if (data.fights_processed > 0 && data.rewards) {
                setLastReward(data.rewards);
            }

            if (data.status === 'finished' || data.status === 'finished_no_turns') {
                console.log('Fight finished!');
                setActiveFight(null);
                fetchData(); // Refresh stats
            } else {
                console.log('Fight continuing...');
                setActiveFight(prev => ({
                    ...prev,
                    last_claim_time: data.next_claim_time,
                    total_fights_done: data.fights_done
                }));
                fetchData();
            }
        } catch (err) {
            console.error('Process error:', err);
            alert('Error processing fight: ' + err.message);
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    const handleStart = async (bossId) => {
        if (processingRef.current) return;

        processingRef.current = true;
        setProcessing(true);

        try {
            const target = selectedTarget[bossId] || 1;
            const { data, error } = await supabase.rpc('start_boss_fight', {
                p_boss_id: bossId,
                p_target_fights: target === 999999 ? null : target
            });

            if (error) throw error;
            if (!data.success) {
                alert(data.message);
            } else {
                // Use the fight data returned from the RPC to avoid timing issues
                if (data.fight) {
                    setActiveFight(data.fight);

                    // Fetch updated stats (turns, etc.) but skip overwriting fight data
                    fetchData(true);
                } else {
                    // Fallback if no fight data returned
                    fetchData();
                }
            }
        } catch (err) {
            console.error('Start error:', err);
            alert(err.message);
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    const handleCancelClick = () => {
        setShowCancelConfirmation(true);
    };

    const confirmCancel = async () => {
        // if (!window.confirm('Are you sure? Turns spent on the current incomplete fight will be lost.')) return;

        setShowCancelConfirmation(false);


        if (processingRef.current) return;
        processingRef.current = true;
        setProcessing(true);

        try {
            const { data, error } = await supabase.rpc('cancel_boss_fight');
            if (error) throw error;
            setActiveFight(null);
            fetchData();
        } catch (err) {
            console.error('Cancel error:', err);
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    const formatTime = (ms) => {
        if (ms <= 0) return 'Processing...';
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        return `${minutes}m ${seconds}s`;
    };

    const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);

    const totalStats = userStats ? (userStats.attack + userStats.defense + userStats.spy + userStats.sentry) : 0;
    const maxDefeated = userStats?.max_boss_defeated || 0;

    if (loading) return <div className="text-white text-center mt-10">Loading Bosses...</div>;

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header / Info */}
            <div className="bg-[#c0c0c0] border-2 border-white border-b-gray-600 border-r-gray-600 p-4 text-sm relative shadow-md">
                <div className="absolute top-1 right-1 flex flex-col items-end">
                    <div className="text-gray-500 text-xs">v1.0</div>
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="text-[10px] uppercase font-bold text-blue-800 hover:text-blue-600 hover:underline mt-1 bg-gray-200 px-1 border border-gray-400"
                    >
                        {showInfo ? 'Hide Info' : 'Show Info'}
                    </button>
                </div>

                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <span>💀</span> Boss Raids
                </h2>

                {showInfo && (
                    <div className="animate-fade-in">
                        <p className="mb-2">
                            Challenge powerful entities to earn Gold, Experience, and Citizens.
                            Fights run passively in the background. You can exit this page and return later.
                        </p>
                        <ul className="list-disc list-inside text-gray-700 bg-white/50 p-2 border border-gray-400">
                            <li><strong>Requirements:</strong> You must meet the <u>Total Stats</u> requirement.</li>
                            <li><strong>Progression:</strong> Defeat bosses in order to unlock the next level.</li>
                            <li><strong>Turns:</strong> Each fight costs turns. Turns are deducted automatically for auto-loops.</li>
                            <li><strong>Fight Count:</strong> Use preset buttons (1x, 10x, 100x) or enter a custom number (1-9999) to repeat fights automatically.</li>
                            <li><strong>Infinity (∞):</strong> Fight continuously until you run out of turns. Gold goes directly to Vault!</li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Total Stats Banner - Moved Out */}
            <div className="bg-[#e0e0e0] border-2 border-white border-b-gray-500 border-r-gray-500 p-2 text-center shadow-sm flex items-center justify-center gap-3">
                <span className="text-gray-700 font-bold uppercase text-xs">Your Commander Stats:</span>
                <span className="text-xl font-bold text-blue-900 border-b-2 border-blue-900 leading-none">{formatNumber(totalStats)}</span>
            </div>

            {/* Reward Notification (Windows 98 Toast Style) */}
            {lastReward && (
                <div className="fixed bottom-12 right-4 z-[99999] animate-slide-up-fade">
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 shadow-2xl" style={{ minWidth: '320px', maxWidth: '400px' }}>
                        {/* Title Bar */}
                        <div className="px-2 py-1 bg-gradient-to-r from-[#000080] to-[#1084d0] text-white font-bold flex items-center gap-2">
                            <span className="text-sm">🏆 Victory Rewards!</span>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3">
                            <div className="text-center mb-3">
                                <div className="text-4xl mb-2">⚔️</div>
                                <div className="text-sm font-bold text-gray-700">Boss Defeated!</div>
                            </div>

                            <div className="bg-white border-2 border-gray-400 border-t-gray-600 border-l-gray-600 p-3 space-y-2">
                                {lastReward.gold > 0 && (
                                    <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                                        <span className="font-bold text-sm text-gray-700">💰 Gold:</span>
                                        <span className="font-bold text-yellow-600">+{formatNumber(lastReward.gold)}</span>
                                    </div>
                                )}
                                {lastReward.xp > 0 && (
                                    <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                                        <span className="font-bold text-sm text-gray-700">⭐ Experience:</span>
                                        <span className="font-bold text-blue-600">+{formatNumber(lastReward.xp)}</span>
                                    </div>
                                )}
                                {lastReward.citizens > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-sm text-gray-700">👥 Citizens:</span>
                                        <span className="font-bold text-green-600">+{formatNumber(lastReward.citizens)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Custom Confirmation Modal */}
            {showCancelConfirmation && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 p-1 shadow-xl max-w-sm w-full animate-fade-in-up">
                        <div className="px-2 py-1 text-white font-bold flex justify-between items-center bg-[#000080]">
                            <span>Confirm Cancellation</span>
                            <button
                                onClick={() => setShowCancelConfirmation(false)}
                                className="bg-[#c0c0c0] text-black w-5 h-4 text-xs flex items-center justify-center border border-white border-r-black border-b-black font-bold hover:bg-red-500 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 text-center space-y-4">
                            <div className="flex justify-center text-4xl">⚠️</div>
                            <p className="text-sm font-bold">Are you sure you want to cancel?</p>
                            <p className="text-xs text-green-700 font-bold">Any turns spent on the current incomplete fight will be refunded.</p>

                            <div className="flex justify-center gap-4 mt-4">
                                <button
                                    onClick={confirmCancel}
                                    disabled={processing}
                                    className="px-6 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold text-black text-sm min-w-[80px] hover:bg-gray-100"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => setShowCancelConfirmation(false)}
                                    className="px-6 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold text-black text-sm min-w-[80px] hover:bg-gray-100"
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Boss List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bosses.map((boss) => {
                    const isUnlocked = boss.id === 1 || maxDefeated >= (boss.id - 1);
                    const meetsReq = totalStats >= boss.req_total_stats;
                    const canAfford = userStats?.turns >= boss.cost_turns;
                    const isFightingSomething = !!activeFight;
                    const isThisFight = activeFight?.boss_id === boss.id;

                    return (
                        <div
                            key={boss.id}
                            className={`
                                relative p-4 border-2 transition-all
                                ${isUnlocked
                                    ? 'bg-[#c0c0c0] border-white border-l-gray-600 border-t-gray-600'
                                    : 'bg-gray-200 border-gray-400 opacity-60 grayscale'}
                            `}
                        >
                            {!isUnlocked && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10 pointer-events-none">
                                    <span className="text-4xl opacity-50">🔒</span>
                                </div>
                            )}

                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg">{boss.id}. {boss.name}</h3>
                                    <div className="text-[10px] text-gray-600 font-bold uppercase">
                                        Defeated: {formatNumber(bossKills[boss.id] || 0)} times
                                    </div>
                                </div>
                                <div className="text-xs bg-gray-700 text-white px-2 py-1 rounded">
                                    {formatTime(boss.duration_seconds * 1000)}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="space-y-1 text-sm mb-3">
                                <div className={`flex justify-between ${meetsReq ? 'text-green-800 font-bold' : 'text-red-700 font-bold'}`}>
                                    <span>Req Stats:</span>
                                    <span>{formatNumber(boss.req_total_stats)}</span>
                                </div>
                                <div className={`flex justify-between ${canAfford ? 'text-blue-900' : 'text-red-600'}`}>
                                    <span>Cost per Fight:</span>
                                    <span>{boss.cost_turns} Turns</span>
                                </div>
                            </div>

                            {/* Rewards */}
                            <div className="bg-white/50 p-2 text-xs border border-gray-400 mb-3 space-y-1">
                                <div className="font-bold border-b border-gray-300 mb-1 pb-1">Rewards per Clear:</div>
                                <div className="flex justify-between"><span>💰 Gold:</span> <span>{formatNumber(boss.reward_gold)}</span></div>
                                <div className="flex justify-between"><span>⭐ XP:</span> <span>{formatNumber(boss.reward_xp)}</span></div>
                                <div className="flex justify-between"><span>👥 Citizens:</span> <span>{formatNumber(boss.reward_citizens)}</span></div>
                            </div>

                            {/* Controls */}
                            {isUnlocked && (
                                <div className="mt-auto">
                                    {isThisFight ? (
                                        <div className="space-y-2 pt-2 animate-fade-in">
                                            {/* The "Fighting Button" / Progress Bar */}
                                            <div className="relative w-full h-8 border-2 border-blue-600 bg-gray-200 overflow-hidden shadow-inner flex items-center justify-center cursor-default">
                                                {(() => {
                                                    const percent = Math.min(100, Math.max(0, 100 - (timeLeft / (boss.duration_seconds * 1000) * 100)));
                                                    return (
                                                        <>
                                                            <div
                                                                className="absolute left-0 top-0 h-full bg-blue-300 transition-all duration-1000 ease-linear"
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                            <span className="relative z-10 font-bold text-blue-900 text-xs drop-shadow-sm flex items-center gap-2">
                                                                <span>⚔️ Fighting...</span>
                                                                <span>{formatTime(timeLeft)}</span>
                                                            </span>
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            {/* Loop Stats */}
                                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 px-1">
                                                <span>Loop: {activeFight.total_fights_done} / {activeFight.target_fights || '∞'}</span>
                                            </div>

                                            {/* Cancel Button */}
                                            <button
                                                onClick={handleCancelClick}
                                                className="w-full py-1 text-[10px] uppercase tracking-wider bg-red-100 border border-red-400 text-red-700 font-bold hover:bg-red-200 hover:text-red-900 transition-colors"
                                            >
                                                Cancel Fight
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Custom Input Only */}
                                            <div className="mb-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="9999"
                                                    value={(selectedTarget[boss.id] === 999999 || !selectedTarget[boss.id]) ? '' : selectedTarget[boss.id]}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 1;
                                                        const clamped = Math.min(9999, Math.max(1, val));
                                                        setSelectedTarget({ ...selectedTarget, [boss.id]: clamped });
                                                    }}
                                                    placeholder="Count (1-9999)"
                                                    className="w-full px-2 py-1 text-sm border-2 border-gray-600 bg-white focus:border-blue-500 focus:outline-none text-center font-bold text-gray-700"
                                                />
                                            </div>

                                            <button
                                                onClick={() => handleStart(boss.id)}
                                                disabled={!meetsReq || !canAfford || (isFightingSomething && !isThisFight)}
                                                className={`
                                                    w-full py-2 font-bold text-sm border-2
                                                    ${isFightingSomething && isThisFight
                                                        ? 'bg-blue-200 border-blue-500 text-blue-800' // Should not be reached due to ternary above, but good fallback
                                                        : (!meetsReq || !canAfford || isFightingSomething)
                                                            ? 'bg-gray-400 border-gray-500 text-gray-200 cursor-not-allowed'
                                                            : 'bg-green-600 border-green-800 text-white hover:bg-green-500 hover:scale-[1.02] active:scale-95 transition-transform shadow-sm'
                                                    }
                                                `}
                                            >
                                                {isFightingSomething ? 'Busy' : 'Start Fight'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
