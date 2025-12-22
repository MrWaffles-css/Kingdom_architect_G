import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

export default function ChatWindow({ conversationId, otherUser, onClose, onMinimize, isMinimized }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isMinimized) {
            fetchMessages();
            markAsRead();
            subscribeToRealtime();
        }
    }, [conversationId, isMinimized]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isMinimized]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching chat messages:', err);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async () => {
        try {
            await supabase.rpc('mark_chat_as_read', { p_conversation_id: conversationId });
        } catch (err) {
            console.error('Error marking chat read:', err);
        }
    };

    const subscribeToRealtime = () => {
        const channel = supabase
            .channel(`chat:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                    markAsRead();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_typing_status',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    if (payload.new.user_id === otherUser.id) {
                        setOtherUserTyping(payload.new.is_typing);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setSending(true);
        try {
            const { error } = await supabase.rpc('send_chat_message', {
                p_recipient_id: otherUser.id,
                p_message: newMessage
            });

            if (error) throw error;
            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleTyping = async () => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        await supabase.from('chat_typing_status').upsert({ conversation_id: conversationId, user_id: (await supabase.auth.getUser()).data.user.id, is_typing: true });
        typingTimeoutRef.current = setTimeout(async () => {
            await supabase.from('chat_typing_status').upsert({ conversation_id: conversationId, user_id: (await supabase.auth.getUser()).data.user.id, is_typing: false });
        }, 3000);
    };

    if (isMinimized) return null;

    return (
        <div className="fixed bottom-0 right-20 w-80 bg-[#c0c0c0] p-[3px] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#dfdfdf,inset_-2px_-2px_#808080,inset_2px_2px_#ffffff] flex flex-col h-96 z-50 font-sans text-sm">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] p-1 flex justify-between items-center mb-1 select-none" onClick={onMinimize}>
                <div className="flex items-center gap-1 text-white font-bold pl-1">
                    <span className="text-xs">💬</span>
                    <span className="text-xs">{otherUser.username} - Instant Message</span>
                </div>
                <div className="flex gap-[2px]">
                    <button onClick={(e) => { e.stopPropagation(); onMinimize(); }} className="w-4 h-3.5 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black flex items-center justify-center font-bold text-[8px]">_</button>
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-4 h-3.5 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black flex items-center justify-center font-bold text-[8px]">✕</button>
                </div>
            </div>

            {/* Toolbar (Fake) */}
            <div className="bg-[#c0c0c0] border-b border-gray-400 mb-1 px-1 py-0.5 text-xs flex gap-2 text-gray-700">
                <span className="underline">F</span>ile <span className="underline">E</span>dit <span className="underline">V</span>iew <span className="underline">H</span>elp
            </div>

            {/* Messages Area */}
            <div className="flex-1 bg-white border-2 border-gray-600 border-r-white border-b-white overflow-y-auto p-1 mb-1 font-mono text-xs">
                {loading ? (
                    <div className="text-center text-gray-500 mt-4">Connecting...</div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id !== otherUser.id;
                        return (
                            <div key={msg.id} className="mb-0.5">
                                <span className={isMe ? 'text-blue-800 font-bold' : 'text-red-800 font-bold'}>
                                    {isMe ? 'You' : otherUser.username}:
                                </span>
                                <span className="ml-1 text-black">{msg.message}</span>
                            </div>
                        );
                    })
                )}
                {otherUserTyping && (
                    <div className="text-gray-500 italic mt-1">{otherUser.username} is typing...</div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="pt-1 flex flex-col gap-1">
                <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                        }
                    }}
                    className="flex-1 h-12 px-1 py-0.5 bg-white border-2 border-gray-600 border-r-white border-b-white focus:outline-none font-sans text-sm resize-none"
                    maxLength={500}
                />
                <div className="flex justify-end gap-1">
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="px-4 py-0.5 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white font-bold text-xs"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}
