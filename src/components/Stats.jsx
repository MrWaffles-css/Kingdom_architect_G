import React from 'react';

export default function Stats({ stats }) {
    if (!stats) return <div className="p-4">Loading...</div>;

    // -- Rate Calculations --
    const kingdomLevel = stats.kingdom_level || 0;
    const citizensVal = stats.citizens || 0;
    const goldMineLevel = stats.gold_mine_level || 1;
    const miners = stats.miners || 0;
    const vaultLevel = stats.vault_level || 0;
    const libraryLevel = stats.library_level || 1;
    const researchTurns = stats.research_turns_per_min || 0;

    const attackSoldiers = stats.attack_soldiers || 0;
    const defenseSoldiers = stats.defense_soldiers || 0;
    const spies = stats.spies || 0;
    const sentries = stats.sentries || 0;
    const trainedCount = attackSoldiers + defenseSoldiers + spies + sentries;

    // Rates
    const citizensPerMin = Math.floor(kingdomLevel * 1);

    const untrainedGold = Math.floor(citizensVal * 1);
    const trainedGold = Math.floor(trainedCount * 0.5);
    const minerRate = 2 + Math.max(0, goldMineLevel - 1);
    const minerGold = miners * minerRate;
    const goldPerMin = untrainedGold + trainedGold + minerGold;

    const interestRate = Math.min(0.50, vaultLevel * 0.05);
    const vaultPerMin = Math.floor(goldPerMin * interestRate);

    const xpPerMin = libraryLevel * 1;
    const turnsPerMin = researchTurns;

    const formatRate = (rate) => `(+${rate.toLocaleString()}/m)`;

    const statItems = [
        { label: 'Gold', value: `${stats.gold?.toLocaleString()} ${formatRate(goldPerMin)}`, icon: '💰' },
        { label: 'Vault', value: `${stats.vault?.toLocaleString()} ${formatRate(vaultPerMin)}`, icon: '🏦' },
        { label: 'Citizens', value: `${stats.citizens?.toLocaleString()} ${formatRate(citizensPerMin)}`, icon: '👥' },
        { label: 'Experience', value: `${stats.experience?.toLocaleString()} ${formatRate(xpPerMin)}`, icon: '⭐' },
        { label: 'Turns', value: `${stats.turns?.toLocaleString()} ${formatRate(turnsPerMin)}`, icon: '⏳' },
        { label: 'Rank', value: `#${stats.overall_rank || stats.rank}`, icon: '🎖️' },
        { label: 'Atk', value: `${stats.attack?.toLocaleString()} (#${stats.rank_attack || '-'})`, icon: '⚔️' },
        { label: 'Def', value: `${stats.defense?.toLocaleString()} (#${stats.rank_defense || '-'})`, icon: '🛡️' },
        { label: 'Spy', value: `${stats.spy?.toLocaleString()} (#${stats.rank_spy || '-'})`, icon: '🕵️' },
        { label: 'Sentry', value: `${stats.sentry?.toLocaleString()} (#${stats.rank_sentry || '-'})`, icon: '👁️' },
    ];

    return (
        <div className="h-full bg-[#c0c0c0] flex flex-col p-1 font-sans">
            <div className="space-y-1 overflow-y-auto">
                {statItems.map((item, index) => (
                    <div
                        key={index}
                        className="flex items-center justify-between bg-white border-2 border-gray-600 border-r-white border-b-white p-1 text-xs"
                    >
                        <div className="flex items-center gap-1">
                            <span className="text-base">{item.icon}</span>
                            <span className="font-bold">{item.label}</span>
                        </div>
                        <span className="font-mono font-bold">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
