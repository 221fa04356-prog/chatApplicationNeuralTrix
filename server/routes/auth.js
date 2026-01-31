const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const sendEmail = require('../utils/emailService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'neural_secret_77';

// Register
router.post('/register', async (req, res) => {
    const { name, email, mobile, designation } = req.body;

    if (!name || !email || !mobile) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validations
    const nameRegex = /^[A-Za-z\s]+$/;
    const mobileRegex = /^\d{10}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|vignan\.ac\.in|.+?\.edu)$/i;

    if (!nameRegex.test(name)) return res.status(400).json({ error: 'Name must check contain only alphabets and spaces.' });
    if (!mobileRegex.test(mobile)) return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Email must be from @gmail.com, @outlook.com, @vignan.ac.in, or .edu domains.' });

    try {
        // Check duplicates
        const existing = await User.findOne({ $or: [{ email }, { mobile }, { name }] });
        if (existing) {
            return res.status(400).json({ error: 'User with these details already exists' });
        }

        // Insert as pending
        await User.create({ name, email, mobile, designation, status: 'pending' });

        // Email Admin
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
            const subject = 'New User Registration Request';
            const html = `
                <h3>New User Registration</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Job Position:</strong> ${designation || 'N/A'}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Mobile:</strong> ${mobile}</p>
                <p>Please login to the admin dashboard to approve this user.</p>
            `;
            // Fire and forget email to not block response
            sendEmail(adminEmail, subject, html).catch(err => console.error('Failed to send admin email:', err));
        }

        res.json({ message: 'Registration requested. Wait for admin approval.' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, loginId, password } = req.body;

    let query = {};
    if (email) query.email = email;
    else if (loginId) query.login_id = loginId;
    else return res.status(400).json({ error: 'Missing Login ID or Email' });

    try {
        const user = await User.findOne(query);
        if (!user) return res.status(400).json({ error: 'User not found' });

        if (user.status !== 'approved') {
            return res.status(403).json({ error: 'Account not approved yet' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, role: user.role, email: user.email, login_id: user.login_id }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Forgot Password Request
router.post('/forgot-password', async (req, res) => {
    const { email, loginId } = req.body;

    if (!email && !loginId) {
        return res.status(400).json({ error: 'Email or Login ID required' });
    }

    try {
        let query = {};
        if (email) query.email = email;
        else if (loginId) query.login_id = loginId;

        const user = await User.findOne(query);
        if (!user) return res.status(400).json({ error: 'User not found' });

        await PasswordReset.create({ user_id: user._id });

        // Email Admin
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
            const subject = 'Password Reset Request';
            const html = `
                <h3>Password Reset Requested</h3>
                <p><strong>User:</strong> ${user.name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Login ID:</strong> ${user.login_id}</p>
                <p>Please login to the admin dashboard to resolve this request.</p>
            `;
            sendEmail(adminEmail, subject, html).catch(err => console.error('Failed to send admin email:', err));
        }

        res.json({ message: 'Reset request sent to admin' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Registration (Secret Key Protected)
router.post('/admin/register', async (req, res) => {
    const { name, email, password, secretKey } = req.body;

    const MASTER_KEY = process.env.ADMIN_SECRET || 'neural_master_key';
    if (secretKey !== MASTER_KEY) {
        return res.status(403).json({ error: 'Invalid Admin Secret Key' });
    }

    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

    try {
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already exists' });

        const hash = await bcrypt.hash(password, 10);

        await User.create({
            name,
            email,
            password: hash,
            role: 'admin',
            status: 'approved',
            mobile: '0000000000' + Date.now() // Dummy unique mobile
        });

        res.json({ message: 'Admin account created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Password Reset (Secret Key Protected)
router.post('/admin/reset', async (req, res) => {
    const { email, newPassword, secretKey } = req.body;

    const MASTER_KEY = process.env.ADMIN_SECRET || 'neural_master_key';
    if (secretKey !== MASTER_KEY) {
        return res.status(403).json({ error: 'Invalid Admin Secret Key' });
    }

    try {
        const hash = await bcrypt.hash(newPassword, 10);
        const result = await User.updateOne(
            { email: email, role: 'admin' },
            { password: hash }
        );

        if (result.matchedCount === 0) return res.status(404).json({ error: 'Admin email not found' });

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
