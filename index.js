require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Import config and database
const config = require('./config');
const { connectDB, Session, User, Log } = require('./database');
const { createBotSession } = require('./bot-manager');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Global variables
global.activeBots = new Map(); // Store active bot sessions
global.commands = new Map(); // Store commands

// Connect to Database
connectDB();

// Load Commands
const loadCommands = () => {
    const commandsPath = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsPath)) {
        console.log('📁 Creating commands directory...');
        fs.mkdirSync(commandsPath, { recursive: true });
        
        // Create default command structure
        const defaultCommands = {
            'owner': ['menu.js', 'eval.js', 'broadcast.js'],
            'public': ['help.js', 'ping.js', 'status.js']
        };
        
        for (const [folder, files] of Object.entries(defaultCommands)) {
            const folderPath = path.join(commandsPath, folder);
            fs.mkdirSync(folderPath, { recursive: true });
            
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                if (!fs.existsSync(filePath)) {
                    fs.writeFileSync(filePath, `// ${file} command\n`, 'utf8');
                }
            });
        }
        console.log('✅ Created default command structure');
    }
    
    // Load all commands
    let commandCount = 0;
    
    const loadFolder = (folderPath) => {
        const items = fs.readdirSync(folderPath);
        
        items.forEach(item => {
            const fullPath = path.join(folderPath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                loadFolder(fullPath);
            } else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const command = require(fullPath);
                    
                    if (command && command.name && command.execute) {
                        global.commands.set(command.name.toLowerCase(), command);
                        commandCount++;
                        console.log(`✅ Loaded command: ${command.name}`);
                    }
                } catch (error) {
                    console.error(`❌ Error loading ${item}:`, error.message);
                }
            }
        });
    };
    
    loadFolder(commandsPath);
    console.log(`📦 Total commands loaded: ${commandCount}`);
};

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        botName: config.botName,
        developer: config.developer,
        activeSessions: global.activeBots.size,
        totalCommands: global.commands.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await Session.find({ status: 'active' });
        res.json({
            count: sessions.length,
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                userId: s.userId,
                phoneNumber: s.phoneNumber,
                connectedAt: s.connectionInfo?.connectedAt,
                lastSeen: s.connectionInfo?.lastSeen
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pair', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        
        // Validate phone number format
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }
        
        // Check if session already exists
        const existingSession = await Session.findOne({ 
            phoneNumber: cleanNumber,
            status: 'active'
        });
        
        if (existingSession) {
            return res.json({
                status: 'already_connected',
                message: 'Bot is already connected with this number',
                sessionId: existingSession.sessionId
            });
        }
        
        // Create new session
        const sessionId = `wt6_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Request pairing code
        const pairingCode = await requestPairingCode(cleanNumber);
        
        if (!pairingCode) {
            return res.status(500).json({ error: 'Failed to generate pairing code' });
        }
        
        // Save session to database
        const newSession = new Session({
            sessionId,
            userId: `${cleanNumber}@s.whatsapp.net`,
            phoneNumber: cleanNumber,
            status: 'pending',
            pairingCode,
            connectionInfo: {
                device: 'Web Client',
                platform: 'WhatsApp Web'
            }
        });
        
        await newSession.save();
        
        // Log the pairing request
        await Log.create({
            type: 'pairing',
            sessionId,
            userId: `${cleanNumber}@s.whatsapp.net`,
            details: { phoneNumber: cleanNumber, status: 'pending' }
        });
        
        res.json({
            success: true,
            sessionId,
            pairingCode,
            message: `Pairing code generated for ${cleanNumber}`,
            instructions: 'Open WhatsApp → Linked Devices → Link a Device → Enter this code'
        });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/check-pairing/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (session.status === 'active') {
            // Start bot for this session
            await startBotForSession(session);
            
            return res.json({
                status: 'connected',
                message: 'Bot is now connected!',
                sessionId: session.sessionId
            });
        }
        
        res.json({
            status: session.status,
            pairingCode: session.pairingCode,
            message: 'Waiting for pairing...'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/disconnect/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Disconnect bot if active
        if (global.activeBots.has(sessionId)) {
            const bot = global.activeBots.get(sessionId);
            if (bot.socket) {
                await bot.socket.logout();
                await bot.socket.end();
            }
            global.activeBots.delete(sessionId);
        }
        
        // Update session status
        session.status = 'inactive';
        session.expiresAt = new Date();
        await session.save();
        
        // Log disconnect
        await Log.create({
            type: 'connection',
            sessionId,
            userId: session.userId,
            details: { action: 'disconnect', status: 'inactive' }
        });
        
        res.json({
            success: true,
            message: 'Bot disconnected successfully'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// WebSocket connection for real-time updates
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    socket.on('join-session', async (sessionId) => {
        socket.join(sessionId);
        const session = await Session.findOne({ sessionId });
        
        if (session) {
            socket.emit('session-update', {
                status: session.status,
                pairingCode: session.pairingCode
            });
        }
    });
    
    socket.on('request-pairing', async (phoneNumber) => {
        try {
            const pairingCode = await requestPairingCode(phoneNumber);
            socket.emit('pairing-code', { phoneNumber, pairingCode });
        } catch (error) {
            socket.emit('pairing-error', { error: error.message });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Serve Web Interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start all active sessions on server start
async function initializeActiveSessions() {
    try {
        const activeSessions = await Session.find({ 
            status: 'active',
            expiresAt: { $gt: new Date() }
        });
        
        console.log(`🔄 Initializing ${activeSessions.length} active sessions...`);
        
        for (const session of activeSessions) {
            try {
                await startBotForSession(session);
                console.log(`✅ Started bot for session: ${session.sessionId}`);
            } catch (error) {
                console.error(`❌ Failed to start session ${session.sessionId}:`, error.message);
                session.status = 'inactive';
                await session.save();
            }
        }
        
        console.log('✅ All active sessions initialized');
    } catch (error) {
        console.error('❌ Error initializing sessions:', error);
    }
}

// Pairing code generator
async function requestPairingCode(phoneNumber) {
    try {
        // This function needs to be implemented with Baileys
        // For now, we'll generate a random 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // In reality, you would use:
        // const code = await sock.requestPairingCode(phoneNumber);
        
        return code;
    } catch (error) {
        console.error('Error generating pairing code:', error);
        return null;
    }
}

// Start bot for a specific session
async function startBotForSession(session) {
    try {
        const bot = await createBotSession(session);
        
        if (bot) {
            global.activeBots.set(session.sessionId, bot);
            
            // Update session status
            session.status = 'active';
            session.connectionInfo.connectedAt = new Date();
            session.connectionInfo.lastSeen = new Date();
            await session.save();
            
            // Emit WebSocket event
            io.to(session.sessionId).emit('session-update', {
                status: 'connected',
                message: 'Bot is now active!'
            });
            
            // Log connection
            await Log.create({
                type: 'connection',
                sessionId: session.sessionId,
                userId: session.userId,
                details: { action: 'connect', status: 'active' }
            });
            
            console.log(`🤖 Bot started for ${session.phoneNumber}`);
            return bot;
        }
    } catch (error) {
        console.error(`❌ Error starting bot for session ${session.sessionId}:`, error);
        throw error;
    }
}

// Load commands
loadCommands();

// Start server
const PORT = config.port || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ${config.botName} Server running on port ${PORT}`);
    console.log(`👑 Developer: ${config.developer}`);
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    
    // Initialize active sessions
    setTimeout(() => initializeActiveSessions(), 2000);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    
    // Disconnect all active bots
    for (const [sessionId, bot] of global.activeBots.entries()) {
        try {
            if (bot.socket) {
                await bot.socket.logout();
                await bot.socket.end();
            }
        } catch (error) {
            console.error(`Error disconnecting session ${sessionId}:`, error);
        }
    }
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
    process.exit(0);
});
