import React from 'react';

export default function Sidebar({
    gold = 0, experience = 0, turns = 0, vault = 0, rank = 1, citizens = 0,
    attack = 0, defense = 0, spy = 0, sentry = 0, overall_rank,
    rank_attack, rank_defense, rank_spy, rank_sentry
}) {
    // Helper to format numbers with commas
    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US').format(num);
    };

    const formatValueWithRank = (val, rankVal) => {
        const formattedVal = formatNumber(val);
        if (rankVal) return `${formattedVal} (#${rankVal})`;
        return formattedVal;
    };

    const stats = [
        { label: 'Gold', value: gold, icon: '💰' },
        { label: 'Vault', value: vault, icon: '🏦' },
        { label: 'Citizens', value: citizens, icon: '👥' },
        { label: 'Experience', value: experience, icon: '✨' },
        { label: 'Turns', value: turns, icon: '⏳' },
        { label: 'Attack', value: formatValueWithRank(attack, rank_attack), icon: '⚔️' },
        { label: 'Defense', value: formatValueWithRank(defense, rank_defense), icon: '🛡️' },
        { label: 'Spy', value: formatValueWithRank(spy, rank_spy), icon: '🕵️' },
        { label: 'Sentry', value: formatValueWithRank(sentry, rank_sentry), icon: '👁️' },
        { label: 'Rank', value: `#${formatNumber(overall_rank || rank)}`, icon: '👑' },
    ];

    return (
        <aside className="w-52 flex-shrink-0 hidden md:block font-sans p-2">
            <div className="sticky top-12 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 p-2 shadow-xl">
                <div className="bg-[#000080] px-1 mb-2">
                    <h3 className="text-white font-bold text-xs uppercase text-center py-1">
                        System Monitor
                    </h3>
                </div>

                <div className="space-y-1">
                    {stats.map((stat, index) => (
                        <div key={index} className="flex flex-col bg-white border border-gray-400 p-1 mb-1">
                            <div className="text-[10px] text-gray-500 uppercase font-bold flex justify-between">
                                <span>{stat.label}</span>
                                <span>{stat.icon}</span>
                            </div>
                            <div className="text-right font-bold text-black text-sm">
                                {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
