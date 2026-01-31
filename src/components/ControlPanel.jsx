import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { desktopFeatures } from '../config/desktopFeatures';

export default function ControlPanel({ userStats, onUpdate, onClose }) {
    const [activeTab, setActiveTab] = useState('general'); // general, security, controls
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    // General Form
    const [username, setUsername] = useState('');

    // Security Form
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Controls Form
    const [hotkeys, setHotkeys] = useState({});
    const [recordingKey, setRecordingKey] = useState(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('username, hotkeys')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            setUsername(data.username || '');
            setHotkeys(data.hotkeys || {});
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    const handleUpdateUsername = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('profiles')
                .update({ username })
                .eq('id', user.id);

            if (error) throw error;

            setMessage('Username updated successfully!');
            if (onUpdate) onUpdate({ username }); // Optimistic update if needed up chain
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setMessage('Password updated successfully!');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveHotkeys = async () => {
        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('profiles')
                .update({ hotkeys })
                .eq('id', user.id);

            if (error) throw error;

            setMessage('Hotkeys saved! Changes apply immediately.');
            // Trigger a re-fetch or context update in Desktop if possible?
            // For now, Desktop might need to poll or user refreshes page.
            // Ideally, we emit an event or call a prop function that re-fetches hotkeys in Desktop.
            if (onUpdate) onUpdate({ hotkeys });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const recordHotkey = (featureId) => {
        setRecordingKey(featureId);
    };

    const handleKeyDown = (e) => {
        if (!recordingKey) return;
        e.preventDefault();
        e.stopPropagation();

        const key = e.key.toLowerCase();

        // Block restricted keys
        if (['escape', 'enter', 'tab', ' ', 'backspace'].includes(key)) {
            setRecordingKey(null); // Cancel
            return;
        }

        setHotkeys(prev => ({
            ...prev,
            [recordingKey]: key
        }));
        setRecordingKey(null);
    };

    const clearHotkey = (featureId) => {
        setHotkeys(prev => {
            const next = { ...prev };
            delete next[featureId];
            return next;
        });
    };

    // Filter features that make sense to have hotkeys (windows)
    const mappableFeatures = desktopFeatures.filter(f => !f.hidden && f.id !== 'control_panel');

    useEffect(() => {
        if (recordingKey) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [recordingKey]);

    return (
        <div className="bg-[#c0c0c0] h-full flex flex-col font-sans text-sm">
            {/* Tabs */}
            <div className="flex px-1 pt-1 mt-1 gap-1">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-3 py-1 rounded-t border-t-2 border-l-2 border-r-2 ${activeTab === 'general' ? 'bg-[#c0c0c0] border-white text-black font-bold relative -mb-[2px] z-10' : 'bg-gray-400 border-gray-600 text-gray-700'}`}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('security')}
                    className={`px-3 py-1 rounded-t border-t-2 border-l-2 border-r-2 ${activeTab === 'security' ? 'bg-[#c0c0c0] border-white text-black font-bold relative -mb-[2px] z-10' : 'bg-gray-400 border-gray-600 text-gray-700'}`}
                >
                    Security
                </button>
                <button
                    onClick={() => setActiveTab('controls')}
                    className={`px-3 py-1 rounded-t border-t-2 border-l-2 border-r-2 ${activeTab === 'controls' ? 'bg-[#c0c0c0] border-white text-black font-bold relative -mb-[2px] z-10' : 'bg-gray-400 border-gray-600 text-gray-700'}`}
                >
                    Controls
                </button>
            </div>

            {/* Content Area */}
            <fieldset className="flex-1 mx-1 mb-1 p-4 border-2 border-white border-r-gray-600 border-b-gray-600">
                {message && (
                    <div className="bg-green-100 border border-green-500 text-green-800 px-2 py-1 mb-4 text-xs font-bold">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="bg-red-100 border border-red-500 text-red-800 px-2 py-1 mb-4 text-xs font-bold">
                        {error}
                    </div>
                )}

                {activeTab === 'general' && (
                    <div className="max-w-sm">
                        <h3 className="font-bold mb-4">User Information</h3>
                        <form onSubmit={handleUpdateUsername}>
                            <div className="mb-4">
                                <label className="block text-xs mb-1">Username:</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full border border-gray-500 p-1 shadow-inner"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white"
                            >
                                {loading ? 'Saving...' : 'Apply Changes'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="max-w-sm">
                        <h3 className="font-bold mb-4">Change Password</h3>
                        <form onSubmit={handleUpdatePassword}>
                            <div className="mb-2">
                                <label className="block text-xs mb-1">New Password:</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full border border-gray-500 p-1 shadow-inner"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs mb-1">Confirm Password:</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full border border-gray-500 p-1 shadow-inner"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white"
                            >
                                {loading ? 'Updating...' : 'Change Password'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'controls' && (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold">Keyboard Shortcuts</h3>
                            <button
                                onClick={handleSaveHotkeys}
                                disabled={loading}
                                className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs font-bold"
                            >
                                {loading ? 'Saving...' : '💾 Save Keys'}
                            </button>
                        </div>

                        <div className="bg-white border-2 border-gray-600 border-r-white border-b-white flex-1 overflow-y-auto p-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="p-1 border border-gray-300 w-1/2">Feature</th>
                                        <th className="p-1 border border-gray-300">Hotkey</th>
                                        <th className="p-1 border border-gray-300 w-16">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mappableFeatures.map(f => (
                                        <tr key={f.id} className="hover:bg-blue-50">
                                            <td className="p-1 border border-gray-200 flex items-center gap-2">
                                                {f.isImage ? <img src={f.icon} className="w-4 h-4" /> : f.icon}
                                                {f.title}
                                            </td>
                                            <td className="p-1 border border-gray-200 font-mono font-bold text-blue-800">
                                                {recordingKey === f.id ? (
                                                    <span className="animate-pulse bg-yellow-200 px-1">Press Key...</span>
                                                ) : (
                                                    hotkeys[f.id] ? (
                                                        <span className="bg-gray-100 px-1 border border-gray-300 rounded uppercase">{hotkeys[f.id]}</span>
                                                    ) : (
                                                        <span className="text-gray-400 italic">None</span>
                                                    )
                                                )}
                                            </td>
                                            <td className="p-1 border border-gray-200 text-center">
                                                {hotkeys[f.id] ? (
                                                    <button
                                                        onClick={() => clearHotkey(f.id)}
                                                        className="text-red-600 hover:bg-red-100 px-1 border border-transparent hover:border-red-300 rounded"
                                                        title="Clear"
                                                    >
                                                        ✕
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => recordHotkey(f.id)}
                                                        className="text-blue-600 hover:bg-blue-100 px-1 border border-transparent hover:border-blue-300 rounded text-xs"
                                                    >
                                                        Assign
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            * Click "Save Keys" to apply changes. Keys like Escape, Enter, Tab are reserved.
                        </div>
                    </div>
                )}
            </fieldset>
        </div>
    );
}
