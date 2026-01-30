import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Send, LogOut, CheckCheck } from 'lucide-react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function Chat() {
    const [users, setUsers] = useState([]); // Now contains { ...user, lastMessage, unreadCount }
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const navigate = useNavigate();
    const bottomRef = useRef(null);

    // 1. Join Room once
    useEffect(() => {
        if (user.id) {
            socket.emit('join_room', user.id);
        }
    }, [user.id]);

    // 2. Chat Logic & Socket Listeners
    useEffect(() => {
        if (!user.id) {
            navigate('/');
            return;
        }

        fetchUsers();

        socket.on('receive_message', (data) => {
            const senderId = data.sender_id || data.user_id;

            // 1. If chatting with sender, append message and mark as read immediately
            if (selectedUser && senderId === selectedUser._id) {
                setMessages(prev => [...prev, { ...data, role: 'user', created_at: new Date() }]);
                markAsRead(senderId);
            } else {
                // 2. If NOT chatting with sender, update Sidebar info (unread count + last msg)
                setUsers(prevUsers => prevUsers.map(u => {
                    if (u._id === senderId) {
                        return {
                            ...u,
                            unreadCount: (u.unreadCount || 0) + 1,
                            lastMessage: {
                                content: data.content,
                                created_at: new Date(),
                                type: data.type
                            }
                        };
                    }
                    return u;
                }));
            }
        });

        // Listen for Read Receipts
        socket.on('messages_read', (data) => {
            // data: { reader_id, read_at }
            if (selectedUser && data.reader_id === selectedUser._id) {
                setMessages(prev => prev.map(msg => {
                    const isMyMsg = (msg.sender_id === user.id) || (msg.user_id === user.id);
                    if (isMyMsg && !msg.is_read) {
                        return { ...msg, is_read: true, read_at: data.read_at };
                    }
                    return msg;
                }));
            }
        });

        return () => {
            socket.off('receive_message');
            socket.off('messages_read');
        };
    }, [selectedUser]); // selectedUser is a dependency for the socket listener scope

    const fetchUsers = async () => {
        try {
            // Pass currentUserId to get metadata
            const res = await axios.get(`/api/chat/users?currentUserId=${user.id}`);
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const markAsRead = async (senderId) => {
        try {
            await axios.post('/api/chat/messages/mark-read', {
                userId: user.id,
                senderId: senderId
            });
            // Reset local count
            setUsers(prev => prev.map(u => u._id === senderId ? { ...u, unreadCount: 0 } : u));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchP2PRequest = async (otherId) => {
        try {
            const res = await axios.get(`/api/chat/p2p/${user.id}/${otherId}`);
            setMessages(res.data);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUserSelect = (u) => {
        setSelectedUser(u);
        fetchP2PRequest(u._id);
        // Mark as read when opening chat
        if (u.unreadCount > 0) {
            markAsRead(u._id);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedUser) return;

        const tempMsg = {
            id: Date.now(),
            sender_id: user.id,
            receiver_id: selectedUser._id,
            role: 'user',
            content: input,
            type: 'text',
            created_at: new Date()
        };

        setMessages(prev => [...prev, tempMsg]);
        setInput('');

        // Update MY sidebar for THIS user to show the latest message I just sent
        setUsers(prev => prev.map(u => {
            if (u._id === selectedUser._id) {
                return {
                    ...u,
                    lastMessage: {
                        content: input,
                        created_at: new Date(),
                        type: 'text'
                    }
                };
            }
            return u;
        }));

        socket.emit('send_message', {
            sender_id: user.id,
            receiverId: selectedUser._id,
            content: input,
            type: 'text',
            role: 'user'
        });

        try {
            await axios.post('/api/chat/send', {
                userId: user.id,
                toUserId: selectedUser._id,
                content: input
            });
        } catch (err) {
            console.error("Failed to save msg", err);
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('authChange'));
        window.location.href = '/';
    };

    // Helper to format time
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#f3f4f6' }}>
            {/* Sidebar */}
            <div style={{ width: '320px', background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Contacts</h3>
                    <button className="btn-secondary" style={{ padding: '0.4rem' }} onClick={logout} title="Logout">
                        <LogOut size={16} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {users.map(u => (
                        <div
                            key={u._id}
                            onClick={() => handleUserSelect(u)}
                            style={{
                                padding: '1rem',
                                borderBottom: '1px solid #f3f4f6',
                                cursor: 'pointer',
                                background: selectedUser?._id === u._id ? '#eef2ff' : 'white',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <div style={{ overflow: 'hidden', flex: 1, marginRight: '0.5rem' }}>
                                <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: '#6b7280',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {u.unreadCount > 0 ? (
                                        <span style={{ fontWeight: 'bold', color: '#374151' }}>
                                            {u.lastMessage?.type === 'image' ? '📷 Image' : (u.lastMessage?.content || 'No messages')}
                                        </span>
                                    ) : (
                                        <span>{u.lastMessage?.type === 'image' ? '📷 Image' : (u.lastMessage?.content || u.email)}</span>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '50px' }}>
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
                                    {formatTime(u.lastMessage?.created_at)}
                                </div>
                                {u.unreadCount > 0 && (
                                    <div style={{
                                        background: 'var(--primary, #6366f1)',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '20px',
                                        height: '20px',
                                        fontSize: '0.7rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold'
                                    }}>
                                        {u.unreadCount}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedUser ? (
                    <>
                        <div style={{ padding: '1rem', background: 'white', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                            {selectedUser.name}
                        </div>
                        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {messages.map((msg, idx) => {
                                    const isMe = (msg.sender_id === user.id) || (msg.user_id === user.id);
                                    return (
                                        <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                            <div style={{
                                                padding: '1rem',
                                                borderRadius: '1rem',
                                                borderBottomRightRadius: isMe ? 0 : '1rem',
                                                borderBottomLeftRadius: isMe ? '1rem' : 0,
                                                background: isMe ? 'var(--primary)' : 'white',
                                                color: isMe ? 'white' : 'black',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}>
                                                {msg.content}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                {/* Timestamp */}
                                                <span>{formatTime(msg.created_at)}</span>

                                                {/* Receipt Status (Only for Me) */}
                                                {isMe && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                        {msg.is_read ? (
                                                            <>
                                                                <CheckCheck size={14} color="#3b82f6" /> {/* Blue Double Tick */}
                                                                <span style={{ fontSize: '0.65rem' }}>Read {formatTime(msg.read_at)}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCheck size={14} color="#9ca3af" /> {/* Grey Double Tick (Delivered) */}
                                                                <span style={{ fontSize: '0.65rem' }}>Delivered {formatTime(msg.created_at)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'white', borderTop: '1px solid #e5e7eb' }}>
                            <form onSubmit={handleSend} style={{ display: 'flex', gap: '1rem' }}>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type a message..."
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '2rem', border: '1px solid #e5e7eb' }}
                                />
                                <button type="submit" className="btn-primary" style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#9ca3af' }}>
                        Select a user to start chatting
                    </div>
                )}
            </div>
        </div>
    );
}
