// LIVE BOT CODE - RUNNING NOW ON RENDER.COM
const express = require('express');
const mongoose = require('mongoose');
const { default: makeWASocket, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");

// CONFIG
const MONGO_URI = "mongodb+srv://stanytz076:stanytz076@cluster0.ennpt6t.mongodb.net/WrongTurn6";
const PORT = process.env.PORT || 3001;

// APP
const app = express();
app.use(express.json());

// DATABASE
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err.message));

const Session = mongoose.model('Session', {
    phone: String,
    code: String,
    status: { type: String, default: 'pending' },
    joined: { type: Boolean, default: false },
    creds: Object
});

// ACTIVE BOTS
const activeBots = new Map();

// WEB PAGE
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WRONG TURN 6 LIVE</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #000; color: #fff; font-family: 'Arial', sans-serif; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
            .container { background: #111; border-radius: 20px; border: 3px solid #ff0000; padding: 30px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 0 30px rgba(255,0,0,0.3); }
            h1 { color: #ff0000; font-size: 28px; margin-bottom: 10px; }
            .subtitle { color: #888; margin-bottom: 30px; }
            input { width: 100%; padding: 15px; margin: 10px 0; background: #222; border: 1px solid #333; color: #fff; border-radius: 10px; font-size: 16px; text-align: center; }
            button { width: 100%; padding: 15px; margin: 10px 0; background: #ff0000; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
            button:hover { background: #cc0000; }
            .code { font-size: 48px; font-weight: bold; letter-spacing: 15px; margin: 20px 0; padding: 20px; background: rgba(255,0,0,0.1); border-radius: 15px; border: 2px dashed #333; }
            .status { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 20px 0; }
            .dot { width: 12px; height: 12px; background: #666; border-radius: 50%; }
            .dot.active { background: #00ff00; box-shadow: 0 0 10px #00ff00; }
            .links { margin: 20px 0; }
            .links a { color: #ff0000; text-decoration: none; margin: 0 10px; }
            .info { color: #666; font-size: 12px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>WRONG TURN 6</h1>
            <p class="subtitle">Developer: STANYTZ | LIVE BOT</p>
            
            <input type="text" id="phone" placeholder="255618558502" maxlength="15">
            
            <button onclick="getCode()">GET PAIRING CODE</button>
            <button onclick="startBot()" style="background: #333;">START BOT</button>
            
            <div id="code" class="code">------</div>
            
            <div class="status">
                <div class="dot" id="statusDot"></div>
                <span id="statusText">Not Connected</span>
            </div>
            
            <div class="links">
                <a href="https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y" target="_blank">JOIN GROUP</a>
                <a href="https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p" target="_blank">JOIN CHANNEL</a>
            </div>
            
            <p class="info">Must join group & channel to use bot commands</p>
        </div>
        
        <script>
            let sessionId = '';
            let phoneNumber = '';
            let pairingCode = '';
            
            async function getCode() {
                const phone = document.getElementById('phone').value.trim().replace(/\\D/g, '');
                if (phone.length < 10) {
                    alert('Please enter a valid phone number (10+ digits)');
                    return;
                }
                
                document.getElementById('code').textContent = 'GENERATING...';
                
                try {
                    const response = await fetch('/api/code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        phoneNumber = phone;
                        sessionId = data.sessionId;
                        pairingCode = data.code;
                        
                        document.getElementById('code').textContent = data.code;
                        
                        // Auto copy to clipboard
                        navigator.clipboard.writeText(data.code);
                        alert('✅ Pairing code copied!\\n\\nOpen WhatsApp → Linked Devices → Link a Device → Enter this code');
                    } else {
                        document.getElementById('code').textContent = 'ERROR';
                        alert(data.error || 'Failed to generate code');
                    }
                } catch (error) {
                    document.getElementById('code').textContent = 'ERROR';
                    alert('Server error. Please try again.');
                }
            }
            
            async function startBot() {
                if (!sessionId || !phoneNumber) {
                    alert('Please generate a pairing code first!');
                    return;
                }
                
                try {
                    const response = await fetch('/api/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: sessionId,
                            phone: phoneNumber,
                            code: pairingCode
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        document.getElementById('statusDot').classList.add('active');
                        document.getElementById('statusText').textContent = 'Connecting...';
                        alert('✅ Bot is connecting! Please wait...');
                        
                        // Check status every 3 seconds
                        checkBotStatus();
                    } else {
                        alert(data.error || 'Failed to start bot');
                    }
                } catch (error) {
                    alert('Connection error. Please try again.');
                }
            }
            
            async function checkBotStatus() {
                if (!phoneNumber) return;
                
                try {
                    const response = await fetch('/api/status/' + phoneNumber);
                    const data = await response.json();
                    
                    if (data.connected) {
                        document.getElementById('statusDot').classList.add('active');
                        document.getElementById('statusText').textContent = 'Connected ✅';
                        alert('🎉 BOT IS NOW ACTIVE!\\n\\nCheck your WhatsApp for welcome message.');
                    } else {
                        setTimeout(checkBotStatus, 3000);
                    }
                } catch (error) {
                    setTimeout(checkBotStatus, 3000);
                }
            }
            
            // Auto-focus input
            document.getElementById('phone').focus();
        </script>
    </body>
    </html>
    `);
});

// API ROUTES
app.post('/api/code', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || phone.length < 10) {
            return res.status(400).json({ error: 'Valid phone number required' });
        }
        
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = `wt6_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await Session.create({
            phone: phone,
            code: code,
            sessionId: sessionId,
            status: 'pending'
        });
        
        res.json({
            success: true,
            sessionId: sessionId,
            code: code,
            message: 'Pairing code generated'
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/start', async (req, res) => {
    try {
        const { sessionId, phone, code } = req.body;
        
        const session = await Session.findOne({ sessionId, phone, code });
        if (!session) {
            return res.status(404).json({ error: 'Invalid session' });
        }
        
        // Update session
        session.status = 'active';
        session.joined = true;
        await session.save();
        
        // Start bot
        const bot = await createBot(session);
        
        if (bot) {
            res.json({ success: true, message: 'Bot started successfully' });
        } else {
            res.status(500).json({ error: 'Failed to start bot' });
        }
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status/:phone', (req, res) => {
    const phone = req.params.phone;
    const isConnected = activeBots.has(phone);
    res.json({ connected: isConnected, phone: phone });
});

app.get('/api/info', (req, res) => {
    res.json({
        bot: 'WRONG TURN 6',
        developer: 'STANYTZ',
        version: '6.0.0',
        status: 'online',
        activeBots: activeBots.size,
        uptime: process.uptime()
    });
});

// BOT CREATION
async function createBot(sessionData) {
    try {
        console.log(`🚀 Creating bot for: ${sessionData.phone}`);
        
        const creds = sessionData.creds || initAuthCreds();
        
        const sock = makeWASocket({
            auth: {
                creds: creds,
                keys: makeCacheableSignalKeyStore(creds, { level: "fatal" })
            },
            logger: { level: "fatal" },
            printQRInTerminal: false,
            browser: ["WRONG TURN 6", "Chrome", "3.0"],
            syncFullHistory: false
        });
        
        sock.ev.on("creds.update", async (updatedCreds) => {
            try {
                await Session.findOneAndUpdate(
                    { phone: sessionData.phone },
                    { creds: updatedCreds }
                );
            } catch (e) {
                console.error('Error saving creds:', e.message);
            }
        });
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "open") {
                console.log(`✅ Bot connected: ${sessionData.phone}`);
                
                // Update session
                await Session.findOneAndUpdate(
                    { phone: sessionData.phone },
                    { status: 'connected' }
                );
                
                // Send welcome message
                const welcome = `🚀 *WRONG TURN 6 IS NOW ACTIVE* 🚀\n\n` +
                    `Welcome to *WRONG TURN 6*\n` +
                    `Developer: *STANYTZ*\n\n` +
                    `📱 Your Number: ${sessionData.phone}\n` +
                    `⚡ Prefix: .\n\n` +
                    `Type *.menu* to see available commands\n\n` +
                    `📢 Stay connected:\n` +
                    `• Group: https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y\n` +
                    `• Channel: https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p`;
                
                try {
                    await sock.sendMessage(sock.user.id, { text: welcome });
                } catch (e) {
                    console.error('Error sending welcome:', e.message);
                }
            }
            
            if (connection === "close") {
                console.log(`❌ Bot disconnected: ${sessionData.phone}`);
                activeBots.delete(sessionData.phone);
                
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    setTimeout(async () => {
                        const session = await Session.findOne({ phone: sessionData.phone, status: 'active' });
                        if (session) {
                            await createBot(session);
                        }
                    }, 10000);
                }
            }
        });
        
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (msg.key.fromMe) return;
            
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            
            if (text.startsWith('.menu')) {
                const menu = `*WRONG TURN 6 MENU*\n\n👑 Developer: STANYTZ\n📱 Your Number: ${sessionData.phone}\n⚡ Prefix: .\n\n` +
                    `*Commands:*\n• .menu - Show this menu\n• .ping - Check bot status\n• .owner - Contact owner\n• .help - Get help`;
                
                await sock.sendMessage(msg.key.remoteJid, { text: menu });
            }
            else if (text.startsWith('.ping')) {
                await sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pong! Bot is active and working.' });
            }
            else if (text.startsWith('.owner')) {
                await sock.sendMessage(msg.key.remoteJid, { text: '👑 Owner: STANYTZ\n📞 Contact: 255618558502\n📧 Email: stanytz@proton.me' });
            }
            else if (text.startsWith('.help')) {
                await sock.sendMessage(msg.key.remoteJid, { 
                    text: 'Need help? Contact the developer directly:\n\nWhatsApp: 255618558502\nOr join our group for support.' 
                });
            }
        });
        
        activeBots.set(sessionData.phone, { socket: sock, connectedAt: new Date() });
        return true;
        
    } catch (error) {
        console.error(`Error creating bot:`, error.message);
        return false;
    }
}

// START SERVER
const server = app.listen(PORT, () => {
    console.log(`🚀 WRONG TURN 6 LIVE BOT`);
    console.log(`👑 Developer: STANYTZ`);
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`📱 Active Bots: ${activeBots.size}`);
    console.log(`⚡ Status: ONLINE`);
});

// ERROR HANDLING
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is busy. Trying ${PORT + 1}...`);
        app.listen(PORT + 1);
    } else {
        console.error('Server error:', error.message);
    }
});

// START EXISTING SESSIONS
setTimeout(async () => {
    try {
        const sessions = await Session.find({ status: 'active' });
        console.log(`🔄 Starting ${sessions.length} existing sessions...`);
        
        for (const session of sessions) {
            try {
                await createBot(session);
                console.log(`✅ Started: ${session.phone}`);
            } catch (e) {
                console.log(`❌ Failed: ${session.phone}`);
            }
        }
    } catch (e) {
        console.log('No existing sessions');
    }
}, 2000);
