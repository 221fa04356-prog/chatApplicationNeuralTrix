const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Message = require('../models/Message');
const PasswordReset = require('../models/PasswordReset');
const sendEmail = require('../utils/emailService');

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').lean();

        // Add flagged count for each user
        const usersWithFlags = await Promise.all(users.map(async (u) => {
            const flaggedCount = await Message.countDocuments({ user_id: u._id, is_flagged: true });
            return { ...u, id: u._id, flaggedCount };
        }));

        res.json(usersWithFlags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve User & Set Password and Login ID
router.post('/approve', async (req, res) => {
    const { userId, loginId, password } = req.body;
    if (!userId || !password || !loginId) return res.status(400).json({ error: 'Missing userId, loginId or password' });

    try {
        // Check if loginId exists (excluding current user if needed, but here it's new assignment)
        const existing = await User.findOne({ login_id: loginId });
        if (existing && existing.id !== userId) {
            return res.status(400).json({ error: 'Login ID already taken' });
        }

        const hash = await bcrypt.hash(password, 10);
        await User.findByIdAndUpdate(userId, {
            password: hash,
            login_id: loginId,
            status: 'approved'
        });

        res.json({ message: 'User approved with Login ID and Password' });

        // Email User
        const user = await User.findById(userId);
        if (user && user.email) {
            const subject = 'Account Approved - Login Details';
            const html = `
                <h3>Welcome to NeuralChat</h3>
                <p>Your account has been approved.</p>
                <p><strong>Login ID:</strong> ${loginId}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p>Please change your password after logging in.</p>
                <p><a href="http://localhost:5173/login">Login Here</a></p>
            `;
            sendEmail(user.email, subject, html).catch(err => console.error('Failed to send user email:', err));
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Password Reset Requests
router.get('/resets', async (req, res) => {
    try {
        const resets = await PasswordReset.find({ status: 'pending' }).populate('user_id', 'name email');

        // Transform to match previous flat structure
        const formatted = resets.map(r => {
            if (!r.user_id) return null; // Handle deleted users
            return {
                id: r.id,
                user_id: r.user_id.id,
                name: r.user_id.name,
                email: r.user_id.email,
                created_at: r.created_at
            };
        }).filter(item => item !== null);

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Resolve Reset Request (Set new password)
router.post('/reset-password', async (req, res) => {
    const { requestId, userId, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ error: 'Missing userId or newPassword' });

    try {
        const hash = await bcrypt.hash(newPassword, 10);

        await User.findByIdAndUpdate(userId, { password: hash });

        if (requestId) {
            await PasswordReset.findByIdAndUpdate(requestId, { status: 'resolved' });
        }

        res.json({ message: 'Password updated' });

        // Email User
        const user = await User.findById(userId);
        if (user && user.email) {
            const subject = 'Password Reset Successful';
            const html = `
                <h3>Password Reset</h3>
                <p>Your password has been reset by the admin.</p>
                <p><strong>New Password:</strong> ${newPassword}</p>
                <p>Please change your password after logging in.</p>
                <p><a href="http://localhost:5173/login">Login Here</a></p>
            `;
            sendEmail(user.email, subject, html).catch(err => console.error('Failed to send user email:', err));
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Reset Request
router.delete('/reset/:id', async (req, res) => {
    try {
        await PasswordReset.findByIdAndDelete(req.params.id);
        res.json({ message: 'Request deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User
router.delete('/user/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        await Message.deleteMany({ user_id: userId });
        await PasswordReset.deleteMany({ user_id: userId });
        await User.findByIdAndDelete(userId);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Chat for a user
router.delete('/chat/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        await Message.deleteMany({ user_id: userId });
        res.json({ message: 'Chat history deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete specific messages
router.delete('/chat/messages/delete', async (req, res) => {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds)) {
        return res.status(400).json({ error: 'Invalid message IDs' });
    }
    try {
        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $set: { is_deleted_by_admin: true } }
        );
        res.json({ message: 'Messages soft-deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
