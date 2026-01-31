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
const socket = io('http://localhost:3000', {
    auth: {
        token: localStorage.getItem('token')
    }
});
// The global socket instance is removed as per the diff, and a local one is created in useEffect.
// const socket = io('http://localhost:3000', {
//     auth: {
//         token: localStorage.getItem('token')
//     }
// });

export default function Chat() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [user] = useState(JSON.parse(sessionStorage.getItem('user') || '{}'));
    const [token] = useState(sessionStorage.getItem('token'));
    const navigate = useNavigate();
    const bottomRef = useRef(null);
    const socketRef = useRef(null);

    // --- File Upload State ---
    const [file, setFile] = useState(null);
    const fileInputRef = useRef(null);

    // --- UI States ---
    const [view, setView] = useState('chats'); // 'chats' | 'profile' | 'status' etc.
    const [isProfileOpen, setIsProfileOpen] = useState(false); // Controls the "Profile Drawer" overlay
    const [showMenu, setShowMenu] = useState(false);

    const [userData, setUserData] = useState(user); // For Profile Display
    const selectedUserRef = useRef(null);

    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);

    const scrollToBottom = (force = false) => {
        if (!bottomRef.current) return;
        const container = bottomRef.current.parentElement;
        if (!container) return;

        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
        if (force || isNearBottom) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
        }
    };

    // 1. Initial Load: Join Room and Fetch Users
    useEffect(() => {
        if (user.id) {
            // socket.emit('join_room', user.id); // This socket is now local to the other useEffect
            fetchUsers();
        }
    }, [user.id]);

    useEffect(() => {
        if (messages.length > 0) {
            // Check if last message is from me
            const lastMsg = messages[messages.length - 1];
            const isMe = lastMsg && ((lastMsg.sender_id === user.id) || (lastMsg.user_id === user.id));
            scrollToBottom(isMe);
        }
    }, [messages]);

    // Helper to sort users by last message time
    const sortUsers = (usersList) => {
        return [...usersList].sort((a, b) => {
            const timeA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at) : 0;
            const timeB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at) : 0;
            return timeB - timeA;
        });
    };

    // 2. Persistent Socket Initialization
    useEffect(() => {
        if (!user.id || !token) return;

        const socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
            auth: { token }
        });
        socketRef.current = socketInstance;

        socketInstance.emit('join_room', user.id);

        socketInstance.on('receive_message', async (data) => {
            const senderId = data.sender_id || data.user_id;

            // Security Check
            if (data.receiverId !== user.id) return;

            // Update Sidebar for EVERYONE
            setUsers(prevUsers => {
                const userExists = prevUsers.some(u => u._id === senderId);
                if (!userExists) {
                    fetchUsers();
                    return prevUsers;
                }

                const updatedUsers = prevUsers.map(u => {
                    if (u._id === senderId) {
                        const isCurrentlyViewing = selectedUserRef.current?._id === senderId;
                        return {
                            ...u,
                            unreadCount: isCurrentlyViewing ? 0 : (u.unreadCount || 0) + 1,
                            lastMessage: {
                                content: data.content,
                                created_at: new Date(),
                                type: data.type
                            }
                        };
                    }
                    return u;
                });
                return sortUsers(updatedUsers);
            });

            // Append to Chat window ONLY if viewing this sender
            if (selectedUserRef.current && senderId === selectedUserRef.current._id) {
                setMessages(prev => [...prev, { ...data, role: 'user', created_at: new Date() }]);
                markAsRead(senderId);
            }
        });

        socketInstance.on('messages_read', (data) => {
            // data: { reader_id, read_at }
            // If the person who read my messages is the one I'm currently looking at
            if (selectedUserRef.current && data.reader_id === selectedUserRef.current._id) {
                setMessages(prev => prev.map(msg => {
                    const isFromMe = (msg.sender_id === user.id) || (msg.user_id === user.id);
                    if (isFromMe && !msg.is_read) {
                        return { ...msg, is_read: true, read_at: data.read_at };
                    }
                    return msg;
                }));
            }
        });

        return () => {
            socketInstance.disconnect();
            socketRef.current = null;
        };
    }, [user.id, token]);

    const fetchUsers = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`/api/chat/users?currentUserId=${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const sorted = sortUsers(res.data);
            setUsers(sorted);

            // Restore active chat from sessionStorage only if no chat is currently open
            const lastActiveChatId = sessionStorage.getItem('lastActiveChat');
            if (lastActiveChatId && !selectedUser) {
                const foundUser = res.data.find(u => u._id === lastActiveChatId);
                if (foundUser) {
                    setSelectedUser(foundUser);
                    fetchP2PRequest(foundUser._id, true);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const markAsRead = async (senderId) => {
        try {
            const token = sessionStorage.getItem('token');
            await axios.post('/api/chat/messages/mark-read',
                { userId: user.id, senderId: senderId },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            setUsers(prev => prev.map(u => u._id === senderId ? { ...u, unreadCount: 0 } : u));
        } catch (err) { console.error(err); }
    };

    const fetchP2PRequest = async (otherId, forceScroll = false) => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`/api/chat/p2p/${user.id}/${otherId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setMessages(res.data);
            if (forceScroll) {
                // For switching users, we always want to jump to bottom immediately
                setTimeout(() => {
                    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
                }, 100);
            }
        } catch (err) { console.error(err); }
    };

    const handleUserSelect = (u) => {
        setSelectedUser(u);
        sessionStorage.setItem('lastActiveChat', u._id); // Persist chat

        // Reset unread count locally for immediate UI update
        setUsers(prev => prev.map(userItem =>
            userItem._id === u._id ? { ...userItem, unreadCount: 0 } : userItem
        ));

        fetchP2PRequest(u._id, true); // Force scroll on user selection
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
            const token = sessionStorage.getItem('token');
            const res = await axios.post('/api/chat/send', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            const sentMsg = res.data.message;

            // But critically: EMIT SOCKET NOW with the REAL server file_path
            if (socketRef.current) {
                socketRef.current.emit('send_message', {
                    sender_id: user.id,
                    receiverId: selectedUser._id,
                    content: sentMsg.content,
                    type: sentMsg.type,
                    file_path: sentMsg.file_path, // This is what the friend needs!
                    role: 'user'
                });
            }

            // Update User List Last Message and Sort
            setUsers(prev => {
                const updated = prev.map(u => {
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
                });
                return sortUsers(updated);
            });

        } catch (err) {
            console.error("Failed to send msg", err);
            // Ideally remove temp message or show error
        }
    };

    const logout = () => {
        sessionStorage.clear();
        navigate('/');
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // --- Sub Render Functions ---

    // --- Sub Render Functions ---

    const renderLeftSidebar = () => (
        <div className="wa-nav-sidebar">
            <div className="wa-nav-top">
                <button
                    className={`wa-nav-icon-btn ${!isProfileOpen ? 'active' : ''}`}
                    onClick={() => setIsProfileOpen(false)}
                    title="Chats"
                >
                    <MessageSquare size={24} />
                    {/* Optional: Add red dot for total unread */}
                </button>
                <button className="wa-nav-icon-btn" title="Status"><CircleDashed size={24} /></button>
                <button className="wa-nav-icon-btn" title="Channels"><Users size={24} /></button>
                <button className="wa-nav-icon-btn" title="Communities"><Users size={24} /></button>
            </div>
            <div className="wa-nav-bottom">
                <button className="wa-nav-icon-btn" title="Settings"><Settings size={24} /></button>
                <button
                    className={`wa-nav-icon-btn wa-profile-btn ${isProfileOpen ? 'active' : ''}`}
                    onClick={() => setIsProfileOpen(true)}
                    title="Profile"
                >
                    {/* User Profile Image as Icon */}
                    {userData.image ? (
                        <img src={userData.image} alt="Me" />
                    ) : (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ccc' }} />
                    )}
                </button>
            </div>
        </div>
    );

    const renderProfileDrawer = () => (
        <div className="wa-profile-drawer">
            <div className="wa-drawer-header">
                <button onClick={() => setIsProfileOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ArrowLeft size={24} style={{ marginRight: 10 }} />
                    Profile
                </button>
            </div>
            <div className="wa-drawer-content">
                <div className="wa-profile-pic-section">
                    {userData.image ? (
                        <img src={userData.image} alt="Profile" className="wa-profile-pic-large" />
                    ) : (
                        <div className="wa-profile-pic-large" style={{ background: '#dfe1e5', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <UserIcon size={80} color="#fff" />
                        </div>
                    )}
                </div>

                <div className="wa-profile-section">
                    <div className="wa-section-label">Your Name</div>
                    <div className="wa-section-value-row">
                        <span className="wa-section-value">{userData.name || 'Your Name'}</span>
                        <Smile size={20} color="#8696a0" style={{ cursor: 'pointer' }} />
                    </div>
                    <div className="wa-section-note">This is not your username or pin. This name will be visible to your WhatsApp contacts.</div>
                </div>

                <div className="wa-profile-section">
                    <div className="wa-section-label">About</div>
                    <div className="wa-section-value-row">
                        <span className="wa-section-value">Available</span>
                        <Smile size={20} color="#8696a0" style={{ cursor: 'pointer' }} />
                    </div>
                </div>

                <div className="wa-profile-section">
                    <div className="wa-section-label">Phone</div>
                    <div className="wa-section-value-row">
                        <span className="wa-section-value">{userData.phone || '+91 94924 63918'}</span>
                    </div>
                </div>
            </div>
        </div>
    );






    const renderFilePreview = () => (
        <div className="wa-file-preview-overlay" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#e9edef', position: 'relative' }}>
            {/* Header */}
            <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#3b6e9e', color: 'white' }}>
                <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}>
                    <ArrowLeft size={24} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: 20 }}>
                {file && file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                ) : (
                    <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                        <div style={{ fontSize: 16, fontWeight: 500 }}>{file?.name}</div>
                        <div style={{ fontSize: 14, color: '#667781', marginTop: 5 }}>
                            {file?.size ? Math.ceil(file.size / 1024) + ' kB' : ''} • {file?.type?.split('/').pop().toUpperCase()}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Caption Input */}
            <div style={{ padding: '10px 15px', background: '#f0f2f5', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="wa-input-pill" style={{ flex: 1, background: 'white' }}>
                    <input
                        type="text"
                        className="wa-input-box"
                        placeholder="Add a caption..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSend(e);
                        }}
                        autoFocus
                    />
                </div>
                <button onClick={handleSend} className="wa-nav-icon-btn wa-send-btn">
                    <Send size={20} color="white" />
                </button>
            </div>
        </div>
    );

    const renderLeftPanel = () => (
        <div className="wa-left-panel">
            {/* If profile is open, it overlays this, but in DOM structure it can be sibling or child. 
                Based on request: "icon displays like in third image when clicked" -> Drawer opens over chat list.
            */}
            {isProfileOpen && renderProfileDrawer()}

            {/* Chat List Header */}
            <div className="wa-header">
                <span className="wa-header-title">Chats</span>
                <div className="wa-header-icons">
                    <button className="wa-nav-icon-btn" title="New Chat"><Plus size={20} /></button>
                    <button
                        className="wa-nav-icon-btn"
                        title="Menu"
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        <MoreVertical size={20} />
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
                            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b4a54' }}>
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
                        <div className="wa-header-icons">
                            <button className="wa-nav-icon-btn"><Video size={20} /></button>
                            <button className="wa-nav-icon-btn"><Phone size={20} /></button>
                            <button className="wa-nav-icon-btn"><Search size={20} /></button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="wa-chat-messages-area">
                        {messages.map((msg, idx) => {
                            const isMe = (msg.sender_id === user.id) || (msg.user_id === user.id);
                            return (
                                <div key={idx} className={`wa-message-bubble ${isMe ? 'wa-msg-sent' : 'wa-msg-rec'}`}>
                                    {/* Image Rendering */}
                                    {msg.type === 'image' && (
                                        <div className="wa-msg-image-container" onClick={() => handleDownload(msg.file_path, msg.fileName)}>
                                            <img src={msg.file_path} alt="Sent" className="wa-msg-image" />
                                        </div>
                                    )}
                                    {/* File Rendering */}
                                    {msg.type === 'file' && (
                                        <div
                                            className="wa-msg-doc-bubble"
                                            onClick={() => handleDownload(msg.file_path, msg.fileName)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {/* Top: Preview */}
                                            <div className="wa-doc-preview-area">
                                                {/* Simulated Page Content */}
                                                <div className="wa-doc-preview-simulated">
                                                    {/* Simulate text lines */}
                                                    <div style={{ width: '80%', height: 6, background: '#d1d7db', marginBottom: 6 }}></div>
                                                    <div style={{ width: '100%', height: 4, background: '#e9edef', marginBottom: 3 }}></div>
                                                    <div style={{ width: '100%', height: 4, background: '#e9edef', marginBottom: 3 }}></div>
                                                    <div style={{ width: '90%', height: 4, background: '#e9edef', marginBottom: 3 }}></div>

                                                    <div style={{ marginTop: 10, width: '40%', height: 20, background: '#e9edef' }}></div> {/* Image placeholder */}

                                                    <div style={{ flex: 1 }}></div>
                                                    <div style={{ fontSize: 8, color: '#999', textAlign: 'center' }}>Page 1</div>
                                                </div>
                                            </div>

                                            {/* Bottom: Info Footer */}
                                            <div className="wa-doc-info-area">
                                                <div className="wa-doc-icon" style={{ background: 'transparent', padding: 0 }}>
                                                    <FileText size={30} color="#e53935" strokeWidth={1.5} />
                                                </div>
                                                <div className="wa-doc-details">
                                                    <div className="wa-doc-filename" title={msg.fileName || 'Document'}>
                                                        {msg.fileName || 'Document.pdf'}
                                                    </div>
                                                    <div className="wa-doc-meta">
                                                        {msg.pageCount || 1} pages • {(msg.fileName || msg.file_path)?.split('.').pop()?.toUpperCase() || 'PDF'} • {msg.fileSize ? Math.ceil(msg.fileSize / 1024) + ' kB' : 'Unknown size'}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    )}

                                    {msg.content && <span>{msg.content}</span>}

                                    <div className="wa-msg-meta">
                                        <span>{formatTime(msg.created_at)}</span>
                                        {isMe && (
                                            msg.is_read
                                                ? <CheckCheck size={14} color="#53bdeb" />
                                                : <CheckCheck size={14} color="#9ca3af" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={bottomRef} />
                    </div>

                    {/* Footer Input */}
                    <div className="wa-footer">
                        {/* Paperclip / File Input */}
                        <div style={{ marginRight: 10 }}>
                            <button className="wa-nav-icon-btn" onClick={() => fileInputRef.current.click()}>
                                <Paperclip size={24} color="#54656f" />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept=".jpg,.jpeg,.png,.doc,.docx,.pdf"
                                onChange={handleFileSelect}
                            />
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
