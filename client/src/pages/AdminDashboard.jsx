import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Trash2, MessageSquare, Key, LogOut, Eye, EyeOff, Menu, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState(sessionStorage.getItem('adminActiveTab') || 'pending');

    useEffect(() => {
        sessionStorage.setItem('adminActiveTab', activeTab);
    }, [activeTab]);
    const [users, setUsers] = useState([]);
    const [resets, setResets] = useState([]);
    const [confirmPass, setConfirmPass] = useState({}); // Stores { userId: password }
    const [confirmPassRe, setConfirmPassRe] = useState({}); // Stores { userId: confirmPassword }
    const [loginIds, setLoginIds] = useState({}); // Stores { userId: loginId }
    const [showPass, setShowPass] = useState({}); // Stores { key: boolean } for visibility toggles
    const [showPassRe, setShowPassRe] = useState({}); // Stores { key: boolean } for confirm visibility

    // Chat Review State
    const [viewChat, setViewChat] = useState(null); // { user, messages }
    const [loadingChat, setLoadingChat] = useState(false);
    const [chatStep, setChatStep] = useState('contacts'); // 'contacts', 'dates', 'messages'
    const [chatContacts, setChatContacts] = useState([]);
    const [chatDates, setChatDates] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, messageId: null });

    // Multi-Select State
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMsgs, setSelectedMsgs] = useState([]);

    // Flag Alert State
    const [showFlagAlert, setShowFlagAlert] = useState(false);
    const [highRiskUsers, setHighRiskUsers] = useState([]);

    // Sidebar State
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [uRes, rRes] = await Promise.all([
                axios.get('/api/admin/users'),
                axios.get('/api/admin/resets')
            ]);
            setUsers(uRes.data);
            setResets(rRes.data);

            // Check for high risk users (flags > 3)
            const risky = uRes.data.filter(u => u.flaggedCount > 3);
            if (risky.length > 0) {
                setHighRiskUsers(risky);
                setShowFlagAlert(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleApprove = async (userId) => {
        const password = confirmPass[userId];
        const confirmPassword = confirmPassRe[userId];
        const loginId = loginIds[userId];

        // Validation Regex
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

        if (!password || !loginId) return alert('Please enter both Login ID and Password');
        if (password !== confirmPassword) return alert('Passwords do not match');

        if (!passwordRegex.test(password)) {
            return alert('Password must be at least 8 characters long and include an uppercase letter, a number, and a special character');
        }

        try {
            await axios.post('/api/admin/approve', { userId, loginId, password });
            alert('User approved!');
            fetchData();
            // Clear inputs
            setConfirmPass({ ...confirmPass, [userId]: '' });
            setConfirmPassRe({ ...confirmPassRe, [userId]: '' });
            setLoginIds({ ...loginIds, [userId]: '' });
        } catch (err) {
            alert(err.response?.data?.error);
        }
    };

    const handleReset = async (requestId, userId) => {
        const newPassword = confirmPass[`reset-${requestId}`];
        const confirmPassword = confirmPassRe[`reset-${requestId}`];

        // Validation Regex
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

        if (!newPassword) return alert('Please enter a new password');
        if (newPassword !== confirmPassword) return alert('Passwords do not match');

        if (!passwordRegex.test(newPassword)) {
            return alert('Password must be at least 8 characters long and include an uppercase letter, a number, and a special character');
        }

        try {
            await axios.post('/api/admin/reset-password', { requestId, userId, newPassword });
            alert('Password reset successful');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error);
        }
    };

    const handleDeleteReset = async (requestId) => {
        if (!window.confirm("Delete this request?")) return;
        try {
            await axios.delete(`/api/admin/reset/${requestId}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error);
        }
    };

    const toggleShowPass = (key) => {
        setShowPass(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleShowPassRe = (key) => {
        setShowPassRe(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Are you sure? This will delete the user and their chats.')) return;
        try {
            await axios.delete(`/api/admin/user/${id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error);
        }
    };

    const handleReviewChat = async (user) => {
        setLoadingChat(true);
        setViewChat({ user, messages: [] });
        setChatStep('contacts');
        setSelectedContact(null);
        setSelectedDate(null);
        try {
            const res = await axios.get(`/api/admin/chat/contacts/${user.id}`);
            setChatContacts(res.data);
        } catch (err) {
            alert('Failed to fetch contacts: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingChat(false);
        }
    };

    const handleSelectContact = async (contact) => {
        setSelectedContact(contact);
        setLoadingChat(true);
        try {
            const res = await axios.get(`/api/admin/chat/dates/${viewChat.user.id}/${contact.id}`);
            setChatDates(res.data);
            setChatStep('dates');
        } catch (err) {
            alert('Failed to fetch dates: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingChat(false);
        }
    };

    const handleSelectDate = async (date) => {
        setSelectedDate(date);
        setLoadingChat(true);
        try {
            const res = await axios.get(`/api/admin/chat/history-filtered`, {
                params: {
                    userId: viewChat.user.id,
                    otherUserId: selectedContact.id,
                    date: date
                }
            });
            setViewChat({ ...viewChat, messages: res.data });
            setChatStep('messages');
        } catch (err) {
            alert('Failed to fetch history: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingChat(false);
        }
    };

    const handleChatBack = () => {
        if (chatStep === 'messages') setChatStep('dates');
        else if (chatStep === 'dates') setChatStep('contacts');
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
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

    const handleContextMenu = (e, msgId) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            messageId: msgId
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleDeleteMessage = async () => {
        // Single delete via Context Menu -> Turns into Selection Mode
        if (contextMenu.messageId) {
            setSelectionMode(true);
            setSelectedMsgs([contextMenu.messageId]);
            closeContextMenu();
        }
    };

    const handleBulkDelete = async () => {
        if (selectedMsgs.length === 0) return;
        if (!window.confirm(`Delete ${selectedMsgs.length} messages?`)) return;

        try {
            await axios.delete('/api/admin/chat/messages/delete', { data: { messageIds: selectedMsgs } });

            // Refresh view
            // In soft delete, we don't remove them, but re-fetching is safer to show "deleted text"
            // Or locally update:
            const newMessages = viewChat.messages.map(m => {
                if (selectedMsgs.includes(m.id)) {
                    return { ...m, is_deleted_by_admin: true };
                }
                return m;
            });
            setViewChat({ ...viewChat, messages: newMessages });

            // Exit selection mode
            setSelectionMode(false);
            setSelectedMsgs([]);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete messages');
        }
    };

    const toggleSelection = (msgId) => {
        if (!selectionMode) return;
        if (selectedMsgs.includes(msgId)) {
            setSelectedMsgs(prev => prev.filter(id => id !== msgId));
        } else {
            setSelectedMsgs(prev => [...prev, msgId]);
        }
    };



    const confirmDeleteChat = async () => {
        if (!viewChat) return;
        if (!window.confirm('Confirm delete? This cannot be undone.')) return;

        try {
            await axios.delete(`/api/admin/chat/${viewChat.user.id}`);
            alert('Chat cleared');
            setViewChat(null);
        } catch (err) {
            alert(err.response?.data?.error);
        }
    };

    const logout = () => {
        sessionStorage.clear();
        navigate('/');
    };

    const pendingUsers = users.filter(u => u.status === 'pending');
    const activeUsers = users.filter(u => u.status === 'approved' && u.role !== 'admin');

    return (
        <div className="dashboard-layout">
            <div
                className="sidebar"
                style={{
                    width: sidebarOpen ? '250px' : '70px',
                    padding: sidebarOpen ? '1.5rem' : '1rem',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 50
                }}
                onMouseEnter={() => setSidebarOpen(true)}
                onMouseLeave={() => setSidebarOpen(false)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', height: '40px' }}>
                    <Menu size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <h2 style={{
                        margin: 0,
                        color: 'var(--primary)',
                        whiteSpace: 'nowrap',
                        opacity: sidebarOpen ? 1 : 0,
                        transition: 'opacity 0.2s',
                        fontSize: '1.2rem'
                    }}>
                        Admin Panel
                    </h2>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                        className={activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setActiveTab('pending')}
                        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: sidebarOpen ? 'flex-start' : 'center', padding: sidebarOpen ? '0.75rem' : '0.75rem 0', position: 'relative' }}
                        title="Pending"
                    >
                        <UserCheck size={20} />
                        {!sidebarOpen && pendingUsers.length > 0 && (
                            <span style={{ position: 'absolute', top: '5px', right: '5px', background: '#ef4444', color: 'white', fontSize: '0.6rem', padding: '2px 5px', borderRadius: '10px' }}>{pendingUsers.length}</span>
                        )}
                        {sidebarOpen && <span>Pending ({pendingUsers.length})</span>}
                    </button>
                    <button
                        className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setActiveTab('users')}
                        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: sidebarOpen ? 'flex-start' : 'center', padding: sidebarOpen ? '0.75rem' : '0.75rem 0', position: 'relative' }}
                        title="Users"
                    >
                        <Users size={20} />
                        {!sidebarOpen && activeUsers.length > 0 && (
                            <span style={{ position: 'absolute', top: '5px', right: '5px', background: '#3b82f6', color: 'white', fontSize: '0.6rem', padding: '2px 5px', borderRadius: '10px' }}>{activeUsers.length}</span>
                        )}
                        {sidebarOpen && <span>Users ({activeUsers.length})</span>}
                    </button>
                    <button
                        className={activeTab === 'resets' ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setActiveTab('resets')}
                        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: sidebarOpen ? 'flex-start' : 'center', padding: sidebarOpen ? '0.75rem' : '0.75rem 0', position: 'relative' }}
                        title="Resets"
                    >
                        <Key size={20} />
                        {!sidebarOpen && resets.length > 0 && (
                            <span style={{ position: 'absolute', top: '5px', right: '5px', background: '#f59e0b', color: 'white', fontSize: '0.6rem', padding: '2px 5px', borderRadius: '10px' }}>{resets.length}</span>
                        )}
                        {sidebarOpen && <span>Resets ({resets.length})</span>}
                    </button>
                </nav>
                <div style={{ marginTop: 'auto' }}>
                    <button
                        className="btn-danger"
                        onClick={logout}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: sidebarOpen ? 'center' : 'center', padding: sidebarOpen ? '0.75rem' : '0.75rem 0' }}
                        title="Logout"
                    >
                        <LogOut size={20} />
                        {sidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </div>

            <div className="main-content">
                <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                    {activeTab === 'pending' && 'Pending Registrations'}
                    {activeTab === 'users' && 'User Management'}
                    {activeTab === 'resets' && 'Password Reset Requests'}
                </h1>

                {activeTab === 'pending' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {pendingUsers.length === 0 && <p>No pending requests.</p>}
                        {pendingUsers.map((u, index) => (
                            <div key={u.id} className="card" style={{ maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>#{index + 1}</span>
                                        <strong>{u.name}</strong>
                                    </div>
                                    <span style={{ color: 'gray', fontSize: '0.9rem' }}>
                                        {u.email} | {u.mobile} |
                                        <span style={{ fontWeight: 600, color: '#4b5563' }}>
                                            {u.designation || 'N/A'}
                                        </span>
                                    </span>
                                    <br />
                                    <span style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '500' }}>Requested: {formatDate(u.created_at)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="Assign Login ID"
                                        value={loginIds[u.id] || ''}
                                        onChange={e => setLoginIds({ ...loginIds, [u.id]: e.target.value })}
                                        style={{ width: '140px', padding: '0.5rem' }}
                                    />
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPass[u.id] ? "text" : "password"}
                                            placeholder="Set Password"
                                            value={confirmPass[u.id] || ''}
                                            onChange={e => setConfirmPass({ ...confirmPass, [u.id]: e.target.value })}
                                            style={{ width: '200px', padding: '0.5rem', paddingRight: '2rem' }}
                                        />
                                        <button
                                            onClick={() => toggleShowPass(u.id)}
                                            style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, width: 'auto', color: '#6b7280' }}
                                        >
                                            {showPass[u.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassRe[u.id] ? "text" : "password"}
                                            placeholder="Confirm"
                                            value={confirmPassRe[u.id] || ''}
                                            onChange={e => setConfirmPassRe({ ...confirmPassRe, [u.id]: e.target.value })}
                                            style={{ width: '200px', padding: '0.5rem', paddingRight: '2rem' }}
                                        />
                                        <button
                                            onClick={() => toggleShowPassRe(u.id)}
                                            style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, width: 'auto', color: '#6b7280' }}
                                        >
                                            {showPassRe[u.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button className="btn-primary" onClick={() => handleApprove(u.id)} style={{ width: 'auto' }}>Approve</button>
                                    <button className="btn-danger" onClick={() => handleDeleteUser(u.id)} style={{ width: 'auto' }}>Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {activeUsers.map(u => (
                            <div key={u.id} className="card" style={{ maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong>{u.name}</strong> <br />
                                    <span style={{ color: 'gray', fontSize: '0.9rem' }}>
                                        {u.email} | {u.mobile} |
                                        <span style={{ fontWeight: 600 }}>
                                            {u.designation || 'N/A'}
                                        </span>
                                    </span>
                                    {u.flaggedCount > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontSize: '0.85rem', marginTop: '0.25rem', fontWeight: 600 }}>
                                            <AlertTriangle size={14} /> Warning: {u.flaggedCount} flagged messages
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn-secondary" onClick={() => handleReviewChat(u)} style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <MessageSquare size={16} /> Review Chat
                                    </button>
                                    <button className="btn-danger" onClick={() => handleDeleteUser(u.id)} style={{ width: 'auto' }}>
                                        <Trash2 size={16} /> Delete User
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'resets' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {resets.length === 0 && <p>No pending reset requests.</p>}
                        {resets.map((r, index) => (
                            <div key={r.id} className="card" style={{ maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ background: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>#{index + 1}</span>
                                        <strong>Reset for: {r.name}</strong>
                                    </div>
                                    <span style={{ color: 'gray', fontSize: '0.9rem' }}>{r.email}</span> <br />
                                    <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: '500' }}>Requested: {formatDate(r.created_at)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPass[`reset-${r.id}`] ? "text" : "password"}
                                            placeholder="New Password"
                                            value={confirmPass[`reset-${r.id}`] || ''}
                                            onChange={e => setConfirmPass({ ...confirmPass, [`reset-${r.id}`]: e.target.value })}
                                            style={{ width: '250px', padding: '0.5rem', paddingRight: '2rem' }}
                                        />
                                        <button
                                            onClick={() => toggleShowPass(`reset-${r.id}`)}
                                            style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, width: 'auto', color: '#6b7280' }}
                                        >
                                            {showPass[`reset-${r.id}`] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassRe[`reset-${r.id}`] ? "text" : "password"}
                                            placeholder="Confirm"
                                            value={confirmPassRe[`reset-${r.id}`] || ''}
                                            onChange={e => setConfirmPassRe({ ...confirmPassRe, [`reset-${r.id}`]: e.target.value })}
                                            style={{ width: '250px', padding: '0.5rem', paddingRight: '2rem' }}
                                        />
                                        <button
                                            onClick={() => toggleShowPassRe(`reset-${r.id}`)}
                                            style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, width: 'auto', color: '#6b7280' }}
                                        >
                                            {showPassRe[`reset-${r.id}`] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button className="btn-primary" onClick={() => handleReset(r.id, r.user_id)} style={{ width: 'auto' }}>Reset Password</button>
                                    <button className="btn-danger" onClick={() => handleDeleteReset(r.id)} style={{ width: 'auto' }}><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {
                viewChat && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                    }}>
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

                            <div style={{ marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, paddingRight: '2rem' }}>
                                    Review Chat: {viewChat.user.name}
                                    {selectedContact && ` > ${selectedContact.name}`}
                                    {selectedDate && ` > ${getFriendlyDate(selectedDate)}`}
                                </h3>
                                {chatStep !== 'contacts' && (
                                    <button
                                        onClick={handleChatBack}
                                        style={{ marginTop: '0.5rem', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                    >
                                        ← Back to {chatStep === 'messages' ? 'Dates' : 'Contacts'}
                                    </button>
                                )}
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', background: '#f9fafb', minHeight: '300px' }}>
                                {loadingChat ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'gray' }}>Loading...</div>
                                ) : (
                                    <>
                                        {chatStep === 'contacts' && (
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Select a contact to view history:</p>
                                                {chatContacts.length === 0 ? (
                                                    <p style={{ textAlign: 'center', color: 'gray' }}>No communication found.</p>
                                                ) : (
                                                    chatContacts.map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => handleSelectContact(c)}
                                                            style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.4rem', cursor: 'pointer', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                                                        >
                                                            <span>{c.name} {c.type === 'ai' && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>[AI]</span>}</span>
                                                            <span style={{ fontSize: '0.8rem', color: 'gray' }}>{c.email}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {chatStep === 'dates' && (
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Select a date:</p>
                                                {chatDates.length === 0 ? (
                                                    <p style={{ textAlign: 'center', color: 'gray' }}>No history found for this contact.</p>
                                                ) : (
                                                    chatDates.map(date => (
                                                        <div
                                                            key={date}
                                                            onClick={() => handleSelectDate(date)}
                                                            style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.4rem', cursor: 'pointer', background: 'white', textAlign: 'center' }}
                                                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                                                        >
                                                            {getFriendlyDate(date)}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {chatStep === 'messages' && (
                                            <>
                                                {viewChat.messages.length === 0 ? (
                                                    <p style={{ color: 'gray', textAlign: 'center' }}>No messages found on this date.</p>
                                                ) : (
                                                    viewChat.messages.map((msg, i) => (
                                                        <div key={i} style={{ marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '85%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                                                                <div
                                                                    onClick={() => selectionMode && toggleSelection(msg.id)}
                                                                    onContextMenu={(e) => !selectionMode && handleContextMenu(e, msg.id)}
                                                                    style={{
                                                                        background: msg.is_deleted_by_admin ? '#f3f4f6' : (selectedMsgs.includes(msg.id) ? '#c7d2fe' : (msg.is_flagged ? '#fef3c7' : (msg.role === 'user' ? '#dbeafe' : 'white'))),
                                                                        padding: '0.5rem 0.75rem',
                                                                        borderRadius: '0.5rem',
                                                                        border: msg.is_flagged ? '1px solid #f59e0b' : (msg.role === 'user' ? 'none' : '1px solid #e5e7eb'),
                                                                        width: '100%',
                                                                        cursor: selectionMode ? 'pointer' : 'default',
                                                                        opacity: msg.is_deleted_by_admin ? 0.7 : 1,
                                                                        fontStyle: 'normal'
                                                                    }}>
                                                                    {/* ... badges and content ... */}
                                                                    {msg.is_deleted_by_admin && (
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '0.2rem', borderBottom: '1px solid #fee2e2', paddingBottom: '2px' }}>🚫 DELETED BY ADMIN</div>
                                                                    )}
                                                                    {msg.is_flagged && !msg.is_deleted_by_admin && (
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#d97706', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <AlertTriangle size={10} /> POSSIBLY UNPROFESSIONAL
                                                                        </div>
                                                                    )}
                                                                    {msg.type === 'text' && msg.content}
                                                                    {msg.type === 'image' && (
                                                                        <div>
                                                                            <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'blue' }}>[Image]</div>
                                                                            {msg.file_path && <img src={msg.file_path} alt="content" style={{ maxWidth: '150px', borderRadius: '4px' }} />}
                                                                            {msg.content && <div>{msg.content}</div>}
                                                                        </div>
                                                                    )}
                                                                    {msg.type === 'file' && (
                                                                        <div>
                                                                            <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'blue' }}>[File]</div>
                                                                            {msg.file_path && <a href={msg.file_path} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{msg.file_path.split('/').pop()}</a>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span style={{ fontSize: '0.7rem', color: 'gray', marginTop: '2px' }}>
                                                                {msg.role === 'user' ? 'User' : (msg.role === 'model' ? 'AI' : 'Other')} | {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                {selectionMode ? (
                                    <>
                                        <button className="btn-secondary" onClick={() => { setSelectionMode(false); setSelectedMsgs([]); }}>Cancel Selection</button>
                                        <button className="btn-danger" onClick={handleBulkDelete} disabled={selectedMsgs.length === 0}>
                                            <Trash2 size={16} style={{ marginRight: '5px' }} /> Delete Selected ({selectedMsgs.length})
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button className="btn-secondary" onClick={() => setViewChat(null)}>Close</button>
                                        {chatStep === 'messages' && (
                                            <button className="btn-danger" onClick={confirmDeleteChat} disabled={viewChat.messages.length === 0}>
                                                <Trash2 size={16} style={{ marginRight: '5px' }} /> Clear for this day
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Context Menu */}
                            {contextMenu.visible && (
                                <>
                                    <div
                                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1001 }}
                                        onClick={closeContextMenu}
                                    />
                                    <div style={{
                                        position: 'fixed',
                                        top: contextMenu.y,
                                        left: contextMenu.x,
                                        background: 'white',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                                        borderRadius: '4px',
                                        padding: '0.5rem',
                                        zIndex: 1002,
                                        cursor: 'pointer'
                                    }} onClick={handleDeleteMessage}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                                            <Trash2 size={16} /> Select / Delete
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }
            {/* High Risk Alert Modal */}
            {showFlagAlert && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', width: '90%', maxWidth: '500px', textAlign: 'center' }}>
                        <div style={{ marginBottom: '1rem', color: '#ef4444' }}>
                            <AlertTriangle size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <h2 style={{ color: '#b91c1c', marginBottom: '1rem' }}>Critical Attention Required</h2>
                        <p style={{ marginBottom: '1.5rem', color: '#374151' }}>
                            The following users have been flagged for unethical behavior more than 3 times:
                        </p>
                        <ul style={{ textAlign: 'left', background: '#fee2e2', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', listStyle: 'none' }}>
                            {highRiskUsers.map(u => (
                                <li key={u.id} style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#991b1b', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{u.name}</span>
                                    <span>{u.flaggedCount} flags</span>
                                </li>
                            ))}
                        </ul>
                        <button className="btn-primary" onClick={() => setShowFlagAlert(false)} style={{ width: '100%' }}>
                            Acknowledge
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
