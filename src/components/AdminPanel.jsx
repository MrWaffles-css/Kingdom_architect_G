import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import AdminMailPanel from './AdminMailPanel';

export default function AdminPanel({ onClose, onWorldReset, onUserUpdate }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [activeTab, setActiveTab] = useState('users'); // 'users', 'mail'

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
                    activeTab === 'settings' && (
                        <AdminSettingsPanel />
                    )
                }
            </div>
        </div>
    );
}

function AdminSeasonPanel({ onSchedule }) {
    const [scheduledDate, setScheduledDate] = useState('');
    const [currentSchedule, setCurrentSchedule] = useState(null);
    const [seasonNumber, setSeasonNumber] = useState('');
    const [archiving, setArchiving] = useState(false);

    useEffect(() => {
        fetchSchedule();
    }, []);

    const fetchSchedule = async () => {
        const { data, error } = await supabase.rpc('get_season_end_time');
        if (!error && data) {
            setCurrentSchedule(new Date(data));
        }
    };

    const handleSchedule = () => {
        if (!scheduledDate) return;
        const date = new Date(scheduledDate);
        if (isNaN(date.getTime())) {
            alert('Invalid date');
            return;
        }
        onSchedule(date.toISOString());
        setCurrentSchedule(date);
    };

    const handleArchive = async () => {
        if (!seasonNumber) return alert('Please enter a season number');
        if (!window.confirm(`Are you sure you want to archive the current rankings as Season ${seasonNumber}?`)) return;

        setArchiving(true);
        try {
            const { data, error } = await supabase.rpc('archive_hall_of_fame', { p_season_number: parseInt(seasonNumber) });
            if (error) throw error;
            alert('Successfully archived Season ' + seasonNumber);
            setSeasonNumber('');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setArchiving(false);
        }
    };

    return (
        <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-4 h-full">
            <legend className="font-bold px-1 text-sm">Season Scheduling</legend>

            <div className="space-y-6">
                <div className="bg-white p-4 border border-gray-400">
                    <h3 className="font-bold mb-2">Current End of Era:</h3>
                    <p className="text-xl font-mono text-blue-800">
                        {currentSchedule && new Date() < currentSchedule
                            ? currentSchedule.toLocaleString()
                            : 'No active era timer'}
                    </p>
                </div>

                <div className="bg-gray-200 p-4 border border-gray-400">
                    <h3 className="font-bold mb-2">Schedule New End Date:</h3>
                    <div className="flex gap-2 items-center">
                        <input
                            type="datetime-local"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="border border-gray-400 p-1"
                        />
                        <button
                            onClick={handleSchedule}
                            className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white font-bold text-sm"
                        >
                            Set Schedule
                        </button>
                    </div>
                </div>

                {/* Archive Hall of Fame */}
                <div className="bg-yellow-100 p-4 border border-gray-400 mt-4">
                    <h3 className="font-bold mb-2">Archive Current Rankings to Hall of Fame:</h3>
                    <p className="text-sm mb-2 text-gray-700">This will take a snapshot of the current leaderboard and save it permanently as a Hall of Fame entry.</p>
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            placeholder="Season #"
                            value={seasonNumber}
                            onChange={(e) => setSeasonNumber(e.target.value)}
                            className="border border-gray-400 p-1 w-24"
                        />
                        <button
                            onClick={handleArchive}
                            disabled={archiving}
                            className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 font-bold text-sm active:translate-y-[1px]"
                        >
                            {archiving ? 'Archiving...' : 'Archive Standings'}
                        </button>
                    </div>
                </div>
            </div>
        </fieldset>
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
            alert(`Maintenance mode turned ${newValue ? 'ON' : 'OFF'}`);
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

                {/* Next Season Scheduler */}
                <div className="bg-gray-200 p-4 border border-gray-400">
                    <h3 className="font-bold mb-2">Schedule Next Season Start:</h3>
                    <NextSeasonScheduler />
                </div>
            </div>
        </fieldset>
    );
}


function NextSeasonScheduler() {
    const [date, setDate] = useState('');
    const [savedDate, setSavedDate] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchNextStart();
    }, []);

    const fetchNextStart = async () => {
        // Fetch specific setting key for next season start
        const { data, error } = await supabase
            .from('game_settings')
            .select('value')
            .eq('key', 'next_season_start')
            .single();

        if (!error && data && data.value) {
            setSavedDate(new Date(data.value.start_time));
        }
    };

    const handleSave = async () => {
        if (!date) return;
        setLoading(true);
        try {
            const dateObj = new Date(date);
            const { error } = await supabase
                .from('game_settings')
                .upsert({
                    key: 'next_season_start',
                    value: { start_time: dateObj.toISOString() },
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            setSavedDate(dateObj);
            alert('Next season start time scheduled!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="text-sm mb-2">
                {savedDate
                    ? <span className="text-blue-800 font-bold">Planned Start: {savedDate.toLocaleString()}</span>
                    : <span className="text-gray-500 italic">No start time scheduled.</span>
                }
            </div>
            <div className="flex gap-2">
                <input
                    type="datetime-local"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="border border-gray-400 p-1 flex-1"
                />
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 font-bold text-sm active:translate-y-[1px]"
                >
                    Set Time
                </button>
            </div>
        </div>
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

    const inputClass = "w-full bg-white border border-gray-400 px-1 outline-none text-right";

    if (!isEditing) {
        return (
            <tr className="hover:bg-blue-100 group">
                <td className="p-2 border-b border-gray-200 border-r">
                    <div className="font-bold">{user.username}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{user.email}</div>
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
