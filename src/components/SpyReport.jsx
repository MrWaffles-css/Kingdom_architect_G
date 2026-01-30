import React, { useState } from 'react';
import { supabase } from '../supabase';

const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
};


const WEAPON_NAMES = {
    attack: ['Rusty Dagger', 'Iron Sword', 'Steel Mace', 'Knight\'s Lance', 'Royal Claymore', 'Void Blade'],
    defense: ['Tattered Tunic', 'Leather Jerkin', 'Chainmail Hauberk', 'Steel Plate', 'Enchanted Shield', 'Divine Barrier'],
    spy: ['Hooded Cloak', 'Lockpicks', 'Smoke Bomb', 'Poison Vial', 'Assassin\'s Blade', 'Shadow Essence'],
    sentry: ['Wooden Torch', 'Signal Horn', 'Watchtower Lens', 'Guard Dog', 'Mystic Ward', 'All-Seeing Eye']
};

export default function SpyReport({ spyReport, userStats = {}, onClose, session }) {
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareType, setShareType] = useState('alliance');
    const [allianceMembers, setAllianceMembers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [sharing, setSharing] = useState(false);



    // Fetch alliance members when share modal opens
    const handleOpenShareModal = async () => {
        setShowShareModal(true);
        if (userStats.alliance_id) {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('alliance_id', userStats.alliance_id)
                    .neq('id', session?.user?.id);

                if (!error && data) {
                    setAllianceMembers(data);
                }
            } catch (err) {
                console.error('Error fetching alliance members:', err);
            }
        }
    };

    const handleShare = async () => {
        if (shareType === 'individual' && !selectedUser) {
            alert('Please select a recipient');
            return;
        }

        setSharing(true);
        try {
            const { data, error } = await supabase.rpc('share_spy_report', {
                p_report_data: spyReport,
                p_share_type: shareType,
                p_shared_with_user_id: shareType === 'individual' ? selectedUser : null,
                p_target_username: spyReport.name
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            // Close modal and spy report window
            setShowShareModal(false);
            onClose();
        } catch (err) {
            console.error('Error sharing report:', err);
            alert('Failed to share report: ' + err.message);
        } finally {
            setSharing(false);
        }
    };

    if (!spyReport) {
        return (
            <div className="p-4 text-center">
                <p>No spy report loaded.</p>
                <button
                    onClick={onClose}
                    className="mt-4 px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#c0c0c0] font-sans text-sm pb-2">

            {/* Toolbar / Header */}
            <div className="bg-[#000080] p-1 text-white font-bold mb-2 flex justify-between items-center px-2">
                <span>Spy Report: {spyReport.name || 'Unknown Target'}</span>
                <span className="text-xs font-normal opacity-80">
                    {new Date().toLocaleTimeString()}
                </span>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">

                {/* Economy Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <fieldset className="border border-white border-l-gray-600 border-t-gray-600 p-2 bg-white">
                        <legend className="text-[10px] uppercase font-bold px-1">Gold</legend>
                        <div className="font-bold">{formatNumber(spyReport.gold)}</div>
                    </fieldset>
                    <fieldset className="border border-white border-l-gray-600 border-t-gray-600 p-2 bg-white">
                        <legend className="text-[10px] uppercase font-bold px-1">Vault</legend>
                        <div className="font-bold">
                            {(userStats.research_spy_report || 0) >= 5 ? formatNumber(spyReport.vault) : '???'}
                        </div>
                    </fieldset>
                    <fieldset className="border border-white border-l-gray-600 border-t-gray-600 p-2 bg-white">
                        <legend className="text-[10px] uppercase font-bold px-1">Gold / Min</legend>
                        <div className="font-bold text-green-700">
                            {(userStats.research_spy_report || 0) >= 2 ? `+${formatNumber((spyReport.miners * (2 + Math.max(0, spyReport.gold_mine_level - 1))) + Math.floor((spyReport.citizens) + ((spyReport.attack_soldiers + spyReport.defense_soldiers + spyReport.spies + spyReport.sentries) * 0.5)))}` : '???'}
                        </div>
                    </fieldset>
                    <fieldset className="border border-white border-l-gray-600 border-t-gray-600 p-2 bg-white">
                        <legend className="text-[10px] uppercase font-bold px-1">Citizens</legend>
                        <div className="font-bold">
                            {(userStats.research_spy_report || 0) >= 1 ? formatNumber(spyReport.citizens) : '???'}
                        </div>
                    </fieldset>

                </div>

                {/* Combat Stats */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-xs font-bold">Combat Stats</legend>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between"><span>Attack:</span> <span className="font-bold">{formatNumber(spyReport.attack)}</span></div>
                        <div className="flex justify-between"><span>Defense:</span> <span className="font-bold">{formatNumber(spyReport.defense)}</span></div>
                        <div className="flex justify-between"><span>Spy:</span> <span className="font-bold">{formatNumber(spyReport.spy)}</span></div>
                        <div className="flex justify-between"><span>Sentry:</span> <span className="font-bold">{formatNumber(spyReport.sentry)}</span></div>
                    </div>
                </fieldset>

                {/* Army Units */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-xs font-bold">Army Units</legend>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                            <span>Att. Soldiers:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 1 ? formatNumber(spyReport.attack_soldiers) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Def. Soldiers:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 1 ? formatNumber(spyReport.defense_soldiers) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Spies:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 1 ? formatNumber(spyReport.spies) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Sentries:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 1 ? formatNumber(spyReport.sentries) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Miners:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 2 ? formatNumber(spyReport.miners) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Hostages:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 2 ? formatNumber(spyReport.hostages) : '???'}
                            </span>
                        </div>
                    </div>
                </fieldset>

                {/* Infrastructure */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-xs font-bold">Infrastructure</legend>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                            <span>Kingdom Lvl:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 2 ? formatNumber(spyReport.kingdom_level) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Gold Mine Lvl:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 2 ? formatNumber(spyReport.gold_mine_level) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Barracks Lvl:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 2 ? formatNumber(spyReport.barracks_level) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Library Lvl:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 4 ? formatNumber(spyReport.library_level) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Vault Lvl:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 5 ? formatNumber(spyReport.vault_level) : '???'}
                            </span>
                        </div>
                    </div>
                </fieldset>

                {/* Armoury */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-xs font-bold">Armoury</legend>
                    {(userStats.research_spy_report || 0) >= 3 ? (
                        <div className="space-y-2">
                            {/* Detailed Weapon List */}
                            {(!spyReport.weapons_data || spyReport.weapons_data.length === 0) ? (
                                <div className="text-gray-500 italic text-xs">No weapons found in armoury.</div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {['attack', 'defense', 'spy', 'sentry'].map(type => {
                                        const typeWeapons = (spyReport.weapons_data || []).filter(w => w.type === type);
                                        if (typeWeapons.length === 0) return null;
                                        return (
                                            <div key={type} className="bg-white p-1 border border-gray-300">
                                                <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">{type} Gear</div>
                                                {typeWeapons.map((w, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs">
                                                        <span>{WEAPON_NAMES[type]?.[w.tier] || `Tier ${w.tier}`}</span>
                                                        <span className="font-bold">{formatNumber(w.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 text-xs italic">
                            ??? (Requires Spy Lvl 3)
                        </div>
                    )}
                </fieldset>

                {/* Technology */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-xs font-bold">Technology</legend>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                            <span>Weapons:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 3 ? formatNumber(spyReport.research_weapons) : '???'}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span>Attack Tech:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 4 ? formatNumber(spyReport.research_attack) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Defense Tech:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 4 ? formatNumber(spyReport.research_defense) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Spy Tech:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 4 ? formatNumber(spyReport.research_spy) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Sentry Tech:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 4 ? formatNumber(spyReport.research_sentry) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Economy:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 4 ? formatNumber(spyReport.research_turns_per_min) : '???'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Convert Hostages:</span>
                            <span className="font-bold">
                                {(userStats.research_spy_report || 0) >= 4 ? formatNumber(spyReport.research_hostage_convert) : '???'}
                            </span>
                        </div>
                    </div>
                </fieldset>

                {/* Footer Actions */}
                <div className="pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleOpenShareModal}
                            className="py-1 bg-blue-600 text-white border-2 border-blue-400 border-r-blue-800 border-b-blue-800 active:border-blue-800 active:border-r-blue-400 active:border-b-blue-400 font-bold text-sm"
                        >
                            📤 Share Report
                        </button>
                        <button
                            onClick={onClose}
                            className="py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold text-black text-sm"
                        >
                            Close Report
                        </button>
                    </div>
                    {spyReport.name === 'Clippy' && (
                        <p className="text-center text-[10px] mt-2 text-gray-500 italic">
                            (This was a tutorial mission. Reloading to proceed...)
                        </p>
                    )}
                </div>
            </div>

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 p-1 shadow-xl max-w-md w-full">
                        <div className="px-2 py-1 bg-[#000080] text-white font-bold flex justify-between items-center">
                            <span>Share Spy Report</span>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="bg-[#c0c0c0] text-black w-5 h-4 text-xs flex items-center justify-center border border-white border-r-black border-b-black font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-2">Share With:</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="alliance"
                                            checked={shareType === 'alliance'}
                                            onChange={(e) => setShareType(e.target.value)}
                                            disabled={!userStats.alliance_id}
                                        />
                                        <span className="text-sm">Entire Alliance {!userStats.alliance_id && '(Not in alliance)'}</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="individual"
                                            checked={shareType === 'individual'}
                                            onChange={(e) => setShareType(e.target.value)}
                                        />
                                        <span className="text-sm">Individual Player</span>
                                    </label>
                                </div>
                            </div>

                            {shareType === 'individual' && (
                                <div>
                                    <label className="block text-xs font-bold mb-1">Select Player:</label>
                                    <select
                                        value={selectedUser || ''}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        className="w-full border border-gray-600 p-1 text-sm"
                                    >
                                        <option value="">-- Select a player --</option>
                                        {allianceMembers.map(member => (
                                            <option key={member.id} value={member.id}>
                                                {member.username}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {userStats.alliance_id ? 'Showing alliance members' : 'Join an alliance to share with members'}
                                    </p>
                                </div>
                            )}

                            <div className="bg-yellow-50 border border-yellow-300 p-2 text-xs">
                                <p className="font-bold mb-1">ℹ️ Note:</p>
                                <p>Shared reports expire after 24 hours and will appear in the recipient's alliance chat.</p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleShare}
                                    disabled={sharing || (shareType === 'alliance' && !userStats.alliance_id)}
                                    className="flex-1 py-1 bg-blue-600 text-white border-2 border-blue-400 border-r-blue-800 border-b-blue-800 active:border-blue-800 active:border-r-blue-400 active:border-b-blue-400 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sharing ? 'Sharing...' : 'Share'}
                                </button>
                                <button
                                    onClick={() => setShowShareModal(false)}
                                    className="flex-1 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
