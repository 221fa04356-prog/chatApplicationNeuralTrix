import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { UserPlus, Mail, Phone, User } from 'lucide-react';

export default function Register() {
    const [formData, setFormData] = useState({ name: '', email: '', mobile: '' });
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMsg('');

        // Validations
        const nameRegex = /^[A-Za-z\s]+$/;
        const mobileRegex = /^\d{10}$/;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|vignan\.ac\.in|.+?\.edu)$/i;

        if (!nameRegex.test(formData.name)) {
            setError('Name must contain only alphabets and spaces.');
            return;
        }
        if (!mobileRegex.test(formData.mobile)) {
            setError('Mobile number must be exactly 10 digits.');
            return;
        }
        if (!emailRegex.test(formData.email)) {
            setError('Email must be from @gmail.com, @outlook.com, @vignan.ac.in, or .edu domains.');
            return;
        }

        try {
            const res = await axios.post('/api/auth/register', formData);
            setMsg(res.data.message);
            setFormData({ name: '', email: '', mobile: '' });
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        }
    };

    return (
        <div className="center-page">
            <div className="card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>Create Account</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Join NeuralChat</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.5rem', background: '#fee2e2', borderRadius: '0.5rem' }}>{error}</div>}
                    {msg && <div style={{ color: 'var(--success)', marginBottom: '1rem', padding: '0.5rem', background: '#d1fae5', borderRadius: '0.5rem' }}>{msg}</div>}

                    <div className="form-group">
                        <label>Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="John Doe"
                                style={{ paddingLeft: '2.5rem' }}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                                style={{ paddingLeft: '2.5rem' }}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Mobile Number</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type="text"
                                value={formData.mobile}
                                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                placeholder="1234567890"
                                style={{ paddingLeft: '2.5rem' }}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginBottom: '1rem' }}>
                        <UserPlus size={18} style={{ display: 'inline', marginRight: '5px' }} />
                        Request Approval
                    </button>

                    <div style={{ textAlign: 'center' }}>
                        <Link to="/" className="link">Back to Login</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
