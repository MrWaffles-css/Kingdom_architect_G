import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { BOSSES } from '../gameData/bosses';

export default function Bosses({ session }) {
    const [userStats, setUserStats] = useState(null);
    const [activeFight, setActiveFight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTarget, setSelectedTarget] = useState({}); // { bossId: 1 } (1, 10, 100, 999999)
    const [processing, setProcessing] = useState(false);
    const processingRef = useRef(false); // Ref to track processing state synchronously in closures
    const [timeLeft, setTimeLeft] = useState(0);
    const [bossKills, setBossKills] = useState({});
    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

    // Fetch Initial Data
    const fetchData = async () => {
        try {
            const { data: stats, error: statsError } = await supabase
                .from('user_stats')
                .select('*')
                .eq('id', session.user.id)
                .single();
            if (statsError) throw statsError;
            setUserStats(stats);

            const { data: fight, error: fightError } = await supabase
                .from('user_boss_fights')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle(); // Use maybeSingle to avoid 406 on empty
            if (fightError && fightError.code !== 'PGRST116') throw fightError;
            setActiveFight(fight);

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
        if (!activeFight) return;

        const boss = BOSSES.find(b => b.id === activeFight.boss_id);
        if (!boss) return;

        const timer = setInterval(async () => {
            // Calculate progress based on last_claim_time
            // Wait, last_claim_time implies the start of the CURRENT loop cycle.
            // RPC updates last_claim_time += duration when loop completes.
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
        }, 1000);

        return () => clearInterval(timer);
    }, [activeFight]);

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
            const { data, error } = await supabase.rpc('process_boss_fight');
            if (error) throw error;

            if (data.fights_processed > 0 && data.rewards) {
                setLastReward(data.rewards);
            }

            if (data.status === 'finished' || data.status === 'finished_no_turns') {
                setActiveFight(null);
                fetchData(); // Refresh stats
            } else {
                setActiveFight(prev => ({
                    ...prev,
                    last_claim_time: data.next_claim_time,
                    total_fights_done: data.fights_done
                }));
                fetchData();
            }
        } catch (err) {
            console.error('Process error:', err);
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
                fetchData();
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
                <div className="absolute top-1 right-1 text-gray-500 text-xs">v1.0</div>
                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <span>💀</span> Boss Raids
                </h2>
                <p className="mb-2">
                    Challenge powerful entities to earn Gold, Experience, and Citizens.
                    Fights run passively in the background. You can exit this page and return later.
                </p>
                <ul className="list-disc list-inside text-gray-700 bg-white/50 p-2 border border-gray-400">
                    <li><strong>Requirements:</strong> You must meet the <u>Total Stats</u> requirement.</li>
                    <li><strong>Progression:</strong> Defeat bosses in order to unlock the next level.</li>
                    <li><strong>Turns:</strong> Each fight costs turns. Turns are deducted automatically for auto-loops.</li>
                    <li><strong>Auto-Loop:</strong> Choose 10x or ∞ to repeat the fight automatically. Gold goes directly to Vault!</li>
                </ul>
                <div className="mt-2 font-bold text-blue-900">
                    Your Total Stats: {formatNumber(totalStats)}
                </div>
            </div>

            {/* Reward Notification (Bottom Right Toast) */}
            {lastReward && (
                <div className="fixed bottom-4 right-4 z-[100] pointer-events-none flex flex-col items-end space-y-1 animate-slide-up-fade">
                    {lastReward.gold > 0 && (
                        <div className="bg-black/80 text-yellow-400 px-3 py-1 rounded font-bold text-sm border border-yellow-600 shadow-lg">
                            +{formatNumber(lastReward.gold)} Gold
                        </div>
                    )}
                    {lastReward.xp > 0 && (
                        <div className="bg-black/80 text-blue-400 px-3 py-1 rounded font-bold text-sm border border-blue-600 shadow-lg">
                            +{formatNumber(lastReward.xp)} XP
                        </div>
                    )}
                    {lastReward.citizens > 0 && (
                        <div className="bg-black/80 text-green-400 px-3 py-1 rounded font-bold text-sm border border-green-600 shadow-lg">
                            +{formatNumber(lastReward.citizens)} Citizen{lastReward.citizens !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            )}

            {/* Active Fight Banner */}
            {activeFight && (
                <div className="bg-yellow-100 border-4 border-yellow-500 p-4 shadow-lg sticky top-2 z-50 animate-pulse-slow">
                    {(() => {
                        const boss = BOSSES.find(b => b.id === activeFight.boss_id);
                        if (!boss) return <div>Unknown Fight</div>;
                        const progress = activeFight.target_fights
                            ? `${activeFight.total_fights_done} / ${activeFight.target_fights}`
                            : `${activeFight.total_fights_done} / ∞`;
                        const percent = Math.min(100, Math.max(0, 100 - (timeLeft / (boss.duration_seconds * 1000) * 100)));

                        return (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl">⚔️</span>
                                    <div>
                                        <div className="font-bold text-lg">Fighting: {boss.name}</div>
                                        <div className="text-sm text-gray-700">Loop Progress: <b>{progress}</b></div>
                                    </div>
                                </div>
                                <div className="flex-1 w-full md:w-auto mx-4">
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span>Current Fight</span>
                                        <span>{formatTime(timeLeft)}</span>
                                    </div>
                                    <div className="w-full bg-gray-300 h-4 border border-gray-600 relative">
                                        <div
                                            className="h-full bg-green-600 transition-all duration-1000 ease-linear"
                                            style={{ width: `${percent}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCancelClick}
                                    className="bg-red-600 text-white px-4 py-2 border-2 border-red-800 hover:bg-red-700 font-bold text-xs"
                                >
                                    Cancel Fight
                                </button>
                            </div>
                        );
                    })()}
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
                {BOSSES.map((boss) => {
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
                                    <div className="flex gap-1 mb-2">
                                        {[1, 10, 100, 999999].map(num => (
                                            <button
                                                key={num}
                                                onClick={() => setSelectedTarget({ ...selectedTarget, [boss.id]: num })}
                                                className={`flex-1 text-[10px] sm:text-xs py-1 border border-gray-600 
                                                    ${(selectedTarget[boss.id] || 1) === num ? 'bg-blue-600 text-white' : 'bg-gray-300 hover:bg-gray-400'}
                                                `}
                                            >
                                                {num === 999999 ? '∞' : `${num}x`}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleStart(boss.id)}
                                        disabled={!meetsReq || !canAfford || (isFightingSomething && !isThisFight)}
                                        className={`
                                            w-full py-2 font-bold text-sm border-2
                                            ${isFightingSomething && isThisFight
                                                ? 'bg-blue-200 border-blue-500 text-blue-800' // Current active look
                                                : (!meetsReq || !canAfford || isFightingSomething)
                                                    ? 'bg-gray-400 border-gray-500 text-gray-200 cursor-not-allowed'
                                                    : 'bg-green-600 border-green-800 text-white hover:bg-green-500 hover:scale-[1.02] active:scale-95 transition-transform shadow-sm'
                                            }
                                        `}
                                    >
                                        {isFightingSomething ? (isThisFight ? 'Fighting...' : 'Busy') : 'Start Fight'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
