import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Battle({ userStats, onNavigate, onAction, onViewProfile }) {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [errorMsg, setErrorMsg] = useState(null);
    const [attackResult, setAttackResult] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);



    useEffect(() => {
        fetchPlayers();
    }, []);

    // Auto-refresh every minute (60s) to match turn generation
    useEffect(() => {
        const interval = setInterval(() => {
            fetchPlayers();
        }, 60000); // 60 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchPlayers = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            // Get all players via RPC (handles passive spy gold reveal)
            const { data, error } = await supabase
                .rpc('get_battle_opponents', {
                    p_page: 0,
                    p_limit: 1000 // Get all players (adjust if you have more than 1000)
                });

            if (error) throw error;

            if (error) throw error;
            // Filter out Clippy from display and count
            const filteredData = (data || []).filter(p => p.username !== 'Clippy');
            setPlayers(filteredData);
            setTotalPlayers(filteredData.length);
        } catch (error) {
            console.error('Error fetching players:', error);
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US').format(num);
    };

    const timeAgo = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const handleAttack = async (targetId, targetName) => {
        if (userStats.turns < 100) {
            alert("You need 100 turns to attack!");
            return;
        }

        setActionLoading(targetId);
        try {
            const { data, error } = await supabase.rpc('attack_player', { target_id: targetId });
            if (error) throw error;

            setAttackResult({
                success: data.success,
                message: data.message,
                gold_stolen: data.gold_stolen,
                casualties: data.casualties,
                opponent: targetName,
                report_id: data.report_id
            });

            if (data.success) {
                fetchPlayers(); // Refresh to see updated gold (0)
            }
            // Refresh global stats (turns, gold, soldiers)
            if (onAction) onAction();

            // Redirect immediately to report page as requested
            if (onNavigate && data.report_id) {
                onNavigate('Reports', { initialReportId: data.report_id });
                setAttackResult(null); // Do not show the small modal if we are going full page
            } else {
                // Fallback if no navigation available or no ID
                // Keep modal open
            }
        } catch (err) {
            console.error('Attack error:', err);
            alert('Attack failed: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSpy = async (targetId, targetName) => {
        setActionLoading(targetId);
        try {
            const { data, error } = await supabase.rpc('spy_player', { target_id: targetId });
            if (error) throw error;

            if (data.success) {
                // Refresh global stats (turns if spy cost turns, though currently 0)
                if (onAction) onAction();

                // Refresh battlefield list to show new intel (Defense/Sentry)
                fetchPlayers();

                // Open new Spy Report Window
                if (onNavigate) {
                    onNavigate('SpyReport', { spyReport: { name: targetName, ...data.data } });
                }
            } else {
                alert(`SPY FAILED! \n\n${data.message}`);
            }
        } catch (err) {
            console.error('Spy error:', err);
            alert('Spy failed: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (!userStats) return <div className="p-4 text-center">Loading commander profile...</div>;

    return (
        <div className="space-y-4 font-sans text-black animate-fade-in relative">
            {/* Attack Result Modal Window */}
            {attackResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 p-1 shadow-xl max-w-md w-full">
                        <div className={`px-2 py-1 text-white font-bold flex justify-between items-center ${attackResult.success ? 'bg-[#000080]' : 'bg-red-800'}`}>
                            <span>{attackResult.success ? 'VICTORY' : 'DEFEAT'}</span>
                            <button onClick={() => {
                                if (attackResult.opponent === 'Clippy') window.location.reload();
                                else setAttackResult(null);
                            }} className="bg-[#c0c0c0] text-black w-5 h-4 text-xs flex items-center justify-center border border-white border-r-black border-b-black font-bold">✕</button>
                        </div>
                        <div className="p-4 space-y-4 text-center">
                            <p className="text-sm">{attackResult.message}</p>

                            <div className="grid grid-cols-2 gap-4 text-left">
                                {attackResult.success ? (
                                    <>
                                        <fieldset className="border border-white border-l-gray-600 border-t-gray-600 p-2 bg-white">
                                            <legend className="text-[10px] uppercase font-bold px-1">Gold Seized</legend>
                                            <div className="font-bold">{formatNumber(attackResult.gold_stolen)}</div>
                                        </fieldset>
                                        <fieldset className="border border-white border-l-gray-600 border-t-gray-600 p-2 bg-white">
                                            <legend className="text-[10px] uppercase font-bold px-1">Enemy Killed</legend>
                                            <div className="font-bold text-red-600">{formatNumber(attackResult.casualties)}</div>
                                        </fieldset>
                                    </>
                                ) : (
                                    <fieldset className="col-span-2 border border-white border-l-gray-600 border-t-gray-600 p-2 bg-white">
                                        <legend className="text-[10px] uppercase font-bold px-1">Soldiers Lost</legend>
                                        <div className="font-bold text-red-600">{formatNumber(attackResult.casualties)}</div>
                                    </fieldset>
                                )}
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => {
                                        if (attackResult.opponent === 'Clippy') {
                                            window.location.reload();
                                        } else {
                                            setAttackResult(null);
                                        }
                                    }}
                                    className="flex-1 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold text-black text-sm"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setAttackResult(null);
                                        onNavigate('Reports');
                                    }}
                                    className="flex-1 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold text-black text-sm"
                                >
                                    View Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Header Banner */}
            {/* Header Banner */}
            <div className="mb-4 border-2 border-white border-b-gray-500 border-r-gray-500 shadow-inner relative">
                <img
                    src="/battle_banner.png"
                    alt="Battlefield Banner"
                    className="w-full h-56 object-cover object-center pixelated"
                />
                <button
                    onClick={fetchPlayers}
                    disabled={loading}
                    className="absolute bottom-2 right-2 px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-black font-bold text-[0.75em]"
                >
                    {loading ? '...' : 'Refresh'}
                </button>
            </div>



            {/* Error Message */}
            {errorMsg && (
                <div className="bg-white border text-red-600 px-4 py-2 border-red-500 mb-4" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{errorMsg}</span>
                    <p className="text-xs mt-1">Try running the <code>fix_relationships.sql</code> script.</p>
                </div>
            )}

            {/* Battle List Table */}
            <div className="border border-gray-400 bg-white">


                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-xs text-gray-600 uppercase border-b border-gray-300">
                                <th className="p-2 text-right border-r border-gray-300">Rank</th>
                                <th className="p-2 border-r border-gray-300">Alliance</th>
                                <th className="p-2 border-r border-gray-300">Name</th>
                                <th className="p-2 text-right border-r border-gray-300">Treasury</th>
                                <th className="p-2 text-center border-r border-gray-300">Actions</th>
                                <th className="p-2 text-right border-r border-gray-300">Defense</th>
                                <th className="p-2 text-right border-r border-gray-300">Sentry</th>
                                <th className="p-2 text-right border-r border-gray-300">Last Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-gray-500 italic">
                                        Querying realm database...
                                    </td>
                                </tr>
                            ) : players.map((player) => {
                                const isCurrentUser = player.id === userStats.id;
                                return (
                                    <tr
                                        key={player.id}
                                        className={`text-[0.8em] ${isCurrentUser ? 'bg-blue-50' : 'hover:bg-blue-600 hover:text-white group'}`}
                                    >
                                        <td className="p-2 text-right border-r border-gray-200 border-b font-mono">
                                            #{formatNumber(player.overall_rank)}
                                        </td>
                                        <td className="p-2 border-r border-gray-200 border-b font-mono text-[0.9em]">
                                            {player.alliance || '-'}
                                        </td>
                                        <td className="p-2 border-r border-gray-200 border-b">
                                            <div className="flex items-center gap-2">
                                                {!isCurrentUser ? (
                                                    <button
                                                        onClick={() => {
                                                            console.log('Clicking profile for:', player.id, 'Handler present:', !!onViewProfile);
                                                            if (onViewProfile) onViewProfile(player.id);
                                                            else console.error('onViewProfile prop is missing!');
                                                        }}
                                                        className="hover:underline text-left group-hover:text-white"
                                                    >
                                                        {player.username || 'Unknown Lord'}
                                                    </button>
                                                ) : (
                                                    <span>{player.username || 'Unknown Lord'}</span>
                                                )}

                                            </div>
                                        </td>
                                        <td className="p-2 text-right border-r border-gray-200 border-b font-mono">
                                            {player.gold !== null && player.gold !== undefined ? (
                                                <span>{formatNumber(player.gold)} G</span>
                                            ) : (
                                                <span className="opacity-40">???</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-center border-b border-gray-200 border-r">
                                            {!isCurrentUser && (
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handleAttack(player.id, player.username)}
                                                        disabled={actionLoading === player.id}
                                                        className="px-1 py-0 bg-[#c0c0c0] border border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-black text-[0.85em] font-bold group-hover:text-black min-w-[50px]"
                                                        title="Attack (100 Turns)"
                                                    >
                                                        Attack
                                                    </button>
                                                    <button
                                                        onClick={() => handleSpy(player.id, player.username)}
                                                        disabled={actionLoading === player.id}
                                                        className="px-1 py-0 bg-[#c0c0c0] border border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-black text-[0.85em] font-bold group-hover:text-black min-w-[40px]"
                                                        title="Spy (Free)"
                                                    >
                                                        Spy
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2 text-right border-r border-gray-200 border-b font-mono">
                                            {player.defense !== null && player.defense !== undefined ? (
                                                <span>{formatNumber(player.defense)}</span>
                                            ) : (
                                                <span className="opacity-40">???</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-right border-r border-gray-200 border-b font-mono">
                                            {player.sentry !== null && player.sentry !== undefined ? (
                                                <span>{formatNumber(player.sentry)}</span>
                                            ) : (
                                                <span className="opacity-40">???</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-right border-r border-gray-200 border-b text-[0.7em]">
                                            {player.last_spied_at ? (
                                                <span className="text-gray-600 font-medium">
                                                    {timeAgo(player.last_spied_at)}
                                                </span>
                                            ) : (
                                                <span className="opacity-40">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
