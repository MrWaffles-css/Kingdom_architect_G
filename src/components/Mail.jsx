import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import ComposeMessage from './ComposeMessage';

export default function Mail({ session }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentFolder, setCurrentFolder] = useState('inbox');
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [showCompose, setShowCompose] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchMessages();
    }, [currentFolder, filter]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_inbox', { p_folder: currentFolder, p_filter: filter });
            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMessageClick = async (msg) => {
        setSelectedMessage(msg);
        if (currentFolder === 'inbox' && !msg.is_read) {
            try {
                const { error } = await supabase.rpc('mark_as_read', { p_message_id: msg.id });
                if (!error) {
                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
                }
            } catch (err) {
                console.error('Error marking read:', err);
            }
        }
    };

    const handleDelete = async (msgId) => {
        try {
            const { error } = await supabase.rpc('delete_message', { p_message_id: msgId });
            if (error) throw error;
            setMessages(prev => prev.filter(m => m.id !== msgId));
            if (selectedMessage?.id === msgId) setSelectedMessage(null);
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    };

    const handleReply = (msg) => {
        setReplyTo(msg);
        setShowCompose(true);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'admin': return <span className="font-bold text-red-800">[ADMIN]</span>;
            case 'system': return <span className="font-bold text-blue-800">[SYSTEM]</span>;
            default: return null;
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] bg-[#c0c0c0] font-sans text-xs flex-col">
            {/* Toolbar */}
            <div className="flex gap-2 p-1 border-b border-white mb-1">
                <button
                    onClick={() => { setReplyTo(null); setShowCompose(true); }}
                    className="flex flex-col items-center justify-center p-1 w-16 active:bg-gray-400 group"
                >
                    <span className="text-xl">📝</span>
                    <span>New Mail</span>
                </button>
                <div className="w-[1px] bg-gray-400 h-full mx-1"></div>
                <button
                    onClick={() => selectedMessage && handleReply(selectedMessage)}
                    disabled={!selectedMessage || currentFolder === 'sent'}
                    className="flex flex-col items-center justify-center p-1 w-16 disabled:opacity-50 active:bg-gray-400"
                >
                    <span className="text-xl">reply</span>
                    <span>Reply</span>
                </button>
                <div className="w-[1px] bg-gray-400 h-full mx-1"></div>
                <button
                    onClick={() => selectedMessage && handleDelete(selectedMessage.id)}
                    disabled={!selectedMessage || currentFolder === 'deleted' || selectedMessage?.is_broadcast}
                    className="flex flex-col items-center justify-center p-1 w-16 disabled:opacity-50 active:bg-gray-400 text-red-800"
                >
                    <span className="text-xl">❌</span>
                    <span>Delete</span>
                </button>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-1 gap-1">
                {/* Folder List */}
                <div className="w-full md:w-40 bg-white border-2 border-gray-600 border-r-white border-b-white p-2 flex-shrink-0">
                    <div className="font-bold mb-2">Local Folders</div>
                    <ul className="space-y-1">
                        <li
                            className={`cursor-pointer px-1 flex items-center gap-1 ${currentFolder === 'inbox' ? 'bg-[#000080] text-white' : ''}`}
                            onClick={() => { setCurrentFolder('inbox'); setSelectedMessage(null); }}
                        >
                            <span>📥</span> Inbox
                        </li>
                        <li
                            className={`cursor-pointer px-1 flex items-center gap-1 ${currentFolder === 'sent' ? 'bg-[#000080] text-white' : ''}`}
                            onClick={() => { setCurrentFolder('sent'); setSelectedMessage(null); }}
                        >
                            <span>📤</span> Sent
                        </li>
                        <li
                            className={`cursor-pointer px-1 flex items-center gap-1 ${currentFolder === 'deleted' ? 'bg-[#000080] text-white' : ''}`}
                            onClick={() => { setCurrentFolder('deleted'); setSelectedMessage(null); }}
                        >
                            <span>🗑️</span> Trash
                        </li>
                    </ul>

                    {currentFolder === 'inbox' && (
                        <div className="mt-4 border-t border-gray-300 pt-2">
                            <label className="block mb-1 font-bold">Filter View</label>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full border border-gray-400"
                            >
                                <option value="all">All Messages</option>
                                <option value="unread">Unread Only</option>
                                <option value="admin">Admin Only</option>
                                <option value="system">Show System</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Message List + Preview */}
                <div className="flex-1 flex flex-col gap-1">
                    {/* Message List */}
                    <div className="h-1/2 bg-white border-2 border-gray-600 border-r-white border-b-white overflow-auto">
                        <table className="w-full text-left border-collapse cursor-default">
                            <thead>
                                <tr className="bg-[#c0c0c0] text-black text-xs font-normal border-b border-gray-400">
                                    <th className="pl-1 border-r border-white w-6">!</th>
                                    <th className="pl-1 border-r border-white font-normal">From</th>
                                    <th className="pl-1 border-r border-white font-normal">Subject</th>
                                    <th className="pl-1 border-r border-white font-normal w-32">Received</th>
                                </tr>
                            </thead>
                            <tbody>
                                {messages.map(msg => (
                                    <tr
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        className={`${selectedMessage?.id === msg.id ? 'bg-[#000080] text-white' : (!msg.is_read && currentFolder === 'inbox' ? 'font-bold' : '')}`}
                                    >
                                        <td className="pl-1">{msg.priority === 'admin' ? '❗' : (msg.is_broadcast ? '📢' : '')}</td>
                                        <td className="pl-1 truncate max-w-[100px]">{currentFolder === 'sent' ? `To: ${msg.recipient_count}` : msg.sender_name}</td>
                                        <td className="pl-1 truncate max-w-[150px]">{getPriorityBadge(msg.priority)} {msg.subject}</td>
                                        <td className="pl-1 whitespace-nowrap">{new Date(msg.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Preview Pane */}
                    <div className="flex-1 bg-white border-2 border-gray-600 border-r-white border-b-white p-2 overflow-auto font-serif">
                        {selectedMessage ? (
                            <div>
                                <div className="border-b border-gray-300 mb-2 pb-2 bg-gray-100 p-2">
                                    <div className="font-bold">Subject: {selectedMessage.subject}</div>
                                    <div className="text-gray-600">From: {selectedMessage.sender_name || 'Me'}</div>
                                    <div className="text-gray-600">Date: {formatDate(selectedMessage.created_at)}</div>
                                </div>
                                <div className="whitespace-pre-wrap">{selectedMessage.body}</div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 mt-10">No message selected</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="border-t border-gray-400 p-1 pl-2 text-gray-600">
                {messages.length} messages
            </div>

            {showCompose && (
                <ComposeMessage
                    onClose={() => { setShowCompose(false); setReplyTo(null); }}
                    onSent={() => { fetchMessages(); setCurrentFolder('sent'); }}
                    replyTo={replyTo}
                />
            )}
        </div>
    );
}
