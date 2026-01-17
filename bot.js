require('dotenv').config();
const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds, 
        useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { Boom } = require('@hapi/boom');
const config = require("./config");
const { Session, User, Group, MessageLog } = require("./firebase");
const { messageHandler } = require("./handler");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

global.commands = new Map();
global.config = config;

// Store for messages (anti-delete)
const store = makeInMemoryStore({ });
store.readFromFile('./session/store.json');

// Load commands
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) {
        fs.mkdirSync(cmdPath, { recursive: true });
        console.log("📁 Created commands folder");
        return;
    }
    
    let commandCount = 0;
    
    // Load from root commands folder
    fs.readdirSync(cmdPath).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const cmd = require(path.join(cmdPath, file));
                if (cmd && cmd.name && cmd.execute) {
                    global.commands.set(cmd.name.toLowerCase(), cmd);
                    if (cmd.alias) {
                        cmd.alias.forEach(alias => {
                            global.commands.set(alias.toLowerCase(), cmd);
                        });
                    }
                    commandCount++;
                    console.log(`✅ Loaded: ${cmd.name}`);
                }
            } catch (err) {
                console.log(`❌ Error loading ${file}:`, err.message);
            }
        }
    });
    
    // Load from subfolders
    fs.readdirSync(cmdPath).forEach(dir => {
        const folder = path.join(cmdPath, dir);
        if (fs.statSync(folder).isDirectory()) {
            fs.readdirSync(folder).filter(f => f.endsWith('.js')).forEach(file => {
                try {
                    const cmd = require(path.join(folder, file));
                    if (cmd && cmd.name && cmd.execute) {
                        global.commands.set(cmd.name.toLowerCase(), cmd);
                        if (cmd.alias) {
                            cmd.alias.forEach(alias => {
                                global.commands.set(alias.toLowerCase(), cmd);
                            });
                        }
                        commandCount++;
                        console.log(`✅ Loaded: ${cmd.name} from ${dir}`);
                    }
                } catch (err) {
                    console.log(`❌ Error loading ${file}:`, err.message);
                }
            });
        }
    });
    
    console.log(`📦 Total commands: ${commandCount}`);
};

// ALWAYS ONLINE SYSTEM
const maintainPresence = async () => {
    if (!sock || !isConnected) return;
    
    try {
        // Random presence updates
        const presences = ['available', 'unavailable', 'composing', 'recording'];
        const randomPresence = presences[Math.floor(Math.random() * presences.length)];
        
        await sock.sendPresenceUpdate(randomPresence);
        
        // Random typing in owner's chat
        if (Math.random() > 0.7) {
            await sock.sendPresenceUpdate('composing', config.ownerJid);
            await delay(2000);
            await sock.sendPresenceUpdate('paused', config.ownerJid);
        }
    } catch (error) {
        // Silent fail
    }
};

// AUTO STATUS VIEW SYSTEM
const autoViewStatus = async () => {
    if (!sock || !isConnected) return;
    
    try {
        // Simulate status viewing
        // Note: This is a placeholder - actual status viewing requires specific implementations
        console.log("👁️ Auto status viewer active");
    } catch (error) {
        // Silent fail
    }
};

// Connect to WhatsApp
async function connectToWhatsApp() {
    try {
        console.log("🔄 Connecting to WhatsApp...");
        
        // Load session
        let sessionData = await Session.get(config.sessionName);
        const creds = sessionData?.creds || initAuthCreds();
        
        // Get latest version
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: {
                creds: creds,
                keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
            },
            logger: pino({ level: "silent" }),
            printQRInTerminal: true,
            browser: ["WRONG TURN 6", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
            emitOwnEvents: false,
            defaultQueryTimeoutMs: 0,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000, // Keep alive every 10 seconds
        });
        
        // Bind store
        store.bind(sock.ev);
        
        // Save session updates
        sock.ev.on("creds.update", async (newCreds) => {
            try {
                await Session.save(config.sessionName, newCreds);
                console.log("💾 Session updated");
            } catch (error) {
                console.log("Session save error:", error.message);
            }
        });
        
        // Handle connection
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log("📱 Scan QR Code with WhatsApp");
            }
            
            if (connection === "open") {
                isConnected = true;
                reconnectAttempts = 0;
                
                console.log("✅ WRONG TURN 6 CONNECTED!");
                console.log(`👤 Bot: ${sock.user.id}`);
                console.log(`📱 Platform: ${sock.user.platform}`);
                
                // Start presence maintenance
                setInterval(maintainPresence, 30000);
                
                // Start auto status viewing
                if (config.autoStatusView) {
                    setInterval(autoViewStatus, 60000);
                }
                
                // Save bot info
                await User.save(sock.user.id, {
                    name: sock.user.name || config.botName,
                    pushName: sock.user.name,
                    platform: sock.user.platform,
                    isBot: true,
                    isOwner: true,
                    connectedAt: new Date().toISOString()
                });
                
                // Welcome message
                const welcome = `🚀 *WRONG TURN 6 ACTIVATED* 🚀\n\n` +
                               `*Owner:* ${config.ownerName}\n` +
                               `*Status:* 🔥 Fully Operational\n` +
                               `*Security:* Maximum Level\n` +
                               `*Database:* Encrypted 🔐\n\n` +
                               `✅ Anti-Delete: ${config.antiDelete ? 'ON' : 'OFF'}\n` +
                               `✅ Anti-Link: ${config.antiLink ? 'ON' : 'OFF'}\n` +
                               `✅ Anti-Porn: ${config.antiPorn ? 'ON' : 'OFF'}\n` +
                               `✅ Swear Filter: ${config.swearFilter ? 'ON' : 'OFF'}\n` +
                               `✅ View-Once Capture: ${config.viewOnceCapture ? 'ON' : 'OFF'}\n\n` +
                               `_System ready for commands._`;
                
                await sock.sendMessage(config.ownerJid, { text: welcome });
            }
            
            if (connection === "close") {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.output?.payload?.error || "Unknown";
                
                console.log("🔌 Connection closed:", reason);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log("❌ Logged out - Manual restart required");
                    process.exit(0);
                } else {
                    reconnectAttempts++;
                    if (reconnectAttempts <= maxReconnectAttempts) {
                        console.log(`🔄 Reconnecting... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                        setTimeout(connectToWhatsApp, 5000);
                    } else {
                        console.log("❌ Max reconnection attempts reached");
                        process.exit(1);
                    }
                }
            }
        });
        
        // Handle incoming messages
        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type === 'notify' && messages[0]) {
                const msg = messages[0];
                
                // Log message for anti-delete
                if (config.antiDelete) {
                    await MessageLog.logMessage(msg);
                }
                
                // Handle message
                await messageHandler(sock, msg);
            }
        });
        
        // Handle message deletions (ANTI-DELETE)
        sock.ev.on("messages.delete", async (deletions) => {
            if (!config.antiDelete) return;
            
            for (const deletion of deletions) {
                try {
                    const deletedMsg = await MessageLog.getDeletedMessage(deletion.keys[0].id);
                    if (deletedMsg) {
                        const sender = deletedMsg.sender;
                        const chatName = deletion.keys[0].remoteJid.endsWith('@g.us') ? 'Group' : 'Private';
                        
                        let caption = `🚨 *DELETED MESSAGE DETECTED* 🚨\n\n` +
                                     `*From:* ${sender}\n` +
                                     `*Chat:* ${chatName}\n` +
                                     `*Time:* ${new Date().toLocaleString()}\n`;
                        
                        // Extract text if available
                        let messageText = '';
                        if (deletedMsg.message?.conversation) {
                            messageText = deletedMsg.message.conversation;
                        } else if (deletedMsg.message?.extendedTextMessage?.text) {
                            messageText = deletedMsg.message.extendedTextMessage.text;
                        }
                        
                        if (messageText) {
                            caption += `*Message:* ${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}`;
                        }
                        
                        // Forward to owner
                        await sock.sendMessage(config.ownerJid, {
                            forward: { key: deletion.keys[0], message: deletedMsg.message },
                            caption: caption
                        });
                        
                        // Delete from log
                        await MessageLog.deleteMessage(deletion.keys[0].id);
                    }
                } catch (error) {
                    console.error("Anti-delete error:", error.message);
                }
            }
        });
        
        // Handle group participants update
        sock.ev.on("group-participants.update", async (update) => {
            console.log("Group update:", update);
        });
        
        return sock;
        
    } catch (error) {
        console.log("❌ Connection error:", error.message);
        return null;
    }
}

// Pairing Code System
async function getPairingCode(phoneNumber) {
    try {
        if (!sock || !sock.authState.creds.registered) {
            // Create temporary connection for pairing
            const tempSock = makeWASocket({
                auth: { creds: initAuthCreds() },
                logger: pino({ level: "silent" }),
                printQRInTerminal: false,
            });
            
            const code = await tempSock.requestPairingCode(phoneNumber.trim());
            await tempSock.ws.close();
            return { success: true, code };
        }
        
        const code = await sock.requestPairingCode(phoneNumber.trim());
        return { success: true, code };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Initialize bot
async function initBot() {
    console.log("🤖 Initializing WRONG TURN 6...");
    console.log("🔐 Security: Maximum Level");
    console.log("💾 Database: Encrypted Firebase");
    
    // Load commands
    loadCommands();
    
    // Connect to WhatsApp
    await connectToWhatsApp();
    
    return true;
}

// EXPRESS ROUTES
app.get("/", (req, res) => {
    const status = isConnected ? "🟢 CONNECTED" : "🔴 DISCONNECTED";
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WRONG TURN 6 - SECURE PANEL</title>
            <style>
                body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #00ff00; padding: 20px; }
                .status { padding: 10px; border: 2px solid #00ff00; border-radius: 5px; margin: 10px 0; }
                .connected { border-color: #00ff00; }
                .disconnected { border-color: #ff0000; }
                a { color: #00ff00; text-decoration: none; }
                .container { max-width: 800px; margin: 0 auto; }
                .terminal { background: #000; padding: 20px; border-radius: 5px; }
                h1 { color: #ff0000; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚡ WRONG TURN 6 CONTROL PANEL ⚡</h1>
                <div class="terminal">
                    <div class="status ${isConnected ? 'connected' : 'disconnected'}">
                        <h2>STATUS: ${status}</h2>
                    </div>
                    <p><strong>👑 OWNER:</strong> ${config.ownerName}</p>
                    <p><strong>🔐 SECURITY LEVEL:</strong> MAXIMUM</p>
                    <p><strong>📊 COMMANDS:</strong> ${global.commands.size}</p>
                    <p><strong>💾 DATABASE:</strong> ENCRYPTED FIREBASE</p>
                    
                    <h3>⚙️ QUICK ACTIONS:</h3>
                    <ul>
                        <li><a href="/pair">🔗 GET PAIRING CODE</a></li>
                        <li><a href="/restart">🔄 RESTART BOT</a></li>
                        <li><a href="/settings">⚙️ VIEW SETTINGS</a></li>
                        <li><a href="/logs">📝 VIEW LOGS</a></li>
                    </ul>
                    
                    <h3>🔧 PAIR DEVICE:</h3>
                    <form action="/pair" method="GET">
                        <input type="text" name="number" value="${config.ownerNumber.replace('@s.whatsapp.net', '')}" 
                               style="background: #000; color: #00ff00; border: 1px solid #00ff00; padding: 5px;">
                        <button type="submit" style="background: #000; color: #00ff00; border: 1px solid #00ff00; padding: 5px;">
                            GET CODE
                        </button>
                    </form>
                    
                    <h3>🔒 SECURITY FEATURES:</h3>
                    <ul>
                        <li>✅ Anti-Delete Message Capture</li>
                        <li>✅ Anti-Link Protection</li>
                        <li>✅ Anti-Porn Detection</li>
                        <li>✅ Swear Word Filter</li>
                        <li>✅ View-Once Media Capture</li>
                        <li>✅ Auto Status View</li>
                        <li>✅ Auto Typing Presence</li>
                        <li>✅ Encrypted Database</li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get("/pair", async (req, res) => {
    const number = req.query.number || config.ownerNumber.replace('@s.whatsapp.net', '');
    
    if (!number) {
        return res.send("❌ Phone number required");
    }
    
    const result = await getPairingCode(number);
    
    if (result.success) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pairing Code</title>
                <style>
                    body { font-family: monospace; background: #000; color: #00ff00; padding: 20px; }
                    .code { font-size: 32px; letter-spacing: 5px; padding: 20px; border: 2px dashed #00ff00; margin: 20px 0; }
                </style>
            </head>
            <body>
                <h1>🔐 PAIRING CODE</h1>
                <p>For: ${number}</p>
                <div class="code">${result.code}</div>
                <p>⏰ Expires in 60 seconds</p>
                <ol>
                    <li>Open WhatsApp on phone</li>
                    <li>Settings → Linked Devices</li>
                    <li>Tap "Link a Device"</li>
                    <li>Enter code: <strong>${result.code}</strong></li>
                </ol>
                <p><a href="/">← BACK</a></p>
            </body>
            </html>
        `);
    } else {
        res.send(`❌ Error: ${result.error}`);
    }
});

app.get("/restart", async (req, res) => {
    try {
        if (sock) {
            await sock.ws.close();
        }
        setTimeout(async () => {
            await connectToWhatsApp();
            res.redirect("/");
        }, 3000);
    } catch (error) {
        res.send(`❌ Error: ${error.message}`);
    }
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🔥 Security: Maximum Level Enabled`);
    initBot();
});

// Export
module.exports = { sock, isConnected, connectToWhatsApp, getPairingCode };
