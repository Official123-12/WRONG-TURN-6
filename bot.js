const { default: makeWASocket, delay, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { Session, User, Group } = require("./firebase");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let sock = null;
let isConnected = false;
global.commands = new Map();
global.config = config;

// LOAD COMMANDS PROPERLY
function loadCommands() {
    console.log("📂 Loading commands...");
    const commandsDir = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsDir)) {
        console.log("⚠️  Commands directory not found, creating...");
        fs.mkdirSync(commandsDir, { recursive: true });
        
        // Create sample commands
        const sampleCommands = {
            'menu.js': `module.exports = {
                name: "menu",
                alias: ["help", "cmd"],
                async execute(sock, msg, args) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: "⚡ *WRONG TURN 6 BOT* ⚡\\n\\n" +
                              "*Owner:* STANYTZ\\n" +
                              "*Prefix:* .\\n\\n" +
                              "*Commands loaded:* " + global.commands.size
                    });
                }
            };`,
            
            'ping.js': `module.exports = {
                name: "ping",
                async execute(sock, msg, args) {
                    const start = Date.now();
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: "🏓 *PONG!*\\nLatency: " + (Date.now() - start) + "ms"
                    });
                }
            };`
        };
        
        Object.entries(sampleCommands).forEach(([filename, content]) => {
            fs.writeFileSync(path.join(commandsDir, filename), content);
        });
        
        console.log("✅ Created sample commands");
    }
    
    // Clear existing commands
    global.commands.clear();
    
    // Function to load commands recursively
    function loadFromDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Load from subdirectory
                loadFromDirectory(fullPath);
            } else if (item.endsWith('.js')) {
                try {
                    // Clear require cache
                    delete require.cache[require.resolve(fullPath)];
                    
                    const command = require(fullPath);
                    
                    if (command && command.name && typeof command.execute === 'function') {
                        global.commands.set(command.name.toLowerCase(), command);
                        
                        // Add aliases
                        if (command.alias && Array.isArray(command.alias)) {
                            command.alias.forEach(alias => {
                                global.commands.set(alias.toLowerCase(), command);
                            });
                        }
                        
                        console.log(`✅ Loaded: ${command.name} from ${path.relative(commandsDir, dir) || 'root'}`);
                    }
                } catch (error) {
                    console.log(`❌ Error loading ${item}:`, error.message);
                }
            }
        });
    }
    
    loadFromDirectory(commandsDir);
    console.log(`📦 Total commands loaded: ${global.commands.size}`);
}

// CONNECT TO WHATSAPP (NO MORE RECONNECT LOOP)
async function connectToWhatsApp() {
    try {
        console.log("🔄 Attempting WhatsApp connection...");
        
        // Create session directory if not exists
        const sessionDir = './session';
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Try to load session from Firebase
        let savedSession = await Session.get(config.sessionName);
        
        // Use multi-file auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Restore from Firebase if available
        if (savedSession?.creds) {
            console.log("📡 Restoring session from Firebase...");
            state.creds = savedSession.creds;
        }
        
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "error" }),
            printQRInTerminal: true,
            browser: ["WRONG TURN 6", "Chrome", "20.0.04"],
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });
        
        // Handle credentials update
        sock.ev.on("creds.update", async (creds) => {
            try {
                await saveCreds();
                await Session.save(config.sessionName, { creds });
            } catch (error) {
                console.log("❌ Creds save error:", error.message);
            }
        });
        
        // Handle connection
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log("📱 QR Code ready - Scan with WhatsApp");
            }
            
            if (connection === "open") {
                isConnected = true;
                console.log("✅ WHATSAPP CONNECTED!");
                console.log(`👤 Bot ID: ${sock.user.id}`);
                console.log(`📱 Phone: ${sock.user.phone}`);
                console.log(`📛 Name: ${sock.user.name}`);
                
                // Set always online presence
                setInterval(async () => {
                    if (sock && isConnected) {
                        try {
                            // Random presence updates
                            const presences = ['available', 'composing', 'recording'];
                            const randomPresence = presences[Math.floor(Math.random() * presences.length)];
                            await sock.sendPresenceUpdate(randomPresence);
                        } catch (e) {
                            // Silent fail
                        }
                    }
                }, 30000);
                
                // Save bot info
                await User.save(sock.user.id, {
                    name: sock.user.name || config.botName,
                    phone: sock.user.phone,
                    isBot: true,
                    isOwner: true,
                    connectedAt: new Date().toISOString(),
                    pushName: sock.user.name
                });
                
                // Welcome message
                const welcome = `🚀 *WRONG TURN 6 ACTIVATED*\n\n` +
                               `*Status:* Connected ✅\n` +
                               `*User:* ${sock.user.name || config.botName}\n` +
                               `*Phone:* ${sock.user.phone}\n` +
                               `*Security:* Maximum Level 🔥\n\n` +
                               `_System ready for commands_`;
                
                await sock.sendMessage(config.ownerJid, { text: welcome });
            }
            
            if (connection === "close") {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                console.log("🔌 Connection closed, status code:", statusCode);
                
                // Don't auto-reconnect immediately, wait for manual restart
                console.log("⏸️  Waiting for manual restart...");
            }
        });
        
        // Handle messages
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (msg) {
                await handleMessage(msg);
            }
        });
        
        // Handle status updates
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (msg?.key?.remoteJid === 'status@broadcast') {
                await handleStatusUpdate(msg);
            }
        });
        
    } catch (error) {
        console.log("❌ Connection error:", error.message);
        // Don't auto-reconnect, wait for manual restart
    }
}

// Handle status updates
async function handleStatusUpdate(msg) {
    try {
        await sock.readMessages([msg.key]);
        
        // React to status
        const reactions = ['❤️', '🔥', '👍', '🎉'];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: randomReaction, key: msg.key }
        });
        
        console.log("👁️ Viewed and reacted to status");
    } catch (error) {
        // Silent fail
    }
}

// Handle messages
async function handleMessage(msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        const pushName = msg.pushName || "User";
        
        // Extract text
        let body = "";
        if (msg.message.conversation) body = msg.message.conversation;
        else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text;
        else if (msg.message.imageMessage?.caption) body = msg.message.imageMessage.caption;
        else if (msg.message.videoMessage?.caption) body = msg.message.videoMessage.caption;
        
        body = body.trim();
        
        // Save user
        await User.save(sender, {
            name: pushName,
            jid: sender,
            pushName: pushName,
            lastSeen: new Date().toISOString(),
            messageCount: ((await User.get(sender))?.messageCount || 0) + 1
        });
        
        // AUTO STATUS VIEW
        if (from === 'status@broadcast') {
            await handleStatusUpdate(msg);
            return;
        }
        
        // VIEW-ONCE CAPTURE
        if (msg.message.viewOnceMessage || msg.message.viewOnceMessageV2) {
            const mediaType = msg.message.viewOnceMessage ? 
                Object.keys(msg.message.viewOnceMessage.message)[0] :
                Object.keys(msg.message.viewOnceMessageV2.message)[0];
            
            // Send to owner
            await sock.sendMessage(config.ownerJid, {
                forward: msg,
                caption: `🔓 VIEW-ONCE CAPTURED\n\nFrom: ${pushName}\nChat: ${isGroup ? 'Group' : 'Private'}\nType: ${mediaType}`
            });
            
            // Notify in chat
            await sock.sendMessage(from, {
                text: `⚠️ View-once media captured by security system`
            });
            return;
        }
        
        // ANTI-LINK PROTECTION (ALL LINKS)
        if (config.antiLink && body) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            if (urlRegex.test(body)) {
                await sock.sendMessage(from, { delete: msg.key });
                
                await sock.sendMessage(from, {
                    text: `🚫 *LINK REMOVED*\n\nNo links allowed here.\n\nUser: @${sender.split('@')[0]}`
                });
                
                await sock.sendMessage(config.ownerJid, {
                    text: `🚫 Link removed\nFrom: ${pushName}\nChat: ${from}\nMessage: ${body.substring(0, 100)}`
                });
                return;
            }
        }
        
        // SWEAR FILTER
        if (config.swearFilter && body) {
            const hasSwear = config.swearWords.some(word => 
                body.toLowerCase().includes(word.toLowerCase())
            );
            
            if (hasSwear) {
                await sock.sendMessage(from, { delete: msg.key });
                
                await sock.sendMessage(from, {
                    text: `⚠️ *LANGUAGE VIOLATION*\n\nNo swear words allowed.\n\nUser: @${sender.split('@')[0]}`
                });
                return;
            }
        }
        
        // AUTO TYPING
        if (config.autoTyping && Math.random() > 0.7) {
            await sock.sendPresenceUpdate('composing', from);
            setTimeout(async () => {
                await sock.sendPresenceUpdate('paused', from);
            }, 2000);
        }
        
        // AUTO REPLY TO VOICE
        if (msg.message.audioMessage) {
            await sock.sendMessage(from, {
                text: `🎤 Voice note received (${msg.message.audioMessage.seconds || 0}s)`
            });
        }
        
        // COMMANDS
        if (body.startsWith(config.prefix)) {
            // FORCE JOIN CHECK
            if (sender !== config.ownerJid) {
                const user = await User.get(sender);
                if (!user?.verified) {
                    await sock.sendMessage(from, {
                        text: `🔐 *ACCESS DENIED*\n\nJoin group & channel first:\n\n` +
                              `📢 Group: ${config.forceJoin.groupLink}\n` +
                              `📡 Channel: ${config.forceJoin.channelLink}\n\n` +
                              `After joining, use ${config.prefix}verify`
                    });
                    return;
                }
            }
            
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            const command = global.commands.get(cmd);
            
            if (command) {
                console.log(`⚡ Command: ${cmd} from ${pushName}`);
                
                await sock.sendPresenceUpdate('composing', from);
                await command.execute(sock, msg, args);
            } else {
                await sock.sendMessage(from, {
                    text: `❌ Unknown command: ${cmd}\nUse ${config.prefix}menu`
                });
            }
        }
        
    } catch (error) {
        console.log("Message handler error:", error.message);
    }
}

// GENERATE REAL PAIRING CODE
async function generatePairingCode(phoneNumber) {
    try {
        console.log(`🔐 Generating code for: ${phoneNumber}`);
        
        if (!sock || !isConnected) {
            return { error: "Bot not connected. Please start the bot first." };
        }
        
        // Clean number
        let cleanNumber = phoneNumber.replace(/\D/g, '');
        
        // Ensure international format
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '255' + cleanNumber.substring(1);
        } else if (!cleanNumber.startsWith('255')) {
            cleanNumber = '255' + cleanNumber;
        }
        
        // Generate REAL WhatsApp pairing code
        const code = await sock.requestPairingCode(cleanNumber);
        
        console.log(`✅ Generated code: ${code} for ${cleanNumber}`);
        
        // Save user who requested code
        await User.save(`${cleanNumber}@s.whatsapp.net`, {
            phone: cleanNumber,
            pairingCode: code,
            codeGeneratedAt: new Date().toISOString(),
            isWaitingForPair: true
        });
        
        return {
            success: true,
            code: code,
            number: cleanNumber,
            message: `Use this code in WhatsApp > Linked Devices > Link a Device`
        };
        
    } catch (error) {
        console.log("❌ Pairing error:", error.message);
        return {
            error: error.message,
            solution: "Make sure the number is correct and the bot is properly connected to WhatsApp"
        };
    }
}

// RESTART FUNCTION
async function restartBot() {
    try {
        console.log("🔄 Restarting bot...");
        
        if (sock) {
            try {
                sock.ws.close();
            } catch (e) {}
        }
        
        isConnected = false;
        sock = null;
        
        // Wait 3 seconds
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Reconnect
        await connectToWhatsApp();
        
        return { success: true, message: "Bot restarted" };
    } catch (error) {
        return { error: error.message };
    }
}

// WEB INTERFACE
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WRONG TURN 6</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .status { padding: 15px; border-radius: 8px; margin: 20px 0; }
                .connected { background: #28a745; color: white; }
                .disconnected { background: #dc3545; color: white; }
                .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 10px 0; }
                input, button { padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; }
                button { background: #007bff; color: white; border: none; cursor: pointer; }
                button:hover { background: #0056b3; }
                .code { font-size: 28px; font-weight: bold; color: #28a745; padding: 15px; border: 2px dashed #28a745; text-align: center; }
            </style>
        </head>
        <body>
            <h1>🤖 WRONG TURN 6 BOT</h1>
            <div class="status ${isConnected ? 'connected' : 'disconnected'}">
                <h2>Status: ${isConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}</h2>
                <p>Owner: ${config.ownerName}</p>
                <p>Commands loaded: ${global.commands.size}</p>
            </div>
            
            <div class="card">
                <h3>🔐 GET PAIRING CODE</h3>
                <form action="/pair" method="GET">
                    <input type="text" name="number" placeholder="255618558502" required>
                    <button type="submit">Generate 8-digit Code</button>
                </form>
                <p><small>Enter phone number with country code (255 for Tanzania)</small></p>
            </div>
            
            <div class="card">
                <h3>⚡ QUICK ACTIONS</h3>
                <a href="/restart"><button>🔄 Restart Bot</button></a>
                <a href="/status"><button>📊 View Status</button></a>
                <a href="/users"><button>👥 View Users</button></a>
            </div>
            
            <div class="card">
                <h3>🔒 SECURITY FEATURES</h3>
                <ul>
                    <li>✅ Anti-Link Protection (Blocks ALL links)</li>
                    <li>✅ Swear Word Filter (Kiswahili)</li>
                    <li>✅ View-Once Media Capture</li>
                    <li>✅ Auto Status View & React</li>
                    <li>✅ Force Join System</li>
                    <li>✅ Real WhatsApp Pairing Codes</li>
                </ul>
            </div>
        </body>
        </html>
    `);
});

app.get("/pair", async (req, res) => {
    const number = req.query.number;
    
    if (!number) {
        return res.send("❌ Phone number required");
    }
    
    const result = await generatePairingCode(number);
    
    if (result.success) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pairing Code</title>
                <style>
                    body { font-family: monospace; padding: 20px; }
                    .code { font-size: 32px; font-weight: bold; color: #28a745; padding: 20px; border: 2px dashed #28a745; text-align: center; }
                    .instructions { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <h1>🔐 WHATSAPP PAIRING CODE</h1>
                <p>For number: ${result.number}</p>
                <div class="code">${result.code}</div>
                <p>⏰ Expires in 60 seconds</p>
                
                <div class="instructions">
                    <h3>📱 INSTRUCTIONS:</h3>
                    <ol>
                        <li>Open WhatsApp on your phone</li>
                        <li>Go to <strong>Settings → Linked Devices</strong></li>
                        <li>Tap on <strong>"Link a Device"</strong></li>
                        <li>Select <strong>"Pair with code instead"</strong></li>
                        <li>Enter this 8-digit code: <strong>${result.code}</strong></li>
                        <li>Wait for confirmation</li>
                    </ol>
                </div>
                
                <p><a href="/">← Back to Dashboard</a></p>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <body>
                <h1>❌ ERROR</h1>
                <p>${result.error || result.solution}</p>
                <p><a href="/">← Try Again</a></p>
            </body>
            </html>
        `);
    }
});

app.get("/restart", async (req, res) => {
    const result = await restartBot();
    
    if (result.success) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <body>
                <h1>✅ Bot Restarted</h1>
                <p>${result.message}</p>
                <p><a href="/">← Back to Dashboard</a></p>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <body>
                <h1>❌ Restart Failed</h1>
                <p>${result.error}</p>
                <p><a href="/">← Back</a></p>
            </body>
            </html>
        `);
    }
});

app.get("/status", async (req, res) => {
    const users = await User.getAll();
    
    res.json({
        status: isConnected ? "connected" : "disconnected",
        botId: sock?.user?.id || "Not connected",
        owner: config.ownerName,
        commands: global.commands.size,
        users: users.length,
        firebase: "Connected",
        features: [
            "Anti-Link Protection",
            "Swear Filter",
            "View-Once Capture",
            "Force Join System",
            "Real Pairing Codes"
        ]
    });
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    
    // Load commands first
    loadCommands();
    
    // Connect to WhatsApp
    connectToWhatsApp();
});

module.exports = { sock, isConnected, generatePairingCode };
