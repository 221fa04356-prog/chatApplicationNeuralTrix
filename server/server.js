require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./database');

const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'neural_secret_77';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Client URL
        methods: ["GET", "POST"]
    }
});

// Connect to Database
connectDB();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware to pass io to routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chat', require('./routes/chat'));

// Socket.io Logic
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Authentication error"));
        socket.userId = decoded.id; // Attach userId to socket
        next();
    });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    socket.on('join_room', (userId) => {
        // Security check: userId must match socket.userId
        if (userId !== socket.userId) {
            console.log(`User ${socket.userId} attempted to join unauthorized room ${userId}`);
            return;
        }
        socket.join(userId);
        console.log(`User ${userId} joined room ${userId}`);
    });

    socket.on('send_message', (data) => {
        // data: { receiverId, content, type, ... }
        // FORCE sender_id to be the authenticated socket.userId
        const secureData = {
            ...data,
            sender_id: socket.userId,
            user_id: socket.userId // Maintain compatibility with client-side field names
        };
        io.to(data.receiverId).emit('receive_message', secureData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.userId);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
