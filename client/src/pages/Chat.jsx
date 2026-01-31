import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    MessageSquare, CircleDashed, Users, MoreVertical, Plus,
    Search, Settings, Phone, Video, Paperclip, Smile, Mic, Send,
    ArrowLeft, CheckCheck, User as UserIcon, FileText
} from 'lucide-react';
import io from 'socket.io-client';
import '../styles/Chat.css';

// --- Socket Link ---
const socket = io('http://localhost:3000');

export default function Chat() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const navigate = useNavigate();
    const bottomRef = useRef(null);

    // --- File Upload State ---
    const [file, setFile] = useState(null);
    const fileInputRef = useRef(null);

    // --- UI States ---
    const [view, setView] = useState('chats'); // 'chats' | 'profile' | 'status' etc.
    const [isProfileOpen, setIsProfileOpen] = useState(false); // Controls the "Profile Drawer" overlay
    const [showMenu, setShowMenu] = useState(false);

    const [userData, setUserData] = useState(user); // For Profile Display

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

            if (selectedUser && senderId === selectedUser._id) {
                setMessages(prev => [...prev, { ...data, role: 'user', created_at: new Date() }]);
                markAsRead(senderId);
            } else {
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

        socket.on('messages_read', (data) => {
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
    }, [selectedUser]);

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`/api/chat/users?currentUserId=${user.id}`);
            setUsers(res.data);

            // Restore active chat from localStorage if available
            const lastActiveChatId = localStorage.getItem('lastActiveChat');
            if (lastActiveChatId) {
                const foundUser = res.data.find(u => u._id === lastActiveChatId);
                if (foundUser) {
                    setSelectedUser(foundUser);
                    fetchP2PRequest(foundUser._id);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const markAsRead = async (senderId) => {
        try {
            await axios.post('/api/chat/messages/mark-read', { userId: user.id, senderId: senderId });
            setUsers(prev => prev.map(u => u._id === senderId ? { ...u, unreadCount: 0 } : u));
        } catch (err) { console.error(err); }
    };

    const fetchP2PRequest = async (otherId) => {
        try {
            const res = await axios.get(`/api/chat/p2p/${user.id}/${otherId}`);
            setMessages(res.data);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (err) { console.error(err); }
    };

    const handleUserSelect = (u) => {
        setSelectedUser(u);
        localStorage.setItem('lastActiveChat', u._id); // Persist chat
        fetchP2PRequest(u._id);
        if (u.unreadCount > 0) markAsRead(u._id);
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if ((!input.trim() && !file) || !selectedUser) return;

        // Optimistic UI Update (Temporary)
        const tempId = Date.now();
        const tempMsg = {
            id: tempId,
            sender_id: user.id,
            receiver_id: selectedUser._id,
            role: 'user',
            content: input,
            type: file ? (file.type.startsWith('image/') ? 'image' : 'file') : 'text',
            file_path: file ? URL.createObjectURL(file) : null, // Local preview
            fileName: file ? file.name : null,
            fileSize: file ? file.size : null,
            pageCount: 1, // Default for optimistic UI
            created_at: new Date(),
            is_read: false
        };

        setMessages(prev => [...prev, tempMsg]);
        setInput('');
        setFile(null); // Clear file immediately from UI

        try {
            const formData = new FormData();
            formData.append('userId', user.id);
            formData.append('toUserId', selectedUser._id);
            formData.append('content', input);
            if (file) formData.append('file', file);

            // Upload to Server
            const res = await axios.post('/api/chat/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const sentMsg = res.data.message;

            // Update Messages to replace temp with real one (optional, or just rely on stable ID if server returns it)
            // But critically: EMIT SOCKET NOW with the REAL server file_path
            socket.emit('send_message', {
                sender_id: user.id,
                receiverId: selectedUser._id,
                content: sentMsg.content,
                type: sentMsg.type,
                file_path: sentMsg.file_path, // This is what the friend needs!
                role: 'user'
            });

            // Update User List Last Message
            setUsers(prev => prev.map(u => {
                if (u._id === selectedUser._id) {
                    return {
                        ...u,
                        lastMessage: {
                            content: sentMsg.type === 'image' ? '📷 Image' : (sentMsg.type === 'file' ? '📄 File' : sentMsg.content),
                            created_at: new Date(),
                            type: sentMsg.type
                        }
                    };
                }
                return u;
            }));

        } catch (err) {
            console.error("Failed to send msg", err);
            // Ideally remove temp message or show error
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('authChange'));
        window.location.href = '/';
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getFriendlyDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
        });
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
                    {/* Simple Menu Dropdown */}
                    {showMenu && (
                        <div className="wa-menu-dropdown">
                            <div className="wa-menu-item" onClick={logout}>Log out</div>
                            <div className="wa-menu-item">New group</div>
                            <div className="wa-menu-item">Starred messages</div>
                            <div className="wa-menu-item">Settings</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="wa-search-section">
                <div className="wa-search-bar">
                    <Search size={18} color="#54656f" />
                    <input type="text" placeholder="Search Neural Chat" className="wa-search-input" />
                </div>
            </div>

            {/* Filters */}
            <div className="wa-filters">
                <button className="wa-filter-pill active">All</button>
                <button className="wa-filter-pill">Unread</button>
                <button className="wa-filter-pill">Favorites</button>
                <button className="wa-filter-pill">Groups</button>
            </div>

            {/* Users List */}
            <div className="wa-user-list">
                {users.map(u => (
                    <div
                        key={u._id}
                        className={`wa-user-item ${selectedUser?._id === u._id ? 'active' : ''}`}
                        onClick={() => handleUserSelect(u)}
                    >
                        <div className="wa-avatar">
                            {/* Placeholder/Initial */}
                            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#54656f' }}>
                                {u.name?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="wa-chat-info">
                            <div className="wa-chat-row-top">
                                <span className="wa-chat-name">{u.name}</span>
                                <span className="wa-chat-time">{formatTime(u.lastMessage?.created_at)}</span>
                            </div>
                            <div className="wa-chat-row-bottom">
                                <span className="wa-chat-last-msg">
                                    {u.lastMessage?.type === 'image' ? '📷 Image' : (u.lastMessage?.content || '')}
                                </span>
                                {u.unreadCount > 0 && <div className="wa-unread-badge">{u.unreadCount}</div>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const handleDownload = (url, fileName) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePaste = (e) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            e.preventDefault();
            const pastedFile = e.clipboardData.files[0];
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'doc', 'docx', 'pdf'];
            const extension = pastedFile.name.split('.').pop().toLowerCase();

            if (allowedExtensions.includes(extension)) {
                setFile(pastedFile);
            } else {
                alert('Only JPG, JPEG, PNG, DOC, DOCX, and PDF files are allowed.');
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'doc', 'docx', 'pdf'];
            const extension = droppedFile.name.split('.').pop().toLowerCase();

            if (allowedExtensions.includes(extension)) {
                setFile(droppedFile);
            } else {
                alert('Only JPG, JPEG, PNG, DOC, DOCX, and PDF files are allowed.');
            }
        }
    };

    const renderMainChat = () => (
        <div
            className="wa-main-chat"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {selectedUser ? (
                <>
                    {/* Header */}
                    <div className="wa-chat-header">
                        <div className="wa-chat-header-user">
                            <div className="wa-avatar" style={{ width: 40, height: 40, marginRight: 10 }}>
                                <span style={{ fontSize: 16 }}>{selectedUser.name?.charAt(0).toUpperCase()}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 'bold', fontSize: 16 }}>{selectedUser.name}</span>
                                <span style={{ fontSize: 12, color: '#667781' }}>click here for contact info</span>
                            </div>
                        </div>
                        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {messages.map((msg, idx) => {
                                    const isMe = (msg.sender_id === user.id) || (msg.user_id === user.id);
                                    const msgDate = new Date(msg.created_at).toDateString();
                                    const prevMsgDate = idx > 0 ? new Date(messages[idx - 1].created_at).toDateString() : null;
                                    const showSeparator = msgDate !== prevMsgDate;

                                    return (
                                        <React.Fragment key={idx}>
                                            {showSeparator && (
                                                <div style={{ textAlign: 'center', margin: '1.5rem 0 1rem 0', position: 'relative' }}>
                                                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#e5e7eb', zIndex: 0 }}></div>
                                                    <span style={{ background: '#f3f4f6', padding: '0 1rem', fontSize: '0.75rem', color: '#6b7280', position: 'relative', zIndex: 1, fontWeight: '600' }}>
                                                        {getFriendlyDate(msg.created_at)}
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
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
                                        </React.Fragment>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                        </div>

                        <div className="wa-input-pill">
                            {/* File Preview Badge inside pill */}
                            {file && (
                                <div style={{ background: '#e9edef', padding: '2px 8px', borderRadius: 4, marginRight: 5, fontSize: 12, display: 'flex', alignItems: 'center' }}>
                                    {file.name.substring(0, 15)}...
                                    <button onClick={() => setFile(null)} style={{ border: 'none', background: 'transparent', marginLeft: 4, cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                                </div>
                            )}

                            <textarea
                                className="wa-input-box"
                                placeholder="Type a message"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onPaste={handlePaste}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend(e);
                                    }
                                }}
                                rows={1}
                                style={{ resize: 'none', overflowY: 'auto' }}
                            />
                            {(input.trim() || file) && (
                                <button onClick={handleSend} className="wa-nav-icon-btn wa-send-btn">
                                    <Send size={20} color="white" />
                                </button>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: '#41525d' }}>
                    <h2>Neural Chat</h2>
                    <p style={{ fontSize: 14, marginTop: 10 }}>Send and receive messages without keeping your phone online.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="wa-app-container">
            {renderLeftSidebar()}
            {renderLeftPanel()}
            {/* If file is selected, show Preview Overlay INSTEAD of Main Chat (or on top) */}
            {file ? renderFilePreview() : renderMainChat()}
        </div>
    );
}
