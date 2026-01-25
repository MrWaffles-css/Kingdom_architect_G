import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function HallOfFame() {
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState('overall_rank'); // overall_rank, rank_attack, rank_defense, rank_spy, rank_sentry

    useEffect(() => {
        fetchSeasons();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            fetchEntries(selectedSeason.id);
        }
    }, [selectedSeason, sortBy]);

    const fetchSeasons = async () => {
        const { data, error } = await supabase
            .from('hall_of_fame_seasons')
            .select('*')
            .order('season_number', { ascending: false });

        if (error) {
            console.error('Error fetching seasons:', error);
        } else if (data && data.length > 0) {
            setSeasons(data);
            setSelectedSeason(data[0]);
        }
    };

    const fetchEntries = async (seasonId) => {
        setLoading(true);
        // Map sort keys to database columns
        // User wants filters to see who had #1 attack, def, spy, sentry.
        // So if sortBy is 'rank_attack', we order by 'rank_attack' ascending (1 is best).

        const { data, error } = await supabase
            .from('hall_of_fame_entries')
            .select('*')
            .eq('season_id', seasonId)
            .order(sortBy, { ascending: true })
            .limit(100); // Limit to top 100 for performance? Or show all.

        if (error) {
            console.error('Error fetching hall of fame entries:', error);
        } else {
            setEntries(data || []);
        }
        setLoading(false);
    };

    const handleSort = (key) => {
        if (sortBy === key) return; // Already sorted by this
        setSortBy(key);
    };

    return (
        <div className="h-full flex flex-col bg-[#c0c0c0] font-sans">
            {/* Toolbar */}
            <div className="p-2 border-b border-gray-400 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Season:</span>
                    <select
                        className="bg-white border-2 border-gray-600 border-r-white border-b-white px-2 py-0.5 text-sm outline-none"
                        value={selectedSeason?.id || ''}
                        onChange={(e) => {
                            const season = seasons.find(s => s.id === e.target.value);
                            setSelectedSeason(season);
                        }}
                    >
                        {seasons.map(s => (
                            <option key={s.id} value={s.id}>Season {s.season_number}</option>
                        ))}
                    </select>
                </div>
                <div className="text-xs text-gray-600">
                    {entries.length} Legends Recorded
                </div>
            </div>

            {/* Filter Buttons */}
            <div className="px-2 pb-2 flex gap-1 shrink-0">
                <FilterButton label="Overall" active={sortBy === 'overall_rank'} onClick={() => handleSort('overall_rank')} icon="🏆" />
                <FilterButton label="Attack" active={sortBy === 'rank_attack'} onClick={() => handleSort('rank_attack')} icon="⚔️" />
                <FilterButton label="Defense" active={sortBy === 'rank_defense'} onClick={() => handleSort('rank_defense')} icon="🛡️" />
                <FilterButton label="Spy" active={sortBy === 'rank_spy'} onClick={() => handleSort('rank_spy')} icon="🕵️" />
                <FilterButton label="Sentry" active={sortBy === 'rank_sentry'} onClick={() => handleSort('rank_sentry')} icon="👁️" />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto border-2 border-white border-r-gray-600 border-b-gray-600 bg-white m-2 mt-0">
                {seasons.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 italic">No historical seasons archived yet.</div>
                ) : (
                    <table className="w-full text-left text-xs border-collapse relative">
                        <thead className="sticky top-0 bg-[#c0c0c0] z-10 shadow-sm text-black">
                            <tr>
                                <th className="p-2 border-r border-b border-gray-400 w-12 text-center">Rank</th>
                                <th className="p-2 border-r border-b border-gray-400">Player</th>
                                <th className="p-2 border-r border-b border-gray-400 text-right w-16">Atk Rank</th>
                                <th className="p-2 border-r border-b border-gray-400 text-right w-16">Def Rank</th>
                                <th className="p-2 border-r border-b border-gray-400 text-right w-16">Spy Rank</th>
                                <th className="p-2 border-b border-gray-400 text-right w-16">Sentry Rank</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center">Loading scrolls...</td>
                                </tr>
                            ) : (
                                entries.map((entry, idx) => (
                                    <tr key={entry.id} className={`hover:bg-blue-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-yellow-50/20'}`}>
                                        <td className="p-2 border-r border-gray-200 text-center font-bold">
                                            {getDisplayRank(entry, sortBy)}
                                        </td>
                                        <td className="p-2 border-r border-gray-200 font-bold text-blue-900">
                                            {entry.username}
                                        </td>
                                        <td className={`p-2 border-r border-gray-200 text-right font-mono ${sortBy === 'rank_attack' ? 'bg-yellow-100 font-bold' : ''}`}>
                                            #{entry.rank_attack}
                                        </td>
                                        <td className={`p-2 border-r border-gray-200 text-right font-mono ${sortBy === 'rank_defense' ? 'bg-yellow-100 font-bold' : ''}`}>
                                            #{entry.rank_defense}
                                        </td>
                                        <td className={`p-2 border-r border-gray-200 text-right font-mono ${sortBy === 'rank_spy' ? 'bg-yellow-100 font-bold' : ''}`}>
                                            #{entry.rank_spy}
                                        </td>
                                        <td className={`p-2 border-gray-200 text-right font-mono ${sortBy === 'rank_sentry' ? 'bg-yellow-100 font-bold' : ''}`}>
                                            #{entry.rank_sentry}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function FilterButton({ label, active, onClick, icon }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 text-xs border-2 flex items-center gap-1
                ${active
                    ? 'border-white border-b-[#c0c0c0] border-r-[#c0c0c0] bg-gray-200 font-bold translate-y-[1px]'
                    : 'border-white border-r-black border-b-black bg-[#c0c0c0] active:border-black active:border-r-white active:border-b-white active:translate-y-[1px]'
                }`}
        >
            <span>{icon}</span>
            {label}
        </button>
    );
}

function getDisplayRank(entry, sortBy) {
    switch (sortBy) {
        case 'rank_attack': return entry.rank_attack;
        case 'rank_defense': return entry.rank_defense;
        case 'rank_spy': return entry.rank_spy;
        case 'rank_sentry': return entry.rank_sentry;
        default: return entry.overall_rank;
    }
}
