import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function ComposeMessage({ onClose, onSent, replyTo = null, initialRecipient = null }) {
    const [recipientName, setRecipientName] = useState('');
    const [recipientId, setRecipientId] = useState(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (replyTo) {
            setRecipientId(replyTo.sender_id);
            setRecipientName(replyTo.sender_name);
            setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
        } else if (initialRecipient) {
            setRecipientId(initialRecipient.id);
            setRecipientName(initialRecipient.username);
        }
    }, [replyTo, initialRecipient]);

    useEffect(() => {
        if (!recipientName || recipientId) {
            setSearchResults([]);
            return;
        }

        const searchPlayers = async () => {
            setSearching(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .ilike('username', `%${recipientName}%`)
                    .limit(5);

                if (error) throw error;
                setSearchResults(data || []);
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setSearching(false);
            }
        };

        const timeoutId = setTimeout(searchPlayers, 500);
        return () => clearTimeout(timeoutId);
    }, [recipientName, recipientId]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!recipientId || !subject || !body) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.rpc('send_message', {
                p_recipient_ids: [recipientId],
                p_subject: subject,
                p_body: body,
                p_parent_id: replyTo?.id || null
            });

            if (error) throw error;
            if (onSent) onSent();
            onClose();
        } catch (err) {
            console.error('Send error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectRecipient = (user) => {
        setRecipientId(user.id);
        setRecipientName(user.username);
        setSearchResults([]);
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-transparent">
            <div className="w-[500px] flex flex-col bg-[#c0c0c0] p-[3px] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#dfdfdf,inset_-2px_-2px_#808080,inset_2px_2px_#ffffff] font-sans text-xs">
                {/* Title Bar */}
                <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] p-1 flex justify-between items-center mb-1">
                    <div className="text-white font-bold pl-1">
                        {replyTo ? 'Reply' : 'New Message'}
                    </div>
                    <button onClick={onClose} className="w-4 h-3.5 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black flex items-center justify-center font-bold text-[8px]">✕</button>
                </div>

                <form onSubmit={handleSend} className="p-2 flex flex-col gap-2">
                    {error && (
                        <div className="border border-red-500 bg-red-100 p-1 text-red-800">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <label className="w-16 text-right">To:</label>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={recipientName}
                                onChange={(e) => {
                                    setRecipientName(e.target.value);
                                    setRecipientId(null);
                                }}
                                disabled={!!replyTo || !!initialRecipient}
                                className="w-full px-1 py-0.5 bg-white border-2 border-gray-600 border-r-white border-b-white outline-none"
                                placeholder="Search..."
                            />
                            {!recipientId && searchResults.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border border-gray-600 mt-1 max-h-40 overflow-y-auto shadow-lg">
                                    {searchResults.map(user => (
                                        <div
                                            key={user.id}
                                            onClick={() => selectRecipient(user)}
                                            className="px-2 py-1 hover:bg-[#000080] hover:text-white cursor-pointer"
                                        >
                                            {user.username}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="w-16 text-right">Subject:</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            maxLength={100}
                            className="flex-1 px-1 py-0.5 bg-white border-2 border-gray-600 border-r-white border-b-white outline-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1 mt-2">
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            maxLength={1000}
                            rows={12}
                            className="w-full px-1 py-0.5 bg-white border-2 border-gray-600 border-r-white border-b-white outline-none font-serif resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !recipientId || !subject || !body}
                            className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white font-bold"
                        >
                            {loading ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
