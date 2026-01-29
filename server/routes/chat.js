const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Message = require('../models/Message');
const Groq = require('groq-sdk');
const pdf = require('pdf-parse');
const fs = require('fs');
// const Filter = require('bad-words');
// const filter = new Filter();

const badWords = ['hell', 'damn', 'badword', 'idiot', 'stupid', 'hate', 'kill', 'abuse']; // Add more as needed

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', // Images
            'application/pdf', // PDF
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        // Check mime type and extension
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];

        if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Images, PDF, and Word files are allowed.'));
        }
    }
});

// Get Chat History
router.get('/history/:userId', async (req, res) => {
    try {
        const messages = await Message.find({ user_id: req.params.userId })
            .sort({ created_at: 1 })
            .populate('reply_to', 'content type file_path role');
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send Message
router.post('/send', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req, res) => {
    const { userId, content, replyTo } = req.body;
    const file = req.file;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // Determine type
    let type = 'text';
    let filePath = null;
    if (file) {
        type = file.mimetype.startsWith('image/') ? 'image' : 'file';
        filePath = '/uploads/' + file.filename;
    }

    try {
        // Check for unprofessional content
        const isFlagged = content && badWords.some(word => content.toLowerCase().includes(word));

        // Save User Message
        await Message.create({
            user_id: userId,
            role: 'user',
            content: content || '',
            type,
            file_path: filePath,
            reply_to: replyTo || null,
            is_flagged: isFlagged
        });

        // Prepare context for AI
        let aiContent = "I received your file.";
        let messages = [];

        // 1. Handle Images (Vision Model)
        if (type === 'image') {
            const imagePath = path.join(__dirname, '../uploads', file.filename);
            const bitmap = fs.readFileSync(imagePath);
            const base64Image = bitmap.toString('base64');

            messages = [
                {
                    role: "user",
                    content: [
                        { type: "text", text: content || "Analyze this image." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }
            ];

            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: "meta-llama/llama-4-maverick-17b-128e-instruct",
            });
            aiContent = chatCompletion.choices[0]?.message?.content || "Image processed.";

        }
        // 2. Handle PDFs (Text Extraction + Text Model)
        else if (type === 'file' && file.mimetype === 'application/pdf') {
            const pdfPath = path.join(__dirname, '../uploads', file.filename);
            const dataBuffer = fs.readFileSync(pdfPath);
            try {
                const data = await pdf(dataBuffer);
                const pdfText = data.text.substring(0, 6000); // Limit context window
                messages = [
                    { role: "system", content: "You are a helpful assistant. Analyze the document content provided." },
                    { role: "user", content: `${content || "Analyze this document"}\n\nDocument Content:\n${pdfText}` }
                ];

                const chatCompletion = await groq.chat.completions.create({
                    messages: messages,
                    model: "llama-3.3-70b-versatile",
                });
                aiContent = chatCompletion.choices[0]?.message?.content || "Document analyzed.";
            } catch (pdfErr) {
                console.error("PDF Parse Error:", pdfErr);
                aiContent = "I received the PDF, but couldn't read its text. It might be scanned or encrypted.";
            }
        }
        // 3. Handle Regular Text
        else if (content) {
            messages = [{ role: "user", content: content }];
            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
            });
            aiContent = chatCompletion.choices[0]?.message?.content || "Done.";
        } else {
            // Just file (non-PDF or other), no content
            aiContent = "File uploaded successfully.";
        }

        // Save AI Response
        await Message.create({
            user_id: userId,
            role: 'model',
            content: aiContent,
            type: 'text'
        });

        res.json({ status: 'sent', aiResponse: aiContent });

    } catch (aiErr) {
        console.error("Groq/DB Error FULL:", aiErr); // Enhanced logging
        // Fallback
        try {
            const errorMsg = "Sorry, I encountered an error processing that. (" + (aiErr.error?.message || aiErr.message) + ")";
            await Message.create({
                user_id: userId,
                role: 'model',
                content: errorMsg,
                type: 'text'
            });
            res.json({ status: 'sent', aiResponse: errorMsg });
        } catch (dbErr) {
            res.status(500).json({ error: 'Database Error' });
        }
    }
});

// Toggle Pin/Star
router.post('/message/:id/toggle', async (req, res) => {
    const { action, value } = req.body; // action: 'pin' or 'star'
    try {
        const update = {};
        if (action === 'pin') update.is_pinned = value;
        if (action === 'star') update.is_starred = value;

        const msg = await Message.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json(msg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;