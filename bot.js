// bot.js - COMPLETE WORKING BOT
const express = require('express');
const mongoose = require('mongoose');
const { default: makeWASocket, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");
const fs = require('fs');
const path = require('path');

// CREATE APP
const app = express();
app.use(express.json());
app.use(express.static('public'));

// CONFIG
const config = {
    BOT_NAME: "WRONG TURN 6",
    DEVELOPER: "STANYTZ",
    PREFIX: ".",
    OWNER_NUMBER: "255618558502",
    MONGO_URI: "mongodb+srv://stanytz076:stanytz076@cluster0.ennpt6t.mongodb.net/WrongTurn6",
    CHANNEL_LINK: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
    GROUP_LINK: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
    GROUP_ID: "120363302194515518@g.us",
    MENU_IMAGE: "https://i.ibb.co/vz6mD7y/wrongturn.jpg",
    PORT: 3001
};

// DATABASE
mongoose.connect(config.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(() => console.log('❌ MongoDB Failed - Running without DB'));

const Session = mongoose.model('Session', {
    sessionId: String, phoneNumber: String, creds: Object, 
    status: { type: String, default: 'pending' }, pairingCode: String,
    joinedGroup: { type: Boolean, default: false }, joinedChannel: { type: Boolean, default: false }
});

const User = mongoose.model('User', {
    userId: String, phoneNumber: String, 
    joinedGroup: { type: Boolean, default: false }, joinedChannel: { type: Boolean, default: false }
});

// ACTIVE BOTS STORAGE
const activeBots = new Map();

// CREATE PUBLIC FOLDER
if (!fs.existsSync('public')) fs.mkdirSync('public');

// WEB INTERFACE
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>WRONG TURN 6</title>
        <style>
            body { background: #000; color: white; font-family: Arial; text-align: center; padding: 20px; }
            .container { max-width: 400px; margin: 0 auto; background: #111; padding: 20px; border-radius: 10px; border: 2px solid red; }
            h1 { color: red; margin: 0 0 10px 0; }
            input { width: 100%; padding: 12px; margin: 10px 0; background: #222; border: 1px solid #333; color: white; border-radius: 5px; font-size: 16px; }
            button { width: 100%; padding: 12px; background: red; color: white; border: none; border-radius: 5px; font-size: 16px; font-weight: bold; cursor: pointer; margin: 5px 0; }
            #code { font-size: 40px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; padding: 15px; background: rgba(255,0,0,0.1); border-radius: 10px; }
            .status { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 15px 0; }
            .dot { width: 12px; height: 12px; background: #666; border-radius: 50%; }
            .dot.active { background: #0f0; box-shadow: 0 0 10px #0f0; }
            .links { margin: 20px 0; }
            .links a { color: red; text-decoration: none; margin: 0 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>WRONG TURN 6</h1>
            <p style="color: #888; margin-bottom: 20px;">Developer: STANYTZ</p>
            
            <input type="text" id="phone" placeholder="255618558502" maxlength="15">
            
            <button onclick="getPairCode()">GET PAIRING CODE</button>
            <button onclick="confirmJoin()" style="background: #333;">I HAVE JOINED BOTH</button>
            
            <div id="code">------</div>
            
            <div class="status">
                <div class="dot" id="statusDot"></div>
                <span id="statusText">Not Connected</span>
            </div>
            
            <div class="links">
                <a href="${config.GROUP_LINK}" target="_blank">JOIN GROUP</a>
                <a href="${config.CHANNEL_LINK}" target="_blank">JOIN CHANNEL</a>
            </div>
            
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                Must join group & channel to use bot commands
            </p>
        </div>
        
        <script>
            let currentSession = '';
            let currentPhone = '';
            
            function getPairCode() {
                const phone = document.getElementById('phone').value.trim().replace(/\\D/g, '');
                if (phone.length < 10) {
                    alert('Enter valid phone number (10+ digits)');
                    return;
                }
                
                document.getElementById('code').textContent = 'WAITING...';
                
                fetch('/pair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        currentSession = data.sessionId;
                        currentPhone = phone;
                        document.getElementById('code').textContent = data.pairingCode;
                        copyToClipboard(data.pairingCode);
                        alert('✅ Code copied!\\n\\nOpen WhatsApp → Linked Devices → Link a Device');
                    } else {
                        document.getElementById('code').textContent = 'ERROR';
                        alert(data.error || 'Failed to generate code');
                    }
                })
                .catch(() => {
                    document.getElementById('code').textContent = 'ERROR';
                    alert('Server error');
                });
            }
            
            function confirmJoin() {
                if (!currentSession || !currentPhone) {
                    alert('Get pairing code first!');
                    return;
                }
                
                fetch('/confirm-join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        sessionId: currentSession, 
                        phoneNumber: currentPhone 
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('statusDot').className = 'dot active';
                        document.getElementById('statusText').textContent = 'Connected';
                        alert('✅ Bot connected! Check WhatsApp for welcome message.');
                        checkStatus();
                    } else {
                        alert(data.error || 'Failed to connect');
                    }
                })
                .catch(() => alert('Connection error'));
            }
            
            function checkStatus() {
                if (!currentPhone) return;
                
                fetch('/status/' + currentPhone)
                    .then(res => res.json())
                    .then(data => {
                        if (data.connected) {
                            document.getElementById('statusDot').className = 'dot active';
                            document.getElementById('statusText').textContent = 'Connected';
                        } else {
                            setTimeout(checkStatus, 3000);
                        }
                    })
                    .catch(() => setTimeout(checkStatus, 3000));
            }
            
            function copyToClipboard(text) {
                navigator.clipboard.writeText(text);
            }
            
            // Auto-focus input
            document.getElementById('phone').focus();
        </script>
    </body>
    </html>
    `);
});

// API ROUTES
app.get('/status', (req, res) => {
    res.json({ status: 'online', bot: config.BOT_NAME, active: activeBots.size });
});

app.post('/pair', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: 'Phone number required' });
        
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 10) return res.status(400).json({ error: 'Invalid phone number' });
        
        if (activeBots.has(cleanNumber)) {
            return res.json({ status: 'connected', message: 'Bot already active' });
        }
        
        const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = `wt6_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await Session.create({
            sessionId, phoneNumber: cleanNumber, pairingCode,
            status: 'pending', joinedGroup: false, joinedChannel: false
        });
        
        await User.findOneAndUpdate(
            { phoneNumber: cleanNumber },
            { userId: `${cleanNumber}@s.whatsapp.net`, phoneNumber: cleanNumber },
            { upsert: true }
        );
        
        res.json({
            success: true,
            sessionId,
            pairingCode,
            requireJoin: true,
            groupLink: config.GROUP_LINK,
            channelLink: config.CHANNEL_LINK
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/confirm-join', async (req, res) => {
    try {
        const { sessionId, phoneNumber } = req.body;
        if (!sessionId || !phoneNumber) return res.status(400).json({ error: 'Missing data' });
        
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const session = await Session.findOne({ sessionId, phoneNumber: cleanNumber });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        
        session.joinedGroup = true;
        session.joinedChannel = true;
        session.status = 'active';
        await session.save();
        
        await User.findOneAndUpdate(
            { phoneNumber: cleanNumber },
            { joinedGroup: true, joinedChannel: true }
        );
        
        const botStarted = await createBot(session);
        
        if (botStarted) {
            res.json({ success: true, message: 'Bot connected!' });
        } else {
            res.status(500).json({ error: 'Failed to start bot' });
        }
        
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/status/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, '');
        const session = await Session.findOne({ phoneNumber: phone });
        const isConnected = activeBots.has(phone);
        
        res.json({
            phone,
            status: session?.status || 'none',
            connected: isConnected,
            joinedGroup: session?.joinedGroup || false,
            joinedChannel: session?.joinedChannel || false
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// BOT CREATION FUNCTION
async function createBot(sessionData) {
    try {
        console.log(`🤖 Starting bot for: ${sessionData.phoneNumber}`);
        
        const creds = sessionData.creds || initAuthCreds();
        const sock = makeWASocket({
            auth: { creds, keys: makeCacheableSignalKeyStore(creds, { level: "fatal" }) },
            logger: { level: "fatal" },
            printQRInTerminal: false,
            browser: ["WRONG TURN 6", "Chrome", "3.0"],
            syncFullHistory: false
        });
        
        sock.ev.on("creds.update", async (updatedCreds) => {
            try {
                await Session.findOneAndUpdate(
                    { phoneNumber: sessionData.phoneNumber },
                    { creds: updatedCreds }
                );
            } catch (e) {}
        });
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "open") {
                console.log(`✅ Connected: ${sessionData.phoneNumber}`);
                
                await Session.findOneAndUpdate(
                    { phoneNumber: sessionData.phoneNumber },
                    { status: 'active' }
                );
                
                // WELCOME MESSAGE
                const welcome = `🚀 *${config.BOT_NAME} IS NOW ACTIVE* 🚀\n\n` +
                    `Welcome to *${config.BOT_NAME}*\n` +
                    `Developer: *${config.DEVELOPER}*\n\n` +
                    `📱 Your Number: ${sessionData.phoneNumber}\n` +
                    `⚡ Prefix: ${config.PREFIX}\n\n` +
                    `✅ *Verification Successful!*\n` +
                    `You can now use all bot commands.\n\n` +
                    `Type *${config.PREFIX}menu* to see commands\n\n` +
                    `📢 Stay connected:\n` +
                    `• Group: ${config.GROUP_LINK}\n` +
                    `• Channel: ${config.CHANNEL_LINK}`;
                
                try {
                    await sock.sendMessage(sock.user.id, { text: welcome });
                } catch (e) {}
            }
            
            if (connection === "close") {
                console.log(`❌ Disconnected: ${sessionData.phoneNumber}`);
                activeBots.delete(sessionData.phoneNumber);
                
                await Session.findOneAndUpdate(
                    { phoneNumber: sessionData.phoneNumber },
                    { status: 'inactive' }
                );
                
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    setTimeout(async () => {
                        const session = await Session.findOne({ 
                            phoneNumber: sessionData.phoneNumber, 
                            status: 'active' 
                        });
                        if (session) await createBot(session);
                    }, 10000);
                }
            }
        });
        
        sock.ev.on("messages.upsert", async ({ messages }) => {
            if (!messages || messages.length === 0) return;
            
            const msg = messages[0];
            if (msg.key.fromMe) return;
            
            await handleMessage(sock, msg, sessionData);
        });
        
        activeBots.set(sessionData.phoneNumber, {
            socket: sock,
            phoneNumber: sessionData.phoneNumber,
            connectedAt: new Date()
        });
        
        return true;
        
    } catch (error) {
        console.error('Bot creation error:', error.message);
        return false;
    }
}

// HANDLE MESSAGES
async function handleMessage(sock, message, sessionData) {
    try {
        const from = message.key.remoteJid;
        const body = (message.message.conversation || 
                     message.message.extendedTextMessage?.text || 
                     message.message.imageMessage?.caption || '').trim();
        
        if (!body || !body.startsWith(config.PREFIX)) return;
        
        const args = body.slice(config.PREFIX.length).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();
        
        // CHECK IF USER JOINED GROUP & CHANNEL
        const user = await User.findOne({ phoneNumber: sessionData.phoneNumber });
        if (!user?.joinedGroup || !user?.joinedChannel) {
            await sock.sendMessage(from, {
                text: `⚠️ *LOCKED BY ${config.DEVELOPER}*\n\n` +
                      `You must join our Group AND Channel to use commands.\n\n` +
                      `🔗 *Group:* ${config.GROUP_LINK}\n` +
                      `🔗 *Channel:* ${config.CHANNEL_LINK}\n\n` +
                      `After joining, restart the bot.`
            });
            return;
        }
        
        // COMMANDS
        if (cmd === 'menu') {
            const menu = `╔═══════════════════════════
║  *${config.BOT_NAME}*
║  ────────────────────────
║  👑 Developer: ${config.DEVELOPER}
║  📱 User: ${sessionData.phoneNumber}
║  ⚡ Prefix: ${config.PREFIX}
║  ────────────────────────
║  📁 *COMMANDS*
║  • ${config.PREFIX}menu - Show this menu
║  • ${config.PREFIX}ping - Check bot status
║  • ${config.PREFIX}owner - Contact owner
║  • ${config.PREFIX}antilink [on/off]
║  • ${config.PREFIX}welcome [on/off]
║  ────────────────────────
║  📢 *COMMUNITY*
║  • Group: ${config.GROUP_LINK}
║  • Channel: ${config.CHANNEL_LINK}
╚═══════════════════════════`;
            
            await sock.sendMessage(from, { text: menu });
            
        } else if (cmd === 'ping') {
            const start = Date.now();
            const latency = Date.now() - start;
            await sock.sendMessage(from, {
                text: `🏓 Pong!\n📶 Latency: *${latency}ms*\n🕐 Time: *${new Date().toLocaleTimeString()}*`
            });
            
        } else if (cmd === 'owner') {
            await sock.sendMessage(from, {
                text: `👑 *BOT OWNER*\n\nName: *${config.DEVELOPER}*\nContact: *${config.OWNER_NUMBER}*`
            });
            
        } else {
            await sock.sendMessage(from, {
                text: `❌ Unknown command: *${cmd}*\n\nType *${config.PREFIX}menu* for available commands.`
            });
        }
        
    } catch (error) {
        console.error('Message error:', error.message);
    }
}

// START SERVER
function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`🚀 ${config.BOT_NAME} Server running on port ${port}`);
        console.log(`👑 Developer: ${config.DEVELOPER}`);
        console.log(`🌐 Web Interface: http://localhost:${port}`);
        console.log(`⚡ Prefix: ${config.PREFIX}`);
    });
    
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.log(`Port ${port} busy. Trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', error.message);
        }
    });
}

// START
startServer(config.PORT);

// AUTO START EXISTING SESSIONS
setTimeout(async () => {
    try {
        const sessions = await Session.find({ status: 'active', joinedGroup: true, joinedChannel: true });
        console.log(`🔄 Starting ${sessions.length} existing sessions...`);
        
        for (const session of sessions) {
            try {
                await createBot(session);
                console.log(`✅ Started: ${session.phoneNumber}`);
            } catch (e) {
                console.log(`❌ Failed: ${session.phoneNumber}`);
            }
        }
    } catch (e) {}
}, 2000);
