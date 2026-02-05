import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Reports({ session }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'defense', 'offense'
    const [stats, setStats] = useState({
        seasonStolen: 0,
        seasonLost: 0,
        dayStolen: 0,
        dayLost: 0
    });

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setReports(data || []);
            calculateStats(data || []);

            // Mark all as read when opening (optional, maybe distinct action?)
            // For now, we just fetch. Mark read could be on "view" or just opening the tab.
            // Let's mark all displayed reports as read to clear notifications.
            if (data?.length > 0) {
                const unreadIds = data.filter(r => !r.is_read).map(r => r.id);
                if (unreadIds.length > 0) {
                    await supabase
                        .from('reports')
                        .update({ is_read: true })
                        .in('id', unreadIds);

                    // Trigger a global update if possible? 
                    // The Desktop polling will pick it up on next cycle.
                }
            }

        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data) => {
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

        let sStolen = 0;
        let sLost = 0;
        let dStolen = 0;
        let dLost = 0;

        data.forEach(r => {
            const date = new Date(r.created_at);
            const isToday = date > oneDayAgo;

            // Income: Gold Stolen BY You
            if (r.type === 'attack_win' && r.data?.gold_stolen) {
                const amount = r.data.gold_stolen || 0;
                sStolen += amount;
                if (isToday) dStolen += amount;
            }

            // Losses: Gold Stolen FROM You
            if ((r.type === 'defend_loss' || r.type === 'defend_win') && r.data?.gold_lost) { // defend_win can technically lose gold if steal logic changes, but mostly defend_loss
                // Actually logic says you lose gold if defend_loss. Just robust check.
                const amount = r.data.gold_lost || 0;
                sLost += amount;
                if (isToday) dLost += amount;
            }
        });

        setStats({
            seasonStolen: sStolen,
            seasonLost: sLost,
            dayStolen: dStolen,
            dayLost: dLost
        });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffHours = Math.floor((now - date) / (1000 * 60 * 60));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num || 0);

    const filteredReports = reports.filter(r => {
        if (filter === 'defense') return r.type.includes('defend');
        if (filter === 'offense') return r.type.includes('attack');
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-[#c0c0c0] text-black font-sans text-sm select-none border-t border-l border-white border-r border-b border-gray-600">
            {/* Header / Summary Stats */}
            <div className="p-2 border-b-2 border-gray-500 mb-1 flex justify-between items-end">
                <div className="flex gap-2">
                    {/* Income Group */}
                    <div className="flex flex-col gap-1 mr-2">
                        <div className="border border-white border-r-gray-600 border-b-gray-600 shadow-[inset_1px_1px_0px_0px_#808080,inset_-1px_-1px_0px_0px_#dfdfdf] px-2 py-1 bg-[#c0c0c0] w-[140px]">
                            <div className="text-[9px] uppercase text-gray-600 font-bold mb-0.5">Income (Season)</div>
                            <div className="text-emerald-700 font-bold text-sm">
                                +{formatNumber(stats.seasonStolen)}
                            </div>
                        </div>
                        <div className="border border-white border-r-gray-600 border-b-gray-600 shadow-[inset_1px_1px_0px_0px_#808080,inset_-1px_-1px_0px_0px_#dfdfdf] px-2 py-1 bg-[#c0c0c0] w-[140px]">
                            <div className="text-[9px] uppercase text-gray-600 font-bold mb-0.5">Income (24h)</div>
                            <div className="text-emerald-600 font-bold text-sm">
                                +{formatNumber(stats.dayStolen)}
                            </div>
                        </div>
                    </div>

                    {/* Losses Group */}
                    <div className="flex flex-col gap-1">
                        <div className="border border-white border-r-gray-600 border-b-gray-600 shadow-[inset_1px_1px_0px_0px_#808080,inset_-1px_-1px_0px_0px_#dfdfdf] px-2 py-1 bg-[#c0c0c0] w-[140px]">
                            <div className="text-[9px] uppercase text-gray-600 font-bold mb-0.5">Losses (Season)</div>
                            <div className="text-red-700 font-bold text-sm">
                                -{formatNumber(stats.seasonLost)}
                            </div>
                        </div>
                        <div className="border border-white border-r-gray-600 border-b-gray-600 shadow-[inset_1px_1px_0px_0px_#808080,inset_-1px_-1px_0px_0px_#dfdfdf] px-2 py-1 bg-[#c0c0c0] w-[140px]">
                            <div className="text-[9px] uppercase text-gray-600 font-bold mb-0.5">Losses (24h)</div>
                            <div className="text-red-600 font-bold text-sm">
                                -{formatNumber(stats.dayLost)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs - Windows 98 Style Buttons */}
                <div className="flex gap-1 relative top-[2px]">
                    {['all', 'defense', 'offense'].map(f => {
                        const isActive = filter === f;
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`
                                    px-3 py-1 text-xs uppercase font-bold transition-none focus:outline-none
                                    border-t-2 border-l-2 border-r-2 border-b-0 rounded-t-sm
                                    ${isActive
                                        ? 'bg-[#c0c0c0] border-white border-r-gray-800 z-10 pb-2 -mb-1 relative top-[1px]'
                                        : 'bg-[#b0b0b0] border-gray-300 border-r-gray-600 text-gray-600 hover:bg-[#c0c0c0] mt-1'
                                    }
                                `}
                            >
                                {f === 'all' ? 'All Logs' : f === 'defense' ? 'Defense' : 'Offense'}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table Container - Inset Look */}
            <div className="flex-1 flex flex-col m-2 border-2 border-gray-600 border-r-white border-b-white bg-white shadow-[inset_2px_2px_0px_0px_#000000]">
                {/* Table Header */}
                <div className="grid grid-cols-10 gap-0 bg-[#c0c0c0] text-black text-center py-1 border-b border-gray-800 text-[11px] font-bold">
                    <div className="col-span-1 border-r border-gray-400 pl-1">Time</div>
                    <div className="col-span-1 border-r border-gray-400">Action</div>
                    <div className="col-span-1 border-r border-gray-400">Enemy</div>
                    <div className="col-span-2 border-r border-gray-400">Result</div>
                    <div className="col-span-1 border-r border-gray-400">Enemy Lost</div>
                    <div className="col-span-1 border-r border-gray-400">You Lost</div>
                    <div className="col-span-1 border-r border-gray-400">Hostages</div>
                    <div className="col-span-2">Damage (Them/You)</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto font-sans text-xs bg-white">
                    {loading ? (
                        <div className="text-center p-10 text-gray-500">Retrieving intelligence...</div>
                    ) : filteredReports.length === 0 ? (
                        <div className="text-center p-10 text-gray-500 italic">No reports found.</div>
                    ) : (
                        filteredReports.map((report, idx) => {
                            const isDefense = report.type.includes('defend');
                            const isWin = report.type.includes('win');
                            const d = report.data || {};

                            // Parse Data based on perspective
                            const enemyName = d.opponent_name || 'Unknown';
                            const actionText = isDefense ? 'Defended' : 'Attacked';

                            // Result Text
                            let resultText = '';
                            let resultColor = 'text-gray-600';

                            if (d.gold_stolen > 0) {
                                const percentText = d.steal_percent ? ` (${Math.round(d.steal_percent)}%)` : '';
                                resultText = `+${formatNumber(d.gold_stolen)} Gold${percentText}`;
                                resultColor = 'text-green-700 font-bold';
                            } else if (d.gold_lost > 0) {
                                resultText = `-${formatNumber(d.gold_lost)} Gold`;
                                resultColor = 'text-red-700 font-bold';
                            } else {
                                // No gold changed hands?
                                resultText = isWin ? 'Victory' : 'Defeat';
                                if (isDefense && isWin) resultText = 'Repelled';
                                if (!isDefense && !isWin) resultText = 'Failed';
                            }

                            // Losses
                            const enemyLosses = isDefense ? (d.attacker_casualties || 0) : (d.enemy_killed || 0);
                            const yourLosses = d.soldiers_lost || 0;

                            // Hostages (Citizens)
                            const hostagesVal = isDefense ? (d.citizens_lost || 0) : (d.citizens_stolen || 0);
                            const hostagesColor = isDefense ? 'text-red-700 font-bold' : 'text-green-700 font-bold';

                            // Damage - The SQL logic was a bit weird but frontend maps:
                            // d.damage_taken -> Damage taken by the report owner (You)
                            // d.damage_dealt -> Damage dealt by the report owner (You) to Enemy
                            // BUT... looking at my previous file comments, I suspected a swap.
                            // Let's stick to the JSON keys if the SQL was patched to be logical.
                            // Assuming: damage_dealt = You Hit, damage_taken = You Got Hit.

                            return (
                                <div
                                    key={report.id}
                                    className={`
                                        grid grid-cols-10 gap-0 py-1 border-b border-gray-200 items-center text-center cursor-default
                                        ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                        hover:bg-[#000080] hover:text-white group
                                    `}
                                >
                                    <div className="col-span-1 text-gray-500 text-[10px] group-hover:text-white group-hover:opacity-80">
                                        {formatDate(report.created_at)}
                                    </div>

                                    <div className={`col-span-1 font-bold ${isDefense ? 'text-red-600 group-hover:text-[#ff8080]' : 'text-blue-700 group-hover:text-[#8080ff]'}`}>
                                        {actionText}
                                    </div>

                                    <div className="col-span-1 font-bold text-black truncate px-1 group-hover:text-white" title={enemyName}>
                                        {enemyName}
                                    </div>

                                    <div className={`col-span-2 ${resultColor} group-hover:text-white`}>
                                        {resultText}
                                    </div>

                                    <div className="col-span-1 text-gray-800 group-hover:text-white">
                                        {formatNumber(enemyLosses)}
                                    </div>

                                    <div className="col-span-1 text-red-600 font-bold group-hover:text-[#ff8080]">
                                        {formatNumber(yourLosses)}
                                    </div>

                                    <div className={`col-span-1 ${hostagesVal > 0 ? hostagesColor : 'text-gray-400 group-hover:text-gray-300'} group-hover:text-white`}>
                                        {hostagesVal > 0 ? (isDefense ? `-${hostagesVal}` : `+${hostagesVal}`) : '-'}
                                    </div>

                                    <div className="col-span-2 text-[10px]">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-red-600 font-bold group-hover:text-[#ff8080] min-w-[30px] text-right" title="Damage Taken">{formatNumber(d.damage_taken || 0)}</span>
                                            <span className="text-gray-400 group-hover:text-white">/</span>
                                            <span className="text-blue-700 font-bold group-hover:text-[#8080ff] min-w-[30px] text-left" title="Damage Dealt">{formatNumber(d.damage_dealt || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
