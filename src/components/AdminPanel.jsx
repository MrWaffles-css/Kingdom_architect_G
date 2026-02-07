import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import AdminMailPanel from './AdminMailPanel';

export default function AdminPanel({ onClose, onWorldReset, onUserUpdate, initialTab, onTabChange }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [activeTab, setActiveTabInternal] = useState(initialTab || 'users'); // 'users', 'mail', 'mechanics'

    const setActiveTab = (tab) => {
        setActiveTabInternal(tab);
        if (onTabChange) {
            onTabChange(tab);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (profilesError) throw profilesError;
            const { data: stats, error: statsError } = await supabase.from('user_stats').select('*');
            if (statsError) throw statsError;

            const mergedUsers = profiles.map(profile => {
                const userStat = stats.find(s => s.id === profile.id) || {};
                return { ...profile, ...userStat };
            });

            setUsers(mergedUsers);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (userId, updates) => {
        try {
            const profileUpdates = {};
            const statsUpdates = {};
            if (updates.username !== undefined) profileUpdates.username = updates.username;
            if (updates.is_admin !== undefined) profileUpdates.is_admin = updates.is_admin;
            if (updates.gold !== undefined) statsUpdates.gold = updates.gold;
            if (updates.citizens !== undefined) statsUpdates.citizens = updates.citizens;
            if (updates.experience !== undefined) statsUpdates.experience = updates.experience;
            if (updates.turns !== undefined) statsUpdates.turns = updates.turns;
            if (updates.kingdom_level !== undefined) statsUpdates.kingdom_level = updates.kingdom_level;
            if (updates.vault !== undefined) statsUpdates.vault = updates.vault;

            if (Object.keys(profileUpdates).length > 0) {
                const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', userId);
                if (error) throw error;
            }
            if (Object.keys(statsUpdates).length > 0) {
                const { error } = await supabase.from('user_stats').update(statsUpdates).eq('id', userId);
                if (error) throw error;
            }

            setEditingUser(null);
            fetchUsers();
            if (onUserUpdate) onUserUpdate();
        } catch (err) {
            console.error('Error updating user:', err);
            console.error('Failed to update user:', err.message);
        }
    };

    const handleResetWorld = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('reset_world');

            if (error) throw error;
            console.log('World has been reset successfully.');
            if (onWorldReset) onWorldReset();
            fetchUsers();
        } catch (err) {
            console.error('Error resetting world:', err);
            console.error('Failed to reset world:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleScheduleSeason = async (date) => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('set_season_end_time', { p_end_time: date });
            if (error) throw error;
            console.log('Season end time updated successfully!');
        } catch (err) {
            console.error('Error scheduling season:', err);
            console.error('Failed to schedule season:', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="font-sans bg-[#c0c0c0] h-full flex flex-col">
            {/* Tab Bar */}
            <div className="flex border-b-2 border-gray-600 bg-[#c0c0c0]">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 border-2 ${activeTab === 'users'
                        ? 'border-white border-b-[#c0c0c0] bg-[#c0c0c0] border-r-gray-600 border-t-white border-l-white -mb-[2px] relative z-10'
                        : 'border-gray-600 border-r-white border-b-white bg-gray-300 mt-[2px]'
                        } font-bold text-sm`}
                >
                    User Management
                </button>
                <button
                    onClick={() => setActiveTab('mail')}
                    className={`px-4 py-2 border-2 ${activeTab === 'mail'
                        ? 'border-white border-b-[#c0c0c0] bg-[#c0c0c0] border-r-gray-600 border-t-white border-l-white -mb-[2px] relative z-10'
                        : 'border-gray-600 border-r-white border-b-white bg-gray-300 mt-[2px]'
                        } font-bold text-sm`}
                >
                    Mail
                </button>
                <button
                    onClick={() => setActiveTab('season')}
                    className={`px-4 py-2 border-2 ${activeTab === 'season'
                        ? 'border-white border-b-[#c0c0c0] bg-[#c0c0c0] border-r-gray-600 border-t-white border-l-white -mb-[2px] relative z-10'
                        : 'border-gray-600 border-r-white border-b-white bg-gray-300 mt-[2px]'
                        } font-bold text-sm`}
                >
                    Season
                </button>
                <button
                    onClick={() => setActiveTab('mechanics')}
                    className={`px-4 py-2 border-2 ${activeTab === 'mechanics'
                        ? 'border-white border-b-[#c0c0c0] bg-[#c0c0c0] border-r-gray-600 border-t-white border-l-white -mb-[2px] relative z-10'
                        : 'border-gray-600 border-r-white border-b-white bg-gray-300 mt-[2px]'
                        } font-bold text-sm`}
                >
                    Mechanics
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 border-2 ${activeTab === 'settings'
                        ? 'border-white border-b-[#c0c0c0] bg-[#c0c0c0] border-r-gray-600 border-t-white border-l-white -mb-[2px] relative z-10'
                        : 'border-gray-600 border-r-white border-b-white bg-gray-300 mt-[2px]'
                        } font-bold text-sm`}
                >
                    Settings
                </button>
                <div className="flex-1 border-b-2 border-gray-600"></div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-4">
                <div className="flex justify-end gap-2 mb-4">
                </div>

                {
                    activeTab === 'users' && (
                        <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-2 h-full flex flex-col">
                            <legend className="font-bold px-1 text-sm">User Management</legend>
                            <div className="bg-white border-2 border-gray-600 border-r-white border-b-white flex-1 overflow-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 bg-gray-200">
                                        <tr className="bg-gray-200 border-b border-gray-400">
                                            <th className="p-2 border-r border-gray-300">User</th>
                                            <th className="p-2 border-r border-gray-300">Last Active</th>
                                            <th className="p-2 border-r border-gray-300">Role</th>
                                            <th className="p-2 text-right border-r border-gray-300">Lvl</th>
                                            <th className="p-2 text-right border-r border-gray-300">Pop</th>
                                            <th className="p-2 text-right border-r border-gray-300">Gold</th>
                                            <th className="p-2 text-right border-r border-gray-300">Vault</th>
                                            <th className="p-2 text-right border-r border-gray-300">Turns</th>
                                            <th className="p-2 text-right border-r border-gray-300">EXP</th>
                                            <th className="p-2 text-center">Act</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <UserRow
                                                key={user.id}
                                                user={user}
                                                isEditing={editingUser === user.id}
                                                onEdit={() => setEditingUser(user.id)}
                                                onCancel={() => setEditingUser(null)}
                                                onSave={(updates) => handleSaveUser(user.id, updates)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </fieldset>
                    )
                }

                {
                    activeTab === 'mail' && (
                        <AdminMailPanel />
                    )
                }

                {
                    activeTab === 'season' && (
                        <AdminSeasonPanel onSchedule={handleScheduleSeason} onResetWorld={handleResetWorld} />
                    )
                }

                {
                    activeTab === 'mechanics' && (
                        <AdminMechanicsPanel />
                    )
                }

                {
                    activeTab === 'settings' && (
                        <AdminSettingsPanel />
                    )
                }
            </div>
        </div>
    );
}

function AdminSeasonPanel({ onSchedule, onResetWorld }) {
    const [schedule, setSchedule] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(false);
    const [seasonNumber, setSeasonNumber] = useState('');
    const [isBeta, setIsBeta] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [systemStatus, setSystemStatus] = useState(null);
    const [seasons, setSeasons] = useState([]);

    useEffect(() => {
        fetchSchedule();
        fetchSeasons();
    }, []);

    const fetchSchedule = async () => {
        const { data, error } = await supabase.rpc('get_system_status');
        if (!error && data) {
            setSystemStatus(data);

            // Helper to convert UTC timestamp to Local ISO string for input[type="datetime-local"]
            const toLocal = (dStr) => {
                if (!dStr) return '';
                const d = new Date(dStr);
                // Adjust for timezone offset so toISOString() outputs local time
                const offset = d.getTimezoneOffset() * 60000;
                const localDate = new Date(d.getTime() - offset);
                return localDate.toISOString().slice(0, 16);
            };

            setSchedule({
                start: toLocal(data.start_time),
                end: toLocal(data.end_time)
            });
        }
    };

    const fetchSeasons = async () => {
        const { data, error } = await supabase
            .from('hall_of_fame_seasons')
            .select('*')
            .order('season_number', { ascending: false });

        if (!error && data) {
            setSeasons(data);
        }
    };

    const handleSaveSchedule = async () => {
        setLoading(true);
        try {
            const startVal = schedule.start ? new Date(schedule.start).toISOString() : null;
            const endVal = schedule.end ? new Date(schedule.end).toISOString() : null;

            const { error } = await supabase.rpc('set_season_schedule', {
                p_start_time: startVal,
                p_end_time: endVal
            });

            if (error) throw error;
            alert('Season schedule updated successfully!');
            fetchSchedule(); // Refresh
        } catch (err) {
            console.error('Error saving sclude:', err);
            alert('Failed to save schedule: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = async () => {
        if (!seasonNumber) return alert('Please enter a season number');
        if (!window.confirm(`Are you sure you want to archive the current rankings as Season ${seasonNumber}${isBeta ? ' (BETA)' : ''}?`)) return;

        setArchiving(true);
        try {
            const { data, error } = await supabase.rpc('archive_hall_of_fame', {
                p_season_number: parseInt(seasonNumber),
                p_is_beta: isBeta
            });
            if (error) throw error;
            alert('Successfully archived Season ' + seasonNumber);
            setSeasonNumber('');
            setIsBeta(false);
            fetchSeasons();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setArchiving(false);
        }
    };

    const handleDeleteSeason = async (seasonNum) => {
        if (!window.confirm(`Are you SURE you want to DELETE Season ${seasonNum}? This cannot be undone.`)) return;

        try {
            const { error } = await supabase.rpc('delete_hall_of_fame_season', { p_season_number: seasonNum });
            if (error) throw error;
            alert(`Season ${seasonNum} deleted.`);
            fetchSeasons();
        } catch (err) {
            console.error('Error deleting season:', err);
            alert('Failed to delete season: ' + err.message);
        }
    };

    return (
        <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-4 h-full overflow-auto">
            <legend className="font-bold px-1 text-sm">Season Management</legend>

            <div className="space-y-6">

                {/* Status Overview */}
                <div className="bg-gray-100 p-4 border border-gray-400">
                    <h3 className="font-bold mb-2">System Status:</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-600">Current State:</span>
                            <span className={`font-mono font-bold uppercase ${systemStatus?.status === 'active' ? 'text-green-700' : 'text-orange-700'}`}>
                                {systemStatus?.status || 'Loading...'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-600">Server Time:</span>
                            <span className="font-mono">{systemStatus?.server_time ? new Date(systemStatus.server_time).toLocaleString() : '...'}</span>
                        </div>
                    </div>
                </div>

                {/* Unified Scheduler */}
                <div className="bg-blue-50 p-4 border border-blue-300">
                    <h3 className="font-bold mb-4 text-blue-900">Season Schedule</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Start Time */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-gray-600">Next Season Start</label>
                            <input
                                type="datetime-local"
                                value={schedule.start}
                                onChange={(e) => setSchedule(prev => ({ ...prev, start: e.target.value }))}
                                className="border border-gray-400 p-1 font-mono text-sm"
                            />
                            <p className="text-[10px] text-gray-500">
                                When this time is reached, the status becomes 'active' (if not ended).
                                <br />Clearing this will result in immediate start if no other blocks exist.
                            </p>
                        </div>

                        {/* End Time */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold uppercase text-gray-600">Current Season End</label>
                            <input
                                type="datetime-local"
                                value={schedule.end}
                                onChange={(e) => setSchedule(prev => ({ ...prev, end: e.target.value }))}
                                className="border border-gray-400 p-1 font-mono text-sm"
                            />
                            <p className="text-[10px] text-gray-500">
                                When this time is reached, the status becomes 'ended'.
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSaveSchedule}
                            disabled={loading}
                            className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 font-bold text-sm active:translate-y-[1px] shadow-sm"
                        >
                            {loading ? 'Saving...' : '💾 Save Scheculement'}
                        </button>
                    </div>
                </div>

                {/* Archive Hall of Fame */}
                <div className="bg-yellow-100 p-4 border border-gray-400">
                    <h3 className="font-bold mb-2">Archive Current Rankings:</h3>
                    <p className="text-sm mb-2 text-gray-700">Snapshot current leaderboard to Hall of Fame.</p>
                    <div className="flex gap-2 items-center mb-4">
                        <input
                            type="number"
                            placeholder="Season #"
                            value={seasonNumber}
                            onChange={(e) => setSeasonNumber(e.target.value)}
                            className="border border-gray-400 p-1 w-16"
                        />
                        <label className="flex items-center gap-1 text-sm select-none cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isBeta}
                                onChange={(e) => setIsBeta(e.target.checked)}
                            />
                            <span>Beta?</span>
                        </label>
                        <button
                            onClick={handleArchive}
                            disabled={archiving}
                            className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 font-bold text-sm active:translate-y-[1px]"
                        >
                            {archiving ? 'Archiving...' : 'Archive Standings'}
                        </button>
                    </div>

                    <div className="border-t border-gray-300 pt-2 mt-2">
                        <h4 className="font-bold text-xs mb-2 text-gray-600">Archived Seasons:</h4>
                        {seasons.length === 0 ? (
                            <div className="text-xs text-gray-500 italic">No seasons archived.</div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {seasons.map(season => (
                                    <div key={season.id} className="bg-white border border-gray-400 px-2 py-1 flex items-center gap-2 text-xs shadow-sm">
                                        <span className="font-bold text-blue-900">
                                            Season {season.season_number}
                                            {season.is_beta && <span className="ml-1 text-[10px] text-orange-600 border border-orange-400 rounded px-1">BETA</span>}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteSeason(season.season_number)}
                                            className="text-red-600 hover:text-red-800 font-bold px-1 hover:bg-red-100"
                                            title="Delete Season"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-100 p-4 border border-red-400 mt-6">
                    <h3 className="font-bold mb-2 text-red-900">Danger Zone:</h3>
                    <p className="text-sm mb-4 text-red-800">Irreversible actions. Proceed with caution.</p>
                    <button
                        onClick={() => { if (window.confirm('ARE YOU SURE? This will reset ALL progress for ALL players. This cannot be undone.')) onResetWorld(); }}
                        className="w-full px-4 py-2 bg-red-800 text-white font-bold border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-sm"
                    >
                        ⚠ RESET WORLD (DELETE EVERYTHING)
                    </button>
                </div>
            </div>
        </fieldset>
    );
}

function AdminMechanicsPanel() {
    const [mechanics, setMechanics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBossEditor, setShowBossEditor] = useState(false);

    const [showHostageEditor, setShowHostageEditor] = useState(false);
    const [showLibraryEditor, setShowLibraryEditor] = useState(false);
    const [showKingdomEditor, setShowKingdomEditor] = useState(false);
    const [showGoldMineEditor, setShowGoldMineEditor] = useState(false);
    const [showBarracksEditor, setShowBarracksEditor] = useState(false);
    const [showVaultStealingEditor, setShowVaultStealingEditor] = useState(false);
    const [showVaultEditor, setShowVaultEditor] = useState(false);
    const [showTechStatsEditor, setShowTechStatsEditor] = useState(false);
    const [showTurnsResearchEditor, setShowTurnsResearchEditor] = useState(false);
    const [showArmouryEditor, setShowArmouryEditor] = useState(false);
    const [showGoldStealEditor, setShowGoldStealEditor] = useState(false);
    const [showGameVariablesEditor, setShowGameVariablesEditor] = useState(false);

    useEffect(() => {
        fetchMechanics();
    }, []);

    const fetchMechanics = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_all_mechanics');
            if (error) throw error;
            // Filter out mechanics that should always be enabled and not toggled
            const permanentlyEnabled = ['alliance_system', 'spy_reports'];
            setMechanics((data || []).filter(m => !permanentlyEnabled.includes(m.key)));
        } catch (err) {
            console.error('Error fetching mechanics:', err);
            alert('Failed to load mechanics: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleMechanic = async (key, currentEnabled) => {
        try {
            const newEnabled = !currentEnabled;
            const { data, error } = await supabase.rpc('toggle_mechanic', {
                p_key: key,
                p_enabled: newEnabled
            });

            if (error) throw error;
            if (data && !data.success) {
                alert(data.message || 'Failed to toggle mechanic');
                return;
            }

            // Update local state
            setMechanics(prev => prev.map(m =>
                m.key === key ? { ...m, enabled: newEnabled } : m
            ));
        } catch (err) {
            console.error('Error toggling mechanic:', err);
            alert('Failed to toggle mechanic: ' + err.message);
        }
    };

    const getMechanicIcon = (key) => {
        const icons = {
            'vault_stealing': '🔐',
            'hostage_system': '⛓️',
            'alliance_system': '🤝',
            'boss_fights': '👹',
            'spy_reports': '🕵️',
            'kingdom_system': '🏰',
            'gold_mine_system': '⛏️',
            'barracks_system': '🗡️',
            'vault_system': '🏦',
            'tech_stats_system': '⚔️',
            'turns_research_system': '⏱️'
        };
        return icons[key] || '⚙️';
    };

    const getMechanicName = (key) => {
        return key.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    if (loading) {
        return (
            <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-4 h-full">
                <legend className="font-bold px-1 text-sm">Game Mechanics</legend>
                <div className="flex items-center justify-center h-32">
                    <div className="text-gray-500">Loading mechanics...</div>
                </div>
            </fieldset>
        );
    }


    return (
        <>
            <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-4 h-full overflow-auto">
                <legend className="font-bold px-1 text-sm">Game Mechanics</legend>

                <div className="flex flex-col h-full gap-4">
                    {/* Global Config Section */}
                    <div className="bg-white border-2 border-gray-500 border-r-white border-b-white">
                        <div className="bg-gradient-to-r from-teal-700 to-teal-500 text-white px-2 py-1 font-bold text-xs border-b border-gray-400">
                            🌍 Global Config
                        </div>
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-[#c0c0c0]">
                                <tr>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left w-8">On</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left">Feature</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="hover:bg-blue-800 hover:text-white group">
                                    <td className="border border-gray-200 p-1 text-center">
                                        <input type="checkbox" checked={true} disabled className="cursor-not-allowed" />
                                    </td>
                                    <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                        <span>⚙️</span>
                                        <span>Game Variables (Spy Ratio, Kill Rates)</span>
                                    </td>
                                    <td className="border border-gray-200 p-1 text-center">
                                        <button
                                            onClick={() => setShowGameVariablesEditor(true)}
                                            className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                        >
                                            Setup
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Library Upgrades Section */}
                    <div className="bg-white border-2 border-gray-500 border-r-white border-b-white">
                        <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-2 py-1 font-bold text-xs border-b border-gray-400">
                            📚 Library Upgrades
                        </div>
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-[#c0c0c0]">
                                <tr>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left w-8">On</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left">Feature</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Tech Stats System */}
                                {mechanics.filter(m => m.key === 'tech_stats_system').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowTechStatsEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* Turns Research System */}
                                {mechanics.filter(m => m.key === 'turns_research_system').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowTurnsResearchEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* Hostage System */}
                                {mechanics.filter(m => m.key === 'hostage_system').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowHostageEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* Vault Stealing */}
                                {mechanics.filter(m => m.key === 'vault_stealing').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowVaultStealingEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* Gold Stealing (Increase Stolen %) */}
                                {mechanics.filter(m => m.key === 'gold_stealing').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowGoldStealEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Buildings Section */}
                    <div className="bg-white border-2 border-gray-500 border-r-white border-b-white">
                        <div className="bg-gradient-to-r from-amber-700 to-amber-500 text-white px-2 py-1 font-bold text-xs border-b border-gray-400">
                            🏗️ Buildings
                        </div>
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-[#c0c0c0]">
                                <tr>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left w-8">On</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left">Feature</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Royal Library */}
                                <tr className="hover:bg-blue-800 hover:text-white group">
                                    <td className="border border-gray-200 p-1 text-center">
                                        <input type="checkbox" checked={true} disabled className="cursor-not-allowed" />
                                    </td>
                                    <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                        <span>📚</span>
                                        <span>Royal Library</span>
                                    </td>
                                    <td className="border border-gray-200 p-1 text-center">
                                        <button
                                            onClick={() => setShowLibraryEditor(true)}
                                            className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                        >
                                            Setup
                                        </button>
                                    </td>
                                </tr>

                                {/* Royal Armoury */}
                                <tr className="hover:bg-blue-800 hover:text-white group">
                                    <td className="border border-gray-200 p-1 text-center">
                                        <input type="checkbox" checked={true} disabled className="cursor-not-allowed" />
                                    </td>
                                    <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                        <span>⚔️</span>
                                        <span>Royal Armoury</span>
                                    </td>
                                    <td className="border border-gray-200 p-1 text-center">
                                        <button
                                            onClick={() => setShowArmouryEditor(true)}
                                            className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                        >
                                            Setup
                                        </button>
                                    </td>
                                </tr>


                                {/* Kingdom System */}
                                {mechanics.filter(m => m.key === 'kingdom_system').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowKingdomEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* Gold Mine System */}
                                {mechanics.filter(m => m.key === 'gold_mine_system').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowGoldMineEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* Barracks System */}
                                {mechanics.filter(m => m.key === 'barracks_system').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowBarracksEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* Vault System */}
                                {mechanics.filter(m => m.key === 'vault_system').map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            <button
                                                onClick={() => setShowVaultEditor(true)}
                                                className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                            >
                                                Setup
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Other Section */}
                    <div className="bg-white border-2 border-gray-500 border-r-white border-b-white">
                        <div className="bg-gradient-to-r from-purple-700 to-purple-500 text-white px-2 py-1 font-bold text-xs border-b border-gray-400">
                            ⚙️ Other
                        </div>
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-[#c0c0c0]">
                                <tr>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left w-8">On</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 text-left">Feature</th>
                                    <th className="border border-gray-500 border-t-white border-l-white px-2 py-0.5 w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* All other mechanics */}
                                {mechanics.filter(m => !['tech_stats_system', 'turns_research_system', 'hostage_system', 'vault_stealing', 'kingdom_system', 'gold_mine_system', 'barracks_system', 'vault_system', 'gold_stealing'].includes(m.key)).map(mechanic => (
                                    <tr key={mechanic.key} className="hover:bg-blue-800 hover:text-white group">
                                        <td className="border border-gray-200 p-1 text-center">
                                            <input
                                                type="checkbox"
                                                checked={mechanic.enabled}
                                                onChange={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="border border-gray-200 p-1 flex items-center gap-2 select-none">
                                            <span>{getMechanicIcon(mechanic.key)}</span>
                                            <span>{getMechanicName(mechanic.key)}</span>
                                        </td>
                                        <td className="border border-gray-200 p-1 text-center">
                                            {['boss_fights'].includes(mechanic.key) && (
                                                <button
                                                    onClick={() => {
                                                        if (mechanic.key === 'boss_fights') setShowBossEditor(true);
                                                    }}
                                                    className="px-2 py-0.5 bg-[#c0c0c0] text-black border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:border-b-white font-bold"
                                                >
                                                    Setup
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </fieldset>

            {/* Modals */}
            {showBossEditor && <BossEditorModal onClose={() => setShowBossEditor(false)} />}
            {showHostageEditor && <HostageEditorModal onClose={() => setShowHostageEditor(false)} />}
            {showLibraryEditor && <LibraryEditorModal onClose={() => setShowLibraryEditor(false)} />}
            {showKingdomEditor && <KingdomEditorModal onClose={() => setShowKingdomEditor(false)} />}
            {showGoldMineEditor && <GoldMineEditorModal onClose={() => setShowGoldMineEditor(false)} />}
            {showBarracksEditor && <BarracksEditorModal onClose={() => setShowBarracksEditor(false)} />}
            {showVaultStealingEditor && <VaultStealingEditorModal onClose={() => setShowVaultStealingEditor(false)} />}
            {showVaultEditor && <VaultEditorModal onClose={() => setShowVaultEditor(false)} />}
            {showTechStatsEditor && <TechStatsEditorModal onClose={() => setShowTechStatsEditor(false)} />}
            {showTurnsResearchEditor && <TurnsResearchEditorModal onClose={() => setShowTurnsResearchEditor(false)} />}
            {showArmouryEditor && <ArmouryEditorModal onClose={() => setShowArmouryEditor(false)} />}
            {showGoldStealEditor && <GoldStealEditorModal onClose={() => setShowGoldStealEditor(false)} />}
            {showGameVariablesEditor && <GameVariablesEditorModal onClose={() => setShowGameVariablesEditor(false)} />}
        </>
    );
}

function GameVariablesEditorModal({ onClose }) {
    const [variables, setVariables] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVariables();
    }, []);

    const fetchVariables = async () => {
        try {
            const { data, error } = await supabase.rpc('get_all_game_config_variables');
            if (error) throw error;
            setVariables(data || []);
        } catch (err) {
            console.error(err);
            alert('Error loading variables: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (key, newValue) => {
        try {
            const { error } = await supabase.rpc('update_game_config_variable', {
                p_key: key,
                p_value: parseFloat(newValue)
            });
            if (error) throw error;

            setVariables(prev => prev.map(v => v.key === key ? { ...v, value: parseFloat(newValue) } : v));
        } catch (err) {
            console.error(err);
            alert('Error updating variable: ' + err.message);
        }
    };

    // Grouping Logic
    const CATEGORIES = {
        '⚔️ Attack Mechanics': ['attack_experience_gain', 'attack_turn_cost', 'attack_loss_rate_max', 'attack_loss_rate_min'],
        '🛡️ Defense Mechanics': ['defense_kill_rate_max', 'defense_kill_rate_min'],
        '🔥 Pillage & Stealing': ['citizen_kill_rate_max', 'citizen_kill_rate_min', 'miner_kill_rate_max', 'miner_kill_rate_min'],
        '🕵️ Espionage': ['spy_sentry_ratio'],
    };

    const getGroupedVariables = () => {
        const grouped = {};
        const assignedKeys = new Set();

        // Initialize groups
        Object.keys(CATEGORIES).forEach(cat => grouped[cat] = []);
        grouped['⚙️ Miscellaneous'] = [];

        // Assign variables to groups
        variables.forEach(v => {
            let assigned = false;
            for (const [cat, keys] of Object.entries(CATEGORIES)) {
                if (keys.includes(v.key)) {
                    grouped[cat].push(v);
                    assignedKeys.add(v.key);
                    assigned = true;
                    break;
                }
            }
            if (!assigned) {
                grouped['⚙️ Miscellaneous'].push(v);
            }
        });

        // Filter out empty groups
        return Object.entries(grouped).filter(([_, vars]) => vars.length > 0);
    };

    const groupedVars = getGroupedVariables();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-[800px] bg-[#c0c0c0] border-2 border-white border-r-black border-b-black p-1 shadow-xl flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900 text-white px-2 py-1 flex justify-between items-center select-none">
                    <span className="font-bold text-sm">Game Configuration Variables</span>
                    <button onClick={onClose} className="text-white hover:bg-red-600 px-1 rounded">✖</button>
                </div>

                <div className="p-4 overflow-auto flex-1 bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-4">Loading...</div>
                    ) : (
                        <div className="space-y-6">
                            {groupedVars.map(([category, vars]) => (
                                <div key={category} className="bg-white border-2 border-gray-500 border-r-white border-b-white">
                                    <div className="bg-gray-200 px-2 py-1 font-bold text-xs border-b border-gray-400 text-gray-800">
                                        {category}
                                    </div>
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 text-xs text-gray-500">
                                                <th className="border border-gray-300 px-2 py-1 text-left w-1/4">Variable</th>
                                                <th className="border border-gray-300 px-2 py-1 text-left">Description</th>
                                                <th className="border border-gray-300 px-2 py-1 w-24">Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vars.map(v => (
                                                <tr key={v.key} className="hover:bg-blue-50">
                                                    <td className="border border-gray-300 px-2 py-1 font-mono font-bold text-xs text-blue-800" title={v.key}>
                                                        {v.key}
                                                    </td>
                                                    <td className="border border-gray-300 px-2 py-1 text-xs text-gray-600 leading-tight">
                                                        {v.description}
                                                    </td>
                                                    <td className="border border-gray-300 px-1 py-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={v.value}
                                                            onChange={(e) => handleUpdate(v.key, e.target.value)}
                                                            className="w-full border border-gray-400 px-1 font-mono text-right text-sm focus:border-blue-500 focus:outline-none"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-2 border-t border-gray-400 flex justify-end bg-[#c0c0c0]">
                    <button
                        onClick={onClose}
                        className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-r-white active:border-b-white text-sm font-bold active:translate-y-[1px]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function BossEditorModal({ onClose }) {
    const [bosses, setBosses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchBosses();
    }, []);

    const fetchBosses = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_boss_configs');
            if (error) throw error;
            // Sort by ID to ensure stable order
            const sorted = (data || []).sort((a, b) => a.id - b.id);
            setBosses(sorted);
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching bosses:', err);
            alert('Failed to load bosses: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (id, field, value) => {
        setBosses(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
        setHasChanges(true);
    };

    const handleSaveAll = async () => {
        if (!window.confirm('Are you sure you want to save ALL changes? This will immediately affect the game.')) return;

        try {
            setSaving(true);

            // Execute all updates in parallel
            const updates = bosses.map(boss =>
                supabase.rpc('update_boss_config', {
                    p_id: boss.id,
                    p_name: boss.name,
                    p_req_total_stats: parseInt(boss.req_total_stats) || 0,
                    p_cost_turns: parseInt(boss.cost_turns) || 0,
                    p_duration_seconds: parseInt(boss.duration_seconds) || 0,
                    p_reward_xp: parseInt(boss.reward_xp) || 0,
                    p_reward_gold: parseInt(boss.reward_gold) || 0,
                    p_reward_citizens: parseInt(boss.reward_citizens) || 0
                })
            );

            const results = await Promise.all(updates);

            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.error('Some updates failed:', errors);
                throw new Error(`${errors.length} updates failed. Check console.`);
            }

            alert('All bosses updated successfully!');
            setHasChanges(false);
            fetchBosses();

        } catch (err) {
            console.error('Error saving bosses:', err);
            alert('Failed to save changes: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Title Bar */}
                <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-2 py-1 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="font-bold">👹 Boss Configuration Editor (Bulk Mode)</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300 active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-gray-700">Loading bosses...</div>
                        </div>
                    ) : (
                        <div className="bg-white border-2 border-gray-600 border-r-white border-b-white">
                            <table className="w-full text-xs border-collapse">
                                <thead className="sticky top-0 bg-gray-200 border-b-2 border-gray-600 shadow-sm z-10">
                                    <tr>
                                        <th className="p-2 border-r border-gray-400 text-left w-10">ID</th>
                                        <th className="p-2 border-r border-gray-400 text-left w-40">Name</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Required Stats</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Turn Cost</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Duration (s)</th>
                                        <th className="p-2 border-r border-gray-400 text-right">XP Reward</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Gold Reward</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Citizens Reward</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bosses.map((boss, idx) => (
                                        <BossRow
                                            key={boss.id}
                                            boss={boss}
                                            onChange={handleChange}
                                            isEven={idx % 2 === 0}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-xs">
                        <p className="font-bold mb-1">⚠️ Important Notes:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Changes take effect <strong>immediately</strong> for all players upon saving.</li>
                            <li>Active boss fights will use the old values until completed.</li>
                            <li>Duration is in seconds (e.g., 60 = 1 minute).</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t-2 border-gray-600 p-3 bg-[#c0c0c0] flex justify-between items-center">
                    <div className="text-xs text-gray-600 italic">
                        {hasChanges ? 'Changes detected - don\'t forget to save!' : 'No unsaved changes.'}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveAll}
                            disabled={saving || !hasChanges}
                            className={`px-6 py-2 border-2 font-bold flex items-center gap-2 ${hasChanges
                                ? 'bg-green-600 text-white border-green-800 hover:bg-green-700 active:border-green-800'
                                : 'bg-gray-400 text-gray-200 border-gray-500 cursor-not-allowed'
                                } border-white border-r-black border-b-black shadow-md active:shadow-none active:translate-y-[1px]`}
                        >
                            {saving ? 'Saving...' : '💾 Save All Changes'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black font-bold active:border-black active:border-r-white active:border-b-white active:translate-y-[1px]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BossRow({ boss, onChange, isEven }) {
    const inputClass = "w-full bg-transparent border-0 border-b border-dashed border-gray-300 px-1 py-1 text-right focus:bg-white focus:border-solid focus:border-blue-500 outline-none hover:bg-white/50 transition-colors";
    const nameInputClass = "w-full bg-transparent border-0 border-b border-dashed border-gray-300 px-1 py-1 text-left focus:bg-white focus:border-solid focus:border-blue-500 outline-none hover:bg-white/50 transition-colors";

    const formatNumber = (num) => {
        if (num === null || num === undefined) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const handleNumberChange = (field, value) => {
        const rawValue = value.replace(/,/g, '');
        if (!isNaN(rawValue) || rawValue === '') {
            onChange(boss.id, field, rawValue);
        }
    };

    return (
        <tr className={isEven ? "bg-gray-50" : "bg-white"}>
            <td className="p-2 border-r border-gray-300 text-center font-bold text-gray-500">{boss.id}</td>
            <td className="p-1 border-r border-gray-300">
                <input
                    type="text"
                    value={boss.name}
                    onChange={e => onChange(boss.id, 'name', e.target.value)}
                    className={nameInputClass}
                />
            </td>
            <td className="p-1 border-r border-gray-300">
                <input
                    type="text"
                    value={formatNumber(boss.req_total_stats)}
                    onChange={e => handleNumberChange('req_total_stats', e.target.value)}
                    className={inputClass}
                />
            </td>
            <td className="p-1 border-r border-gray-300">
                <input
                    type="text"
                    value={formatNumber(boss.cost_turns)}
                    onChange={e => handleNumberChange('cost_turns', e.target.value)}
                    className={inputClass}
                />
            </td>
            <td className="p-1 border-r border-gray-300">
                <input
                    type="text"
                    value={formatNumber(boss.duration_seconds)}
                    onChange={e => handleNumberChange('duration_seconds', e.target.value)}
                    className={inputClass}
                />
            </td>
            <td className="p-1 border-r border-gray-300">
                <input
                    type="text"
                    value={formatNumber(boss.reward_xp)}
                    onChange={e => handleNumberChange('reward_xp', e.target.value)}
                    className={inputClass}
                />
            </td>
            <td className="p-1 border-r border-gray-300">
                <input
                    type="text"
                    value={formatNumber(boss.reward_gold)}
                    onChange={e => handleNumberChange('reward_gold', e.target.value)}
                    className={inputClass}
                />
            </td>
            <td className="p-1 border-r border-gray-300">
                <input
                    type="text"
                    value={formatNumber(boss.reward_citizens)}
                    onChange={e => handleNumberChange('reward_citizens', e.target.value)}
                    className={inputClass}
                />
            </td>
        </tr>
    );
}

function AdminSettingsPanel() {


    const [isMaintenance, setIsMaintenance] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        const { data, error } = await supabase.rpc('get_maintenance_mode');
        if (!error) {
            setIsMaintenance(data);
        }
    };

    const toggleMaintenance = async () => {
        try {
            setLoading(true);
            const newValue = !isMaintenance;
            const { error } = await supabase.rpc('set_maintenance_mode', { p_enabled: newValue });
            if (error) throw error;

            // If we are going ONLINE (newValue === false), clear the planned start time
            if (!newValue) {
                await supabase
                    .from('game_settings')
                    .delete()
                    .eq('key', 'next_season_start');
            }

            setIsMaintenance(newValue);
            // alert(`Maintenance mode turned ${newValue ? 'ON' : 'OFF'}`);
            if (!newValue) window.location.reload(); // Reload to refresh the scheduler view
        } catch (err) {
            console.error('Failed to update maintenance mode:', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-4 h-full">
            <legend className="font-bold px-1 text-sm">System Settings</legend>

            <div className="space-y-6">
                <div className={`p-4 border-2 ${isMaintenance ? 'bg-red-100 border-red-500' : 'bg-green-100 border-green-500'}`}>
                    <h3 className="font-bold mb-2 text-lg">Server Status</h3>

                    <div className="flex items-center gap-4">
                        <div className={`text-2xl font-bold ${isMaintenance ? 'text-red-700' : 'text-green-700'}`}>
                            {isMaintenance ? '⚠ OFFLINE' : '✔ ONLINE'}
                        </div>

                        <button
                            onClick={toggleMaintenance}
                            disabled={loading}
                            className={`px-4 py-2 border-2 font-bold shadow active:translate-y-[1px] ${isMaintenance
                                ? 'bg-green-600 text-white border-green-800'
                                : 'bg-red-600 text-white border-red-800'
                                }`}
                        >
                            {loading ? 'Wait...' : (isMaintenance ? 'Go Online' : 'Go Offline')}
                        </button>
                    </div>

                    <p className="mt-2 text-sm text-gray-700">
                        {isMaintenance
                            ? "Game is offline. Only admins can access the game."
                            : "Game is live and accessible to all players."}
                    </p>
                </div>


            </div>
        </fieldset>
    );
}




function UserRow({ user, isEditing, onEdit, onCancel, onSave }) {
    const [formData, setFormData] = useState({
        username: user.username,
        is_admin: user.is_admin,
        kingdom_level: user.kingdom_level || 0,
        gold: user.gold || 0,
        vault: user.vault || 0,
        citizens: user.citizens || 0,
        turns: user.turns || 0,
        experience: user.experience || 0
    });

    const timeAgo = (dateString) => {
        if (!dateString) return 'Never';
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

    const inputClass = "w-full bg-white border border-gray-400 px-1 outline-none text-right";

    if (!isEditing) {
        return (
            <tr className="hover:bg-blue-100 group">
                <td className="p-2 border-b border-gray-200 border-r">
                    <div className="font-bold">{user.username}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{user.email}</div>
                </td>
                <td className="p-2 border-b border-gray-200 border-r text-xs text-gray-600" title={user.last_active_at ? new Date(user.last_active_at).toLocaleString() : ''}>
                    {timeAgo(user.last_active_at)}
                </td>
                <td className="p-2 border-b border-gray-200 border-r text-center">
                    {user.is_admin ? <span className="font-bold text-red-800">ADMIN</span> : 'Player'}
                </td>
                <td className="p-2 text-right border-b border-gray-200 border-r font-mono">{user.kingdom_level}</td>
                <td className="p-2 text-right border-b border-gray-200 border-r font-mono">{user.citizens?.toLocaleString()}</td>
                <td className="p-2 text-right border-b border-gray-200 border-r font-mono">{user.gold?.toLocaleString()}</td>
                <td className="p-2 text-right border-b border-gray-200 border-r font-mono">{user.vault?.toLocaleString()}</td>
                <td className="p-2 text-right border-b border-gray-200 border-r font-mono">{user.turns?.toLocaleString()}</td>
                <td className="p-2 text-right border-b border-gray-200 border-r font-mono">{user.experience?.toLocaleString()}</td>
                <td className="p-2 text-center border-b border-gray-200">
                    <button onClick={onEdit} className="text-[10px] underline text-blue-800">Edit</button>
                </td>
            </tr>
        );
    }

    return (
        <tr className="bg-yellow-50">
            <td className="p-2 border-b border-gray-200 border-r">
                <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full bg-white border border-gray-400 px-1" />
            </td>
            <td className="p-2 border-b border-gray-200 border-r text-xs text-gray-500">
                {timeAgo(user.last_active_at)}
            </td>
            <td className="p-2 border-b border-gray-200 border-r text-center">
                <input type="checkbox" checked={formData.is_admin} onChange={e => setFormData({ ...formData, is_admin: e.target.checked })} />
            </td>
            <td className="p-2 border-b border-gray-200 border-r"><input type="number" value={formData.kingdom_level} onChange={e => setFormData({ ...formData, kingdom_level: parseInt(e.target.value) || 0 })} className={inputClass} /></td>
            <td className="p-2 border-b border-gray-200 border-r"><input type="number" value={formData.citizens} onChange={e => setFormData({ ...formData, citizens: parseInt(e.target.value) || 0 })} className={inputClass} /></td>
            <td className="p-2 border-b border-gray-200 border-r"><input type="number" value={formData.gold} onChange={e => setFormData({ ...formData, gold: parseInt(e.target.value) || 0 })} className={inputClass} /></td>
            <td className="p-2 border-b border-gray-200 border-r"><input type="number" value={formData.vault} onChange={e => setFormData({ ...formData, vault: parseInt(e.target.value) || 0 })} className={inputClass} /></td>
            <td className="p-2 border-b border-gray-200 border-r"><input type="number" value={formData.turns} onChange={e => setFormData({ ...formData, turns: parseInt(e.target.value) || 0 })} className={inputClass} /></td>
            <td className="p-2 border-b border-gray-200 border-r"><input type="number" value={formData.experience} onChange={e => setFormData({ ...formData, experience: parseInt(e.target.value) || 0 })} className={inputClass} /></td>
            <td className="p-2 text-center border-b border-gray-200 flex gap-1 justify-center">
                <button onClick={() => onSave(formData)} className="text-[10px] font-bold text-green-700">OK</button>
                <button onClick={onCancel} className="text-[10px] text-red-700">Cancel</button>
            </td>
        </tr>
    );
}

function HostageEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_hostage_config');
            if (error) throw error;
            // Ensure levels array is sorted
            if (data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data);
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching hostage config:', err);
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels[config.levels.length - 1];
        const newLevel = {
            level: lastLevel.level + 1,
            cost: Math.round(lastLevel.cost * 1.5),
            bonus: lastLevel.bonus + 5,
            convert_cost: lastLevel.convert_cost
        };
        setConfig(prev => ({ ...prev, levels: [...prev.levels, newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        // if (!window.confirm('Delete this level?')) return;
        const newLevels = config.levels.filter((_, i) => i !== index);
        // Re-index levels to ensure continuity? user might want gaps but our logic assumes sequence.
        // Let's enforce sequence for now:
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        // if (!window.confirm('Are you sure you want to save changes?')) return;

        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_hostage_config_v2', {
                p_levels: config.levels
            });

            if (error) throw error;
            console.log('Hostage configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            console.error('Failed to save:', err.message);
        } finally {
            setSaving(false);
        }
    };

    // Helper for comma formatting in inputs (visual only)
    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-[#800000] to-[#d01010] text-white px-2 py-1 flex justify-between items-center">
                    <span className="font-bold">⛓️ Hostage System Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                            <th className="p-2 border border-gray-300">Cost (Gold)</th>
                                            <th className="p-2 border border-gray-300">Research Bonus (%)</th>
                                            <th className="p-2 border border-gray-300">Conversion Cost (Gold)</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config.levels?.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    {/* Cost is only editable for levels > 0 usually, but let's allow 0 if they want weird configs */}
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="number"
                                                        value={lvl.bonus}
                                                        onChange={(e) => handleLevelChange(idx, 'bonus', e.target.value)}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.convert_cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'convert_cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.levels.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-2 flex justify-between items-center">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-white border border-gray-400 text-xs font-bold hover:bg-gray-50 flex items-center gap-1 shadow-sm"
                                >
                                    ➕ Add Next Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Levels must be sequential. "Cost" is price to reach this level from previous.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-gray-600 p-3 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-6 py-2 border-2 font-bold flex items-center gap-2 ${hasChanges
                            ? 'bg-green-600 text-white border-green-800 hover:bg-green-700 active:border-green-800'
                            : 'bg-gray-400 text-gray-200 border-gray-500 cursor-not-allowed'
                            } border-white border-r-black border-b-black shadow-md active:shadow-none active:translate-y-[1px]`}
                    >
                        {saving ? 'Saving...' : '💾 Save Configuration'}
                    </button>
                    <button onClick={onClose} className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black font-bold active:translate-y-[1px]">Close</button>
                </div>
            </div>
        </div>
    );
}

function LibraryEditorModal({ onClose }) {
    const [levels, setLevels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [configMissing, setConfigMissing] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_library_config');
            if (error) throw error;
            const sorted = (data || []).sort((a, b) => a.level - b.level);
            setLevels(sorted);
            setHasChanges(false);
            setConfigMissing(false);
        } catch (err) {
            console.error('Error fetching library config:', err);
            // Default fallback if table missing (so UI works for checking at least)
            if (err.message.includes('function get_library_config') || err.message.includes('Could not find the function')) {
                setConfigMissing(true);
            } else {
                console.error('Failed to load config:', err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setLevels(newLevels);
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = levels.length > 0 ? levels[levels.length - 1] : { level: 0, upgrade_cost: 0, xp_rate: 0 };
        const newLevel = {
            level: lastLevel.level + 1,
            upgrade_cost: Math.round((lastLevel.upgrade_cost || 100000) * 1.5),
            xp_rate: (lastLevel.xp_rate || 0) + 1
        };
        setLevels([...levels, newLevel]);
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        // if (!window.confirm('Delete this level?')) return;
        const newLevels = levels.filter((_, i) => i !== index);
        // Enforce sequential levels
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i + 1 }));
        setLevels(reindexed);
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (configMissing) {
            console.error('Cannot save: Database configuration is missing.');
            return;
        }
        // if (!window.confirm('Are you sure you want to save changes?')) return;
        console.log('Starting save...');

        try {
            setSaving(true);

            // Get current max level in DB to know if we need to delete any
            console.log('Fetching current config from DB...');
            const { data: dbLevels, error: fetchError } = await supabase.rpc('get_library_config');
            if (fetchError) throw fetchError;

            const dbMax = dbLevels ? Math.max(...dbLevels.map(l => l.level)) : 0;
            const newMax = levels.length > 0 ? Math.max(...levels.map(l => l.level)) : 0;
            console.log('DB Max:', dbMax, 'New Max:', newMax);

            const promises = [];

            // Update/Insert all current levels
            console.log('Preparing updates for', levels.length, 'levels');
            for (const lvl of levels) {
                // Ensure values are numbers
                const payload = {
                    p_level: Number(lvl.level),
                    p_upgrade_cost: Number(lvl.upgrade_cost),
                    p_xp_rate: Number(lvl.xp_rate)
                };
                promises.push(supabase.rpc('update_library_config', payload));
            }

            // Delete excess levels
            for (let i = newMax + 1; i <= dbMax; i++) {
                console.log('Deleting level', i);
                promises.push(supabase.rpc('delete_library_level', { p_level: i }));
            }

            console.log('Executing', promises.length, 'RPC calls...');
            const results = await Promise.all(promises);
            const errors = results.filter(r => r.error);

            if (errors.length > 0) {
                console.error('RPC Errors:', errors);
                throw new Error(`${errors.length} operations failed. First error: ${errors[0].error.message}`);
            }

            console.log('Save complete!');
            console.log('Library configuration updated successfully!');
            setHasChanges(false);
            fetchConfig(); // Refresh
        } catch (err) {
            console.error('Error saving:', err);
            console.error('Failed to save:', (err.message || JSON.stringify(err)));
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num) => num?.toLocaleString() || '0';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-2 py-1 flex justify-between items-center">
                    <span className="font-bold">📚 Library Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : configMissing ? (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                            <p className="font-bold">Configuration Missing</p>
                            <p>The necessary database tables and functions for the Library Configurator have not been installed yet.</p>
                            <p className="mt-2 text-sm text-black bg-gray-100 p-2 border border-gray-300 rounded font-mono select-all">
                                Please run the "feature_library_config.sql" migration script in your Supabase SQL Editor.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Level</th>
                                            <th className="p-2 border border-gray-300">Upgrade Cost (Gold)</th>
                                            <th className="p-2 border border-gray-300">Passive XP / Min</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {levels.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.upgrade_cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'upgrade_cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="number"
                                                        value={lvl.xp_rate}
                                                        onChange={(e) => handleLevelChange(idx, 'xp_rate', e.target.value)}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === levels.length - 1 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-2 flex justify-between items-center">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-white border border-gray-400 text-xs font-bold hover:bg-gray-50 flex items-center gap-1 shadow-sm"
                                >
                                    ➕ Add Next Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Levels must be sequential.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-gray-600 p-3 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || (!hasChanges && !configMissing) || configMissing}
                        className={`px-6 py-2 border-2 font-bold flex items-center gap-2 ${hasChanges && !configMissing
                            ? 'bg-green-600 text-white border-green-800 hover:bg-green-700 active:border-green-800'
                            : 'bg-gray-400 text-gray-200 border-gray-500 cursor-not-allowed'
                            } border-white border-r-black border-b-black shadow-md active:shadow-none active:translate-y-[1px]`}
                    >
                        {saving ? 'Saving...' : '💾 Save Configuration'}
                    </button>
                    <button onClick={onClose} className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black font-bold active:translate-y-[1px]">Close</button>
                </div>
            </div>
        </div>
    );
}

function KingdomEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_kingdom_config');
            if (error) throw error;
            // Ensure levels array is sorted
            if (data && data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data || { levels: [] });
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching kingdom config:', err);
            // Fallback if table/function missing yet (soft fail)
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels && config.levels.length > 0
            ? config.levels[config.levels.length - 1]
            : { level: 0, cost: 0, citizens_per_minute: 0 };

        const newLevel = {
            level: lastLevel.level + 1,
            cost: Math.round((lastLevel.cost || 500) * 1.5),
            citizens_per_minute: (lastLevel.citizens_per_minute || 0) + 5
        };
        setConfig(prev => ({ ...prev, levels: [...(prev.levels || []), newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = config.levels.filter((_, i) => i !== index);
        // Optionally re-index purely for display or logic? 
        // For now, let's keep them as is or re-index level number
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i + 1 }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_kingdom_config', {
                p_levels: config.levels
            });

            if (error) throw error;
            console.log('Kingdom configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Helper for comma formatting
    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-[#502090] to-[#9040d0] text-white px-2 py-1 flex justify-between items-center">
                    <span className="font-bold">🏰 Kingdom Level Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                            <th className="p-2 border border-gray-300">Upgrade Cost (EXP)</th>
                                            <th className="p-2 border border-gray-300">Citizens / Minute</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config?.levels?.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-purple-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.citizens_per_minute)}
                                                        onChange={(e) => handleLevelChange(idx, 'citizens_per_minute', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.levels.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-2 flex justify-between items-center">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-white border border-gray-400 text-xs font-bold hover:bg-gray-50 flex items-center gap-1 shadow-sm"
                                >
                                    ➕ Add Next Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Levels must be sequential.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-gray-600 p-3 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-6 py-2 border-2 font-bold flex items-center gap-2 ${hasChanges
                            ? 'bg-green-600 text-white border-green-800 hover:bg-green-700 active:border-green-800'
                            : 'bg-gray-400 text-gray-200 border-gray-500 cursor-not-allowed'
                            } border-white border-r-black border-b-black shadow-md active:shadow-none active:translate-y-[1px]`}
                    >
                        {saving ? 'Saving...' : '💾 Save Configuration'}
                    </button>
                    <button onClick={onClose} className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black font-bold active:translate-y-[1px]">Close</button>
                </div>
            </div>
        </div>
    );
}

function GoldMineEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_gold_mine_config');
            if (error) throw error;
            // Ensure levels array is sorted
            if (data && data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data || { levels: [] });
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching gold mine config:', err);
            // Fallback if table/function missing yet (soft fail)
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels && config.levels.length > 0
            ? config.levels[config.levels.length - 1]
            : { level: -1, upgrade_cost: 0, production_rate: 0, training_cost: 0 };

        const newLevel = {
            level: lastLevel.level + 1,
            upgrade_cost: Math.round((lastLevel.upgrade_cost || 1000) * 1.5),
            production_rate: (lastLevel.production_rate || 1) + 1,
            training_cost: (lastLevel.training_cost || 1000) + 0
        };
        setConfig(prev => ({ ...prev, levels: [...(prev.levels || []), newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = config.levels.filter((_, i) => i !== index);
        // Re-index purely for display
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_gold_mine_config', {
                p_levels: config.levels
            });

            if (error) throw error;
            console.log('Gold Mine configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Helper for comma formatting
    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-[#b8860b] to-[#ffd700] text-black px-2 py-1 flex justify-between items-center border-b border-black">
                    <span className="font-bold">⛏️ Gold Mine Levels Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                            <th className="p-2 border border-gray-300">Next Upgrade Cost (Gold)</th>
                                            <th className="p-2 border border-gray-300">Gold / Miner / Min</th>
                                            <th className="p-2 border border-gray-300">Training Cost</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config?.levels?.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.upgrade_cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'upgrade_cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.production_rate)}
                                                        onChange={(e) => handleLevelChange(idx, 'production_rate', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.training_cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'training_cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.levels.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-2 flex justify-between items-center">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-white border border-gray-400 text-xs font-bold hover:bg-gray-50 flex items-center gap-1 shadow-sm"
                                >
                                    ➕ Add Next Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Levels must be sequential.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-gray-600 p-3 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-6 py-2 border-2 font-bold flex items-center gap-2 ${hasChanges
                            ? 'bg-green-600 text-white border-green-800 hover:bg-green-700 active:border-green-800'
                            : 'bg-gray-400 text-gray-200 border-gray-500 cursor-not-allowed'
                            } border-white border-r-black border-b-black shadow-md active:shadow-none active:translate-y-[1px]`}
                    >
                        {saving ? 'Saving...' : '💾 Save Configuration'}
                    </button>
                    <button onClick={onClose} className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black font-bold active:translate-y-[1px]">Close</button>
                </div>
            </div>
        </div>
    );
}

// ===========================
// Barracks Editor Modal
// ===========================
function BarracksEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeTab, setActiveTab] = useState('levels');

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase.rpc('get_barracks_config');
            if (error) throw error;
            if (data && data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data || { levels: [], training_costs: {} });
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching barracks config:', err);
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleTrainingCostChange = (unitType, value) => {
        setConfig(prev => ({
            ...prev,
            training_costs: {
                ...prev.training_costs,
                [unitType]: parseInt(value) || 0
            }
        }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels && config.levels.length > 0
            ? config.levels[config.levels.length - 1]
            : { level: 0, upgrade_cost: 0, stats_per_unit: 0 };

        const newLevel = {
            level: lastLevel.level + 1,
            upgrade_cost: Math.round((lastLevel.upgrade_cost || 1000) * 2.5),
            stats_per_unit: ((lastLevel.level + 1) * (lastLevel.level + 2)) / 2
        };
        setConfig(prev => ({ ...prev, levels: [...(prev.levels || []), newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = config.levels.filter((_, i) => i !== index);
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i + 1 }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_barracks_config', {
                p_levels: config.levels,
                p_training_costs: config.training_costs
            });

            if (error) throw error;
            console.log('Barracks configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-2 py-1 flex justify-between items-center border-b border-black">
                    <span className="font-bold">🗡️ Barracks Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b-2 border-gray-600 bg-[#c0c0c0]">
                    <button
                        onClick={() => setActiveTab('levels')}
                        className={`px-4 py-1 border-2 border-t-white border-l-white ${activeTab === 'levels'
                            ? 'bg-[#c0c0c0] border-r-gray-600 border-b-[#c0c0c0] -mb-[2px] z-10'
                            : 'bg-gray-400 border-r-gray-600 border-b-gray-600'
                            } font-bold text-sm`}
                    >
                        Barracks Levels
                    </button>
                    <button
                        onClick={() => setActiveTab('training')}
                        className={`px-4 py-1 border-2 border-t-white border-l-white ${activeTab === 'training'
                            ? 'bg-[#c0c0c0] border-r-gray-600 border-b-[#c0c0c0] -mb-[2px] z-10'
                            : 'bg-gray-400 border-r-gray-600 border-b-gray-600'
                            } font-bold text-sm`}
                    >
                        Training Costs
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <>
                            {activeTab === 'levels' && (
                                <div className="flex flex-col h-full">
                                    <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                        <table className="w-full text-xs border-collapse">
                                            <thead className="bg-gray-100 sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                                    <th className="p-2 border border-gray-300">Upgrade Cost (Gold)</th>
                                                    <th className="p-2 border border-gray-300">Stats Per Unit</th>
                                                    <th className="p-2 border border-gray-300 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {config?.levels?.map((lvl, idx) => (
                                                    <tr key={idx} className="hover:bg-yellow-50">
                                                        <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                            {lvl.level}
                                                        </td>
                                                        <td className="p-1 border border-gray-200">
                                                            <input
                                                                type="text"
                                                                value={formatNumber(lvl.upgrade_cost)}
                                                                onChange={(e) => handleLevelChange(idx, 'upgrade_cost', e.target.value.replace(/,/g, ''))}
                                                                className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                            />
                                                        </td>
                                                        <td className="p-1 border border-gray-200">
                                                            <input
                                                                type="text"
                                                                value={formatNumber(lvl.stats_per_unit)}
                                                                onChange={(e) => handleLevelChange(idx, 'stats_per_unit', e.target.value.replace(/,/g, ''))}
                                                                className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                            />
                                                        </td>
                                                        <td className="p-1 border border-gray-200 text-center">
                                                            {idx === config.levels.length - 1 && idx > 0 && (
                                                                <button
                                                                    onClick={() => handleRemoveLevel(idx)}
                                                                    className="text-red-500 hover:text-red-700 font-bold px-1"
                                                                    title="Remove Level"
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex justify-between items-center mt-2">
                                        <button
                                            onClick={handleAddLevel}
                                            className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-xs font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                                        >
                                            + Add Level
                                        </button>
                                        <span className="text-[10px] text-gray-500 italic">
                                            Levels must be sequential.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'training' && (
                                <div className="bg-white border-2 border-gray-400 p-4 h-full overflow-auto">
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'attack', name: 'Attack Soldier', icon: '⚔️' },
                                            { id: 'defense', name: 'Defense Soldier', icon: '🛡️' },
                                            { id: 'spy', name: 'Spy', icon: '🕵️' },
                                            { id: 'sentry', name: 'Sentry', icon: '👁️' }
                                        ].map(unit => (
                                            <fieldset key={unit.id} className="border-2 border-white border-l-gray-600 border-t-gray-600 p-3">
                                                <legend className="px-1 font-bold text-sm">{unit.icon} {unit.name}</legend>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <label className="text-xs font-bold">Cost:</label>
                                                    <input
                                                        type="text"
                                                        value={formatNumber(config?.training_costs?.[unit.id] || 0)}
                                                        onChange={(e) => handleTrainingCostChange(unit.id, e.target.value.replace(/,/g, ''))}
                                                        className="flex-1 px-2 py-1 border-2 border-gray-500 border-r-white border-b-white text-right font-mono text-sm focus:outline-none"
                                                    />
                                                    <span className="text-xs">Gold</span>
                                                </div>
                                            </fieldset>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="border-t-2 border-white p-2 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-1 border-2 text-sm font-bold ${hasChanges
                            ? 'bg-[#c0c0c0] border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white'
                            : 'bg-gray-400 border-gray-500 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-sm font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===========================
// Vault Stealing Editor Modal
// ===========================
function VaultStealingEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase.rpc('get_vault_stealing_config');
            if (error) throw error;
            if (data && data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data || { levels: [] });
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching vault stealing config:', err);
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels && config.levels.length > 0
            ? config.levels[config.levels.length - 1]
            : { level: 0, cost: 0, steal_percent: 0 };

        const newLevel = {
            level: lastLevel.level + 1,
            cost: (lastLevel.cost || 5000) + 5000,
            steal_percent: (lastLevel.steal_percent || 0) + 5
        };
        setConfig(prev => ({ ...prev, levels: [...(prev.levels || []), newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = config.levels.filter((_, i) => i !== index);
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i + 1 }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_vault_stealing_config', {
                p_levels: config.levels
            });

            if (error) throw error;
            console.log('Vault stealing configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-purple-700 to-purple-500 text-white px-2 py-1 flex justify-between items-center border-b border-black">
                    <span className="font-bold">🔐 Vault Stealing Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                            <th className="p-2 border border-gray-300">Cost (XP)</th>
                                            <th className="p-2 border border-gray-300">Steal %</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config?.levels?.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.steal_percent)}
                                                        onChange={(e) => handleLevelChange(idx, 'steal_percent', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.levels.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-xs font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                                >
                                    + Add Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Configure XP costs and vault steal percentages per research level.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-white p-2 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-1 border-2 text-sm font-bold ${hasChanges
                            ? 'bg-[#c0c0c0] border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white'
                            : 'bg-gray-400 border-gray-500 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-sm font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===========================
// Vault Editor Modal
// ===========================
function VaultEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase.rpc('get_vault_config');
            if (error) throw error;
            if (data && data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data || { levels: [] });
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching vault config:', err);
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels && config.levels.length > 0
            ? config.levels[config.levels.length - 1]
            : { level: 0, upgrade_cost: 0, capacity: 0, interest_rate: 0 };

        const newLevel = {
            level: lastLevel.level + 1,
            upgrade_cost: (lastLevel.upgrade_cost || 5000) * 2,
            capacity: (lastLevel.capacity || 200000) * 3,
            interest_rate: Math.min((lastLevel.interest_rate || 0) + 5, 50)
        };
        setConfig(prev => ({ ...prev, levels: [...(prev.levels || []), newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = config.levels.filter((_, i) => i !== index);
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i + 1 }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_vault_config', {
                p_levels: config.levels
            });

            if (error) throw error;
            console.log('Vault configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-2 py-1 flex justify-between items-center border-b border-black">
                    <span className="font-bold">🏦 Vault Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                            <th className="p-2 border border-gray-300">Upgrade Cost (Gold)</th>
                                            <th className="p-2 border border-gray-300">Capacity (Gold)</th>
                                            <th className="p-2 border border-gray-300">Interest Rate (%)</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config?.levels?.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.upgrade_cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'upgrade_cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.capacity)}
                                                        onChange={(e) => handleLevelChange(idx, 'capacity', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.interest_rate)}
                                                        onChange={(e) => handleLevelChange(idx, 'interest_rate', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.levels.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-xs font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                                >
                                    + Add Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Configure upgrade costs, capacity, and interest rates per vault level.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-white p-2 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-1 border-2 text-sm font-bold ${hasChanges
                            ? 'bg-[#c0c0c0] border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white'
                            : 'bg-gray-400 border-gray-500 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-sm font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===========================
// Gold Steal (Increase Stolen %) Editor Modal
// ===========================
// ===========================
// Tech Stats Editor Modal
// ===========================
function TechStatsEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase.rpc('get_tech_stats_config');
            if (error) throw error;
            if (data && data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data || { levels: [] });
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching tech stats config:', err);
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        if (field === 'multiplier') {
            newLevels[index] = { ...newLevels[index], [field]: parseFloat(value) || 0 };
        } else {
            newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        }
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels && config.levels.length > 0
            ? config.levels[config.levels.length - 1]
            : { level: 0, cost: 0, multiplier: 1.0, bonus_percent: 0 };

        const newLevel = {
            level: lastLevel.level + 1,
            cost: Math.floor((lastLevel.cost || 300) * 1.13),
            multiplier: parseFloat(((lastLevel.multiplier || 1.0) + 0.1).toFixed(2)),
            bonus_percent: (lastLevel.bonus_percent || 0) + 5
        };
        setConfig(prev => ({ ...prev, levels: [...(prev.levels || []), newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = config.levels.filter((_, i) => i !== index);
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i + 1 }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_tech_stats_config', {
                p_levels: config.levels
            });

            if (error) throw error;
            console.log('Tech stats configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-red-700 to-red-500 text-white px-2 py-1 flex justify-between items-center border-b border-black">
                    <span className="font-bold">⚔️ Tech Stats Configuration (Attack/Defense/Spy/Sentry)</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-yellow-100 border-2 border-yellow-600 p-2 mb-2 text-xs">
                                <strong>⚠️ Note:</strong> All four technologies (Attack, Defense, Spy, Sentry) share the same progression.
                                Changes here affect all four equally.
                            </div>
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                            <th className="p-2 border border-gray-300">Cost (XP)</th>
                                            <th className="p-2 border border-gray-300">Multiplier</th>
                                            <th className="p-2 border border-gray-300">Bonus %</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config?.levels?.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={lvl.multiplier}
                                                        onChange={(e) => handleLevelChange(idx, 'multiplier', e.target.value)}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.bonus_percent)}
                                                        onChange={(e) => handleLevelChange(idx, 'bonus_percent', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.levels.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-xs font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                                >
                                    + Add Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Configure XP costs, multipliers, and bonus percentages for all tech stats.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-white p-2 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-1 border-2 text-sm font-bold ${hasChanges
                            ? 'bg-[#c0c0c0] border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white'
                            : 'bg-gray-400 border-gray-500 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-sm font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===========================
// Turns Research Editor Modal
// ===========================
function TurnsResearchEditorModal({ onClose }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase.rpc('get_turns_research_config');
            if (error) throw error;
            if (data && data.levels) {
                data.levels.sort((a, b) => a.level - b.level);
            }
            setConfig(data || { levels: [] });
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching turns research config:', err);
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...config.levels];
        newLevels[index] = { ...newLevels[index], [field]: parseInt(value) || 0 };
        setConfig(prev => ({ ...prev, levels: newLevels }));
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.levels && config.levels.length > 0
            ? config.levels[config.levels.length - 1]
            : { level: 0, cost: 0, turns_per_min: 0 };

        const newLevel = {
            level: lastLevel.level + 1,
            cost: Math.floor((lastLevel.cost || 1000) * 5),
            turns_per_min: (lastLevel.turns_per_min || 0) + Math.ceil((lastLevel.turns_per_min || 1) * 0.5)
        };
        setConfig(prev => ({ ...prev, levels: [...(prev.levels || []), newLevel] }));
        setHasChanges(true);
    };

    const handleRemoveLevel = (index) => {
        const newLevels = config.levels.filter((_, i) => i !== index);
        const reindexed = newLevels.map((lvl, i) => ({ ...lvl, level: i + 1 }));
        setConfig(prev => ({ ...prev, levels: reindexed }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('update_turns_research_config', {
                p_levels: config.levels
            });

            if (error) throw error;
            console.log('Turns research configuration updated successfully!');
            setHasChanges(false);
            onClose();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-green-700 to-green-500 text-white px-2 py-1 flex justify-between items-center border-b border-black">
                    <span className="font-bold">⏱️ Turns Per Minute Research Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Lvl</th>
                                            <th className="p-2 border border-gray-300">Cost (XP)</th>
                                            <th className="p-2 border border-gray-300">Turns / Minute</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config?.levels?.map((lvl, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {lvl.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(lvl.turns_per_min)}
                                                        onChange={(e) => handleLevelChange(idx, 'turns_per_min', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.levels.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-xs font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                                >
                                    + Add Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Configure XP costs and turn generation rates per research level.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-white p-2 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-1 border-2 text-sm font-bold ${hasChanges
                            ? 'bg-[#c0c0c0] border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white'
                            : 'bg-gray-400 border-gray-500 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-sm font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}


function ArmouryEditorModal({ onClose }) {
    const [weapons, setWeapons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [configMissing, setConfigMissing] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_weapon_configs');
            if (error) throw error;
            // Sort by type then tier
            const sorted = (data || []).sort((a, b) => {
                if (a.weapon_type === b.weapon_type) {
                    return a.tier - b.tier;
                }
                return a.weapon_type.localeCompare(b.weapon_type);
            });
            setWeapons(sorted);
            setHasChanges(false);
            setConfigMissing(false);
        } catch (err) {
            console.error('Error fetching weapon config:', err);
            // Default fallback if table missing (so UI works for checking at least)
            if (err.message.includes('function get_weapon_configs') || err.message.includes('Could not find the function')) {
                setConfigMissing(true);
            } else {
                alert('Failed to load weapon config: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (id, field, value) => {
        setWeapons(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
        setHasChanges(true);
    };

    const handleSaveAll = async () => {
        if (!window.confirm('Are you sure you want to save ALL changes? This will immediately affect the game.')) return;

        try {
            setSaving(true);

            // Execute all updates in parallel
            const updates = weapons.map(w =>
                supabase.rpc('update_weapon_config', {
                    p_id: w.id,
                    p_name: w.name,
                    p_cost: parseInt(w.cost) || 0,
                    p_strength: parseInt(w.strength) || 0
                })
            );

            const results = await Promise.all(updates);
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.error('Some updates failed:', errors);
                throw new Error(`${errors.length} updates failed. Check console.`);
            }

            alert('All weapons updated successfully!');
            setHasChanges(false);
            fetchConfig();

        } catch (err) {
            console.error('Error saving weapons:', err);
            alert('Failed to save changes: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const inputClass = "w-full bg-transparent border-0 border-b border-dashed border-gray-300 px-1 py-1 text-right focus:bg-white focus:border-solid focus:border-blue-500 outline-none hover:bg-white/50 transition-colors font-mono";
    const nameInputClass = "w-full bg-transparent border-0 border-b border-dashed border-gray-300 px-1 py-1 text-left focus:bg-white focus:border-solid focus:border-blue-500 outline-none hover:bg-white/50 transition-colors";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Title Bar */}
                <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] text-white px-2 py-1 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="font-bold">⚔️ Armoury Configuration Editor</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300 active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-gray-700">Loading weapons...</div>
                        </div>
                    ) : configMissing ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4 text-red-600">
                            <div className="text-4xl">⚠️</div>
                            <div className="font-bold">Database Configuration Missing</div>
                            <p className="text-sm text-black max-w-md text-center">
                                The `game_weapon_configs` table or RPC functions are missing using the SQL script provided.
                            </p>
                            <p className="text-xs font-mono bg-white p-2 border border-gray-400">
                                Please run `configure_weapons_table.sql` in the Supabase SQL Editor.
                            </p>
                        </div>
                    ) : weapons.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 italic">No weapons found config table.</div>
                    ) : (
                        <div className="bg-white border-2 border-gray-600 border-r-white border-b-white">
                            <table className="w-full text-xs border-collapse">
                                <thead className="sticky top-0 bg-gray-200 border-b-2 border-gray-600 shadow-sm z-10">
                                    <tr>
                                        <th className="p-2 border-r border-gray-400 text-left w-20">Type</th>
                                        <th className="p-2 border-r border-gray-400 text-center w-10">Tier</th>
                                        <th className="p-2 border-r border-gray-400 text-left w-40">Name</th>
                                        <th className="p-2 border-r border-gray-400 text-right w-32">Cost (Gold)</th>
                                        <th className="p-2 border-r border-gray-400 text-right w-32">Power (Stats)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {weapons.map((weapon, idx) => (
                                        <tr key={weapon.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                            <td className="p-2 border-r border-gray-300 font-bold text-gray-600 uppercase text-[10px]">{weapon.weapon_type}</td>
                                            <td className="p-2 border-r border-gray-300 text-center font-bold text-gray-500">{weapon.tier}</td>
                                            <td className="p-1 border-r border-gray-300">
                                                <input
                                                    type="text"
                                                    value={weapon.name}
                                                    onChange={e => handleChange(weapon.id, 'name', e.target.value)}
                                                    className={nameInputClass}
                                                />
                                            </td>
                                            <td className="p-1 border-r border-gray-300">
                                                <input
                                                    type="number"
                                                    value={weapon.cost}
                                                    onChange={e => handleChange(weapon.id, 'cost', e.target.value)}
                                                    className={inputClass}
                                                />
                                            </td>
                                            <td className="p-1 border-r border-gray-300">
                                                <input
                                                    type="number"
                                                    value={weapon.strength}
                                                    onChange={e => handleChange(weapon.id, 'strength', e.target.value)}
                                                    className={inputClass}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t-2 border-gray-600 p-3 bg-[#c0c0c0] flex justify-between items-center">
                    <div className="text-xs text-gray-600 italic">
                        {hasChanges ? 'Changes detected - don\'t forget to save!' : 'No unsaved changes.'}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveAll}
                            disabled={saving || !hasChanges}
                            className={`px-6 py-2 border-2 font-bold flex items-center gap-2 ${hasChanges
                                ? 'bg-green-600 text-white border-green-800 hover:bg-green-700 active:border-green-800'
                                : 'bg-gray-400 text-gray-200 border-gray-500 cursor-not-allowed'
                                } border-white border-r-black border-b-black shadow-md active:shadow-none active:translate-y-[1px]`}
                        >
                            {saving ? 'Saving...' : '💾 Save All Changes'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black font-bold active:border-black active:border-r-white active:border-b-white active:translate-y-[1px]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GoldStealEditorModal({ onClose }) {
    const [config, setConfig] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_gold_steal_configs');
            if (error) throw error;
            // Ensure sorted by level
            const sorted = (data || []).sort((a, b) => a.level - b.level);
            setConfig(sorted);
            setHasChanges(false);
        } catch (err) {
            console.error('Error fetching gold steal config:', err);
            alert('Failed to load config: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = (index, field, value) => {
        const newConfig = [...config];
        // Handle numeric parsing
        let parsedValue = value;
        if (field === 'cost') parsedValue = parseInt(value) || 0;
        if (field === 'steal_percent') parsedValue = parseFloat(value) || 0;

        newConfig[index] = { ...newConfig[index], [field]: parsedValue };
        setConfig(newConfig);
        setHasChanges(true);
    };

    const handleAddLevel = () => {
        const lastLevel = config.length > 0 ? config[config.length - 1] : { level: -1, cost: 0, steal_percent: 0.5 };
        const newLevel = {
            level: lastLevel.level + 1,
            cost: (lastLevel.cost || 5000) + 5000,
            steal_percent: parseFloat(((lastLevel.steal_percent || 0.5) + 0.05).toFixed(2))
        };
        setConfig([...config, newLevel]);
        setHasChanges(true);
    };

    const handleRemoveLevel = async (index) => {
        // If it's a new level (not in DB yet), just remove from state
        // But since we sync fully on save, we might want to track deletions or just rebuild.
        // For simplicity, we'll mark as deleted in UI and process in save, OR just support removing the last one.

        // Better approach: Just remove from local state.
        // However, we need to know if we need to call delete RPC.
        // Let's assume on 'Save' we sync the whole state.
        // But our RPC `update_gold_steal_config` is per row.
        // And we made a `delete_gold_steal_config`.

        // Let's require deleting from the END to keep levels sequential/sane
        if (index !== config.length - 1) {
            alert("Please remove levels from the bottom up to maintain sequential order.");
            return;
        }

        const levelToRemove = config[index];
        if (window.confirm(`Remove Level ${levelToRemove.level}?`)) {
            // If we want to delete immediately or wait for save?
            // Let's wait for save to be consistent with "Save Changes" button.
            // BUT, `update_gold_steal_config` doesn't handle deletes.
            // So we should probably delete immediately RPC or handle it in handleSave logic.

            // Simplest: Delete immediately RPC if it exists in DB.
            // How do we know config matches DB? We fetched it.

            try {
                // Determine if we should call DB delete (if it was previously saved)
                // For now, let's just do it live for delete, it's safer.
                const { error } = await supabase.rpc('delete_gold_steal_config', { p_level: levelToRemove.level });
                if (error) throw error;

                // Update local state
                setConfig(prev => prev.filter((_, i) => i !== index));
            } catch (err) {
                console.error('Error deleting level:', err);
                alert('Failed to delete level: ' + err.message);
            }
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Validate sequential levels
            for (let i = 0; i < config.length; i++) {
                if (config[i].level !== i) {
                    throw new Error(`Levels must be sequential starting from 0. Found Level ${config[i].level} at index ${i}.`);
                }
            }

            // Sync all rows
            const updates = config.map(row =>
                supabase.rpc('update_gold_steal_config', {
                    p_level: row.level,
                    p_cost: row.cost,
                    p_steal_percent: row.steal_percent
                })
            );

            await Promise.all(updates);

            alert('Configuration saved successfully!');
            setHasChanges(false);
            fetchConfig();
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num) => num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="bg-gradient-to-r from-yellow-700 to-yellow-500 text-white px-2 py-1 flex justify-between items-center border-b border-black">
                    <span className="font-bold">💰 Gold Steal % Configuration</span>
                    <button onClick={onClose} className="bg-[#c0c0c0] text-black px-2 border-2 border-white border-r-gray-600 border-b-gray-600 font-bold hover:bg-gray-300">✕</button>
                </div>

                <div className="p-4 flex-1 overflow-auto bg-[#c0c0c0]">
                    {loading ? (
                        <div className="text-center p-8">Loading configuration...</div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="bg-white border-2 border-gray-400 p-1 overflow-auto flex-1">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 border border-gray-300 w-16">Level</th>
                                            <th className="p-2 border border-gray-300">Cost (XP)</th>
                                            <th className="p-2 border border-gray-300">Steal % (0.5 = 50%)</th>
                                            <th className="p-2 border border-gray-300 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-50">
                                                <td className="p-1 border border-gray-200 text-center font-bold text-gray-500">
                                                    {row.level}
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(row.cost)}
                                                        onChange={(e) => handleLevelChange(idx, 'cost', e.target.value.replace(/,/g, ''))}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={row.steal_percent}
                                                        onChange={(e) => handleLevelChange(idx, 'steal_percent', e.target.value)}
                                                        className="w-full text-right outline-none bg-transparent focus:bg-white px-1 font-mono"
                                                    />
                                                </td>
                                                <td className="p-1 border border-gray-200 text-center">
                                                    {idx === config.length - 1 && idx > 0 && (
                                                        <button
                                                            onClick={() => handleRemoveLevel(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                                            title="Remove Level"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={handleAddLevel}
                                    className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-xs font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                                >
                                    + Add Level
                                </button>
                                <span className="text-[10px] text-gray-500 italic">
                                    Base 50% = 0.50. Max should differ by level.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-white p-2 bg-[#c0c0c0] flex justify-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-1 border-2 text-sm font-bold ${hasChanges
                            ? 'bg-[#c0c0c0] border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white'
                            : 'bg-gray-400 border-gray-500 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 text-sm font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
