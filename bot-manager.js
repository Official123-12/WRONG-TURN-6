require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');
const { Session, User, connectDB } = require('./database');
const { createBotSession, botSessions } = require('./bot-manager');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Global variables
global.bots = new Map();

// Connect to database
connectDB();

// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        botName: config.botName,
        developer: config.developer,
        activeSessions: botSessions.size,
        timestamp: new Date().toISOString()
    });
});

// Generate pairing code
app.post('/api/pair', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number required' });
        }
        
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }
        
        // Check if already has active bot
        if (botSessions.has(cleanNumber)) {
            return res.json({
                status: 'already_connected',
                message: 'Bot is already connected'
            });
        }
        
        // Check if banned
        const user = await User.findOne({ phoneNumber: cleanNumber });
        if (user?.banned) {
            return res.status(403).json({
                error: 'You are banned from using this bot'
            });
        }
        
        // Generate pairing code (6 digits)
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = `wt6_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Save session
        const session = new Session({
            sessionId,
            phoneNumber: cleanNumber,
            pairingCode,
            status: 'pending',
            joinedGroup: false,
            joinedChannel: false
        });
        
        await session.save();
        
        // Create user if doesn't exist
        if (!user) {
            await User.create({
                userId: `${cleanNumber}@s.whatsapp.net`,
                phoneNumber: cleanNumber,
                name: `User_${cleanNumber.slice(-4)}`
            });
        }
        
        res.json({
            success: true,
            sessionId,
            pairingCode,
            message: `Pairing code for ${cleanNumber}`,
            requireJoin: true,
            groupLink: config.groupLink,
            channelLink: config.channelLink,
            instructions: '1. Open WhatsApp > Linked Devices > Link a Device\n2. Enter this code\n3. Join our group and channel to unlock commands'
        });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Confirm join and start bot
app.post('/api/confirm-join', async (req, res) => {
    try {
        const { sessionId, phoneNumber } = req.body;
        
        if (!sessionId || !phoneNumber) {
            return res.status(400).json({ error: 'Session ID and phone number required' });
        }
        
        const session = await Session.findOne({ sessionId, phoneNumber });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Update session
        session.joinedGroup = true;
        session.joinedChannel = true;
        session.status = 'active';
        await session.save();
        
        // Update user
        await User.findOneAndUpdate(
            { phoneNumber },
            { 
                joinedGroup: true,
                joinedChannel: true,
                lastActive: new Date()
            }
        );
        
        // Start bot
        const botStarted = await createBotSession(session);
        
        if (botStarted) {
            res.json({
                success: true,
                message: '✅ Bot connected successfully!',
                phoneNumber
            });
        } else {
            res.status(500).json({ error: 'Failed to start bot' });
        }
        
    } catch (error) {
        console.error('Confirm join error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check session status
app.get('/api/session/:phoneNumber', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber.replace(/\D/g, '');
        const session = await Session.findOne({ phoneNumber });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        const isConnected = botSessions.has(phoneNumber);
        
        res.json({
            phoneNumber: session.phoneNumber,
            status: session.status,
            joinedGroup: session.joinedGroup,
            joinedChannel: session.joinedChannel,
            connected: isConnected,
            pairingCode: session.pairingCode
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start all active sessions on server start
async function startActiveSessions() {
    try {
        const activeSessions = await Session.find({ 
            status: 'active',
            joinedGroup: true,
            joinedChannel: true
        });
        
        console.log(`🔄 Starting ${activeSessions.length} active sessions...`);
        
        for (const session of activeSessions) {
            try {
                await createBotSession(session);
                console.log(`✅ Started bot for: ${session.phoneNumber}`);
            } catch (error) {
                console.error(`❌ Failed to start ${session.phoneNumber}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Error starting sessions:', error);
    }
}

// Start server
const PORT = config.port || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 ${config.botName} Server running on port ${PORT}`);
    console.log(`👑 Developer: ${config.developer}`);
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    
    // Start active sessions
    setTimeout(startActiveSessions, 2000);
});
