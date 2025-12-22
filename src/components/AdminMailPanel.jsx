import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function AdminMailPanel() {
    const [activeTab, setActiveTab] = useState('broadcast'); // broadcast, messages, bans, profanity
    const [broadcastSubject, setBroadcastSubject] = useState('');
    const [broadcastBody, setBroadcastBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [messageSearch, setMessageSearch] = useState('');
    const [bans, setBans] = useState([]);
    const [profanityWords, setProfanityWords] = useState([]);
    const [newProfanityWord, setNewProfanityWord] = useState('');

    // Broadcast
    const handleBroadcast = async (e) => {
        e.preventDefault();
        if (!confirm('Send this broadcast to ALL users?')) return;

        setLoading(true);
        try {
            const { error } = await supabase.rpc('admin_broadcast', {
                p_subject: broadcastSubject,
                p_body: broadcastBody
            });
            if (error) throw error;
            alert('Broadcast sent successfully!');
            setBroadcastSubject('');
            setBroadcastBody('');
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Messages
    const fetchAllMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*, sender:profiles!sender_id(username)')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Bans
    const fetchBans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('chat_bans')
                .select('*, user:profiles!user_id(username), admin:profiles!banned_by(username)')
                .order('banned_at', { ascending: false });
            if (error) throw error;
            setBans(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnban = async (userId) => {
        if (!confirm('Unban this user?')) return;
        try {
            const { error } = await supabase.rpc('admin_chat_unban', { p_user_id: userId });
            if (error) throw error;
            fetchBans();
        } catch (err) {
            alert(err.message);
        }
    };

    // Profanity
    const fetchProfanity = async () => {
        const { data } = await supabase.from('profanity_words').select('*').order('word');
        setProfanityWords(data || []);
    };

    const handleAddProfanity = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('profanity_words').insert([{ word: newProfanityWord, severity: 'moderate' }]);
            if (error) throw error;
            setNewProfanityWord('');
            fetchProfanity();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDeleteProfanity = async (id) => {
        try {
            await supabase.from('profanity_words').delete().eq('id', id);
            fetchProfanity();
        } catch (err) {
            alert(err.message);
        }
    };

    useEffect(() => {
        if (activeTab === 'messages') fetchAllMessages();
        if (activeTab === 'bans') fetchBans();
        if (activeTab === 'profanity') fetchProfanity();
    }, [activeTab]);

    return (
        <fieldset className="border-2 border-white border-l-gray-600 border-t-gray-600 p-2 font-sans">
            <legend className="font-bold px-1 text-sm">Communication Management</legend>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white bg-gray-200 p-1 pb-0">
                {['broadcast', 'messages', 'bans', 'profanity'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-1 text-xs font-bold uppercase border-t-2 border-l-2 border-r-2 rounded-t transition-colors ${activeTab === tab
                            ? 'bg-white border-white border-r-gray-600 border-b-0 -mb-[1px] z-10'
                            : 'bg-gray-300 border-white border-r-gray-600 text-gray-600'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="p-4 bg-white border-2 border-gray-600 border-t-white border-l-white min-h-[300px]">
                {/* Broadcast Tab */}
                {activeTab === 'broadcast' && (
                    <form onSubmit={handleBroadcast} className="space-y-4 max-w-2xl">
                        <div className="bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800">
                            ⚠ Warning: This will send a message to EVERY user.
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Subject</label>
                            <input
                                type="text"
                                value={broadcastSubject}
                                onChange={e => setBroadcastSubject(e.target.value)}
                                className="w-full px-2 py-1 border-2 border-gray-600 border-r-white border-b-white bg-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">Message Body</label>
                            <textarea
                                value={broadcastBody}
                                onChange={e => setBroadcastBody(e.target.value)}
                                className="w-full px-2 py-1 border-2 border-gray-600 border-r-white border-b-white bg-white h-32"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white font-bold text-xs"
                        >
                            {loading ? 'Sending...' : 'Send Broadcast'}
                        </button>
                    </form>
                )}

                {/* Messages Tab */}
                {activeTab === 'messages' && (
                    <div>
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="Search messages..."
                                value={messageSearch}
                                onChange={e => setMessageSearch(e.target.value)}
                                className="w-full px-2 py-1 border-2 border-gray-600 border-r-white border-b-white bg-white text-xs"
                            />
                        </div>
                        <div className="overflow-x-auto border border-gray-400">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-200">
                                    <tr>
                                        <th className="p-2 border-r border-gray-400">Date</th>
                                        <th className="p-2 border-r border-gray-400">Sender</th>
                                        <th className="p-2 border-r border-gray-400">Subject</th>
                                        <th className="p-2 border-r border-gray-400">Priority</th>
                                        <th className="p-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {messages.map(msg => (
                                        <tr key={msg.id} className="border-b border-gray-200 hover:bg-gray-100">
                                            <td className="p-2 border-r border-gray-200">{new Date(msg.created_at).toLocaleDateString()}</td>
                                            <td className="p-2 border-r border-gray-200">{msg.sender?.username || 'Unknown'}</td>
                                            <td className="p-2 border-r border-gray-200">{msg.subject}</td>
                                            <td className="p-2 border-r border-gray-200">{msg.priority}</td>
                                            <td className="p-2">
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Permanently delete this message?')) return;
                                                        try {
                                                            const { error } = await supabase.rpc('admin_delete_message', { p_message_id: msg.id });
                                                            if (error) throw error;
                                                            fetchAllMessages();
                                                        } catch (err) {
                                                            alert(err.message);
                                                        }
                                                    }}
                                                    className="text-red-600 underline"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Bans Tab */}
                {activeTab === 'bans' && (
                    <div>
                        <div className="overflow-x-auto border border-gray-400">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-200">
                                    <tr>
                                        <th className="p-2 border-r border-gray-400">User</th>
                                        <th className="p-2 border-r border-gray-400">Banned By</th>
                                        <th className="p-2 border-r border-gray-400">Reason</th>
                                        <th className="p-2 border-r border-gray-400">Status</th>
                                        <th className="p-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bans.map(ban => (
                                        <tr key={ban.id} className="border-b border-gray-200 hover:bg-gray-100">
                                            <td className="p-2 border-r border-gray-200">{ban.user?.username}</td>
                                            <td className="p-2 border-r border-gray-200">{ban.admin?.username}</td>
                                            <td className="p-2 border-r border-gray-200">{ban.reason}</td>
                                            <td className="p-2 border-r border-gray-200">
                                                {ban.is_active ? <span className="font-bold text-red-600">Active</span> : 'Inactive'}
                                            </td>
                                            <td className="p-2">
                                                {ban.is_active && (
                                                    <button onClick={() => handleUnban(ban.user_id)} className="text-blue-600 underline">Unban</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {bans.length === 0 && (
                                        <tr><td colSpan="5" className="p-4 text-center text-gray-500">No active bans</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Profanity Tab */}
                {activeTab === 'profanity' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-bold text-xs mb-2">Add Word</h4>
                            <form onSubmit={handleAddProfanity} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newProfanityWord}
                                    onChange={e => setNewProfanityWord(e.target.value)}
                                    className="flex-1 px-2 py-1 border-2 border-gray-600 border-r-white border-b-white bg-white text-xs"
                                    placeholder="badword"
                                    required
                                />
                                <button type="submit" className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white font-bold text-xs">Add</button>
                            </form>
                        </div>
                        <div>
                            <h4 className="font-bold text-xs mb-2">Blocked Words</h4>
                            <div className="flex flex-wrap gap-2 border border-gray-400 p-2 bg-white h-40 overflow-y-auto">
                                {profanityWords.map(word => (
                                    <span key={word.id} className="bg-gray-200 border border-gray-400 px-2 py-0 text-xs flex items-center gap-1">
                                        {word.word}
                                        <button onClick={() => handleDeleteProfanity(word.id)} className="hover:text-red-600 font-bold ml-1">×</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </fieldset>
    );
}
