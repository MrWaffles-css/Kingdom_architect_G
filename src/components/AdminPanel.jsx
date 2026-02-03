import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import AdminMailPanel from './AdminMailPanel';

export default function AdminPanel({ onClose, onWorldReset, onUserUpdate }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [activeTab, setActiveTab] = useState('users'); // 'users', 'mail', 'mechanics'

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
            alert('Failed to update user: ' + err.message);
        }
    };

    const handleResetWorld = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('reset_world');

            if (error) throw error;
            alert('World has been reset successfully. All stats, armies, reports, and messages have been wiped.');
            if (onWorldReset) onWorldReset();
            fetchUsers();
        } catch (err) {
            console.error('Error resetting world:', err);
            alert('Failed to reset world: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleScheduleSeason = async (date) => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('set_season_end_time', { p_end_time: date });
            if (error) throw error;
            alert('Season end time updated successfully!');
        } catch (err) {
            console.error('Error scheduling season:', err);
            alert('Failed to schedule season: ' + err.message);
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
                    <button
                        onClick={() => { if (window.confirm('ARE YOU SURE? This will reset ALL progress for ALL players. This cannot be undone.')) handleResetWorld(); }}
                        className="px-4 py-1 bg-red-800 text-white font-bold border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs"
                    >
                        ⚠ RESET WORLD
                    </button>
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
                        <AdminSeasonPanel onSchedule={handleScheduleSeason} />
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

function AdminSeasonPanel({ onSchedule }) {
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
            </div>
        </fieldset>
    );
}

function AdminMechanicsPanel() {
    const [mechanics, setMechanics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBossEditor, setShowBossEditor] = useState(false);

    useEffect(() => {
        fetchMechanics();
    }, []);

    const fetchMechanics = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_all_mechanics');
            if (error) throw error;
            setMechanics(data || []);
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
            'spy_reports': '🕵️'
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
        <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-4 h-full overflow-auto">
            <legend className="font-bold px-1 text-sm">Game Mechanics</legend>

            <div className="space-y-4">
                <div className="bg-blue-50 p-3 border border-blue-300">
                    <p className="text-sm text-blue-900">
                        <strong>⚙️ Toggle Game Features:</strong> Enable or disable specific game mechanics.
                        Disabled mechanics will be hidden from players and their functionality will be blocked.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mechanics.map(mechanic => (
                        <div
                            key={mechanic.key}
                            className={`p-4 border-2 transition-colors ${mechanic.enabled
                                ? 'bg-green-50 border-green-500'
                                : 'bg-red-50 border-red-500'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-2xl">{getMechanicIcon(mechanic.key)}</span>
                                        <h3 className="font-bold text-lg">
                                            {getMechanicName(mechanic.key)}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-2">
                                        {mechanic.description}
                                    </p>
                                    <div className="text-xs text-gray-500">
                                        Last updated: {mechanic.updated_at
                                            ? new Date(mechanic.updated_at).toLocaleString()
                                            : 'Never'}
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-2">
                                    <div className={`text-xs font-bold uppercase px-2 py-1 rounded ${mechanic.enabled
                                        ? 'bg-green-600 text-white'
                                        : 'bg-red-600 text-white'
                                        }`}>
                                        {mechanic.enabled ? 'ENABLED' : 'DISABLED'}
                                    </div>

                                    {mechanic.key === 'boss_fights' && (
                                        <button
                                            onClick={() => setShowBossEditor(true)}
                                            className="px-4 py-2 border-2 font-bold text-sm shadow active:translate-y-[1px] bg-blue-600 text-white border-blue-800 hover:bg-blue-700"
                                        >
                                            ⚙️ Configure
                                        </button>
                                    )}

                                    <button
                                        onClick={() => toggleMechanic(mechanic.key, mechanic.enabled)}
                                        className={`px-4 py-2 border-2 font-bold text-sm shadow active:translate-y-[1px] ${mechanic.enabled
                                            ? 'bg-red-600 text-white border-red-800 hover:bg-red-700'
                                            : 'bg-green-600 text-white border-green-800 hover:bg-green-700'
                                            }`}
                                    >
                                        {mechanic.enabled ? 'Disable' : 'Enable'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {mechanics.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        No mechanics configured
                    </div>
                )}
            </div>

            {/* Boss Editor Modal */}
            {showBossEditor && (
                <BossEditorModal onClose={() => setShowBossEditor(false)} />
            )}
        </fieldset>
    );
}

function BossEditorModal({ onClose }) {
    const [bosses, setBosses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingBoss, setEditingBoss] = useState(null);

    useEffect(() => {
        fetchBosses();
    }, []);

    const fetchBosses = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_boss_configs');
            if (error) throw error;
            setBosses(data || []);
        } catch (err) {
            console.error('Error fetching bosses:', err);
            alert('Failed to load bosses: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (boss) => {
        try {
            setSaving(true);
            const { data, error } = await supabase.rpc('update_boss_config', {
                p_id: boss.id,
                p_name: boss.name,
                p_req_total_stats: parseInt(boss.req_total_stats),
                p_cost_turns: parseInt(boss.cost_turns),
                p_duration_seconds: parseInt(boss.duration_seconds),
                p_reward_xp: parseInt(boss.reward_xp),
                p_reward_gold: parseInt(boss.reward_gold),
                p_reward_citizens: parseInt(boss.reward_citizens)
            });

            if (error) throw error;
            if (data && !data.success) {
                alert(data.message || 'Failed to update boss');
                return;
            }

            alert('Boss updated successfully! Changes are now live.');
            setEditingBoss(null);
            fetchBosses();
        } catch (err) {
            console.error('Error updating boss:', err);
            alert('Failed to update boss: ' + err.message);
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
                        <span className="font-bold">👹 Boss Configuration Editor</span>
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
                                <thead className="sticky top-0 bg-gray-200 border-b-2 border-gray-600">
                                    <tr>
                                        <th className="p-2 border-r border-gray-400 text-left">ID</th>
                                        <th className="p-2 border-r border-gray-400 text-left">Name</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Required Stats</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Turn Cost</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Duration (s)</th>
                                        <th className="p-2 border-r border-gray-400 text-right">XP Reward</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Gold Reward</th>
                                        <th className="p-2 border-r border-gray-400 text-right">Citizens Reward</th>
                                        <th className="p-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bosses.map(boss => (
                                        <BossRow
                                            key={boss.id}
                                            boss={boss}
                                            isEditing={editingBoss === boss.id}
                                            onEdit={() => setEditingBoss(boss.id)}
                                            onCancel={() => setEditingBoss(null)}
                                            onSave={handleSave}
                                            saving={saving}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-xs">
                        <p className="font-bold mb-1">⚠️ Important Notes:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Changes take effect <strong>immediately</strong> for all players</li>
                            <li>Active boss fights will use the old values until completed</li>
                            <li>Duration is in seconds (e.g., 60 = 1 minute)</li>
                            <li>Required Stats = Total of Attack + Defense + Spy + Sentry needed to unlock</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t-2 border-gray-600 p-3 bg-[#c0c0c0] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 font-bold active:border-gray-600 active:border-r-white active:border-b-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function BossRow({ boss, isEditing, onEdit, onCancel, onSave, saving }) {
    const [formData, setFormData] = useState({
        id: boss.id,
        name: boss.name,
        req_total_stats: boss.req_total_stats,
        cost_turns: boss.cost_turns,
        duration_seconds: boss.duration_seconds,
        reward_xp: boss.reward_xp,
        reward_gold: boss.reward_gold,
        reward_citizens: boss.reward_citizens
    });

    const inputClass = "w-full bg-white border border-gray-400 px-1 py-0.5 text-right";
    const nameInputClass = "w-full bg-white border border-gray-400 px-1 py-0.5";

    if (!isEditing) {
        return (
            <tr className="hover:bg-blue-50 border-b border-gray-300">
                <td className="p-2 border-r border-gray-300 font-bold">{boss.id}</td>
                <td className="p-2 border-r border-gray-300 font-semibold">{boss.name}</td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">{boss.req_total_stats.toLocaleString()}</td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">{boss.cost_turns}</td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">{boss.duration_seconds}</td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">{boss.reward_xp.toLocaleString()}</td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">{boss.reward_gold.toLocaleString()}</td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">{boss.reward_citizens.toLocaleString()}</td>
                <td className="p-2 text-center">
                    <button
                        onClick={onEdit}
                        className="text-[10px] px-2 py-1 bg-blue-600 text-white border border-blue-800 font-bold hover:bg-blue-700"
                    >
                        Edit
                    </button>
                </td>
            </tr>
        );
    }

    return (
        <tr className="bg-yellow-50 border-b border-gray-300">
            <td className="p-2 border-r border-gray-300 font-bold">{boss.id}</td>
            <td className="p-2 border-r border-gray-300">
                <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={nameInputClass}
                />
            </td>
            <td className="p-2 border-r border-gray-300">
                <input
                    type="number"
                    value={formData.req_total_stats}
                    onChange={e => setFormData({ ...formData, req_total_stats: e.target.value })}
                    className={inputClass}
                />
            </td>
            <td className="p-2 border-r border-gray-300">
                <input
                    type="number"
                    value={formData.cost_turns}
                    onChange={e => setFormData({ ...formData, cost_turns: e.target.value })}
                    className={inputClass}
                />
            </td>
            <td className="p-2 border-r border-gray-300">
                <input
                    type="number"
                    value={formData.duration_seconds}
                    onChange={e => setFormData({ ...formData, duration_seconds: e.target.value })}
                    className={inputClass}
                />
            </td>
            <td className="p-2 border-r border-gray-300">
                <input
                    type="number"
                    value={formData.reward_xp}
                    onChange={e => setFormData({ ...formData, reward_xp: e.target.value })}
                    className={inputClass}
                />
            </td>
            <td className="p-2 border-r border-gray-300">
                <input
                    type="number"
                    value={formData.reward_gold}
                    onChange={e => setFormData({ ...formData, reward_gold: e.target.value })}
                    className={inputClass}
                />
            </td>
            <td className="p-2 border-r border-gray-300">
                <input
                    type="number"
                    value={formData.reward_citizens}
                    onChange={e => setFormData({ ...formData, reward_citizens: e.target.value })}
                    className={inputClass}
                />
            </td>
            <td className="p-2 text-center">
                <div className="flex gap-1 justify-center">
                    <button
                        onClick={() => onSave(formData)}
                        disabled={saving}
                        className="text-[10px] px-2 py-1 bg-green-600 text-white border border-green-800 font-bold hover:bg-green-700 disabled:opacity-50"
                    >
                        {saving ? '...' : 'Save'}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={saving}
                        className="text-[10px] px-2 py-1 bg-red-600 text-white border border-red-800 font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
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
            alert('Failed to update maintenance mode: ' + err.message);
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
