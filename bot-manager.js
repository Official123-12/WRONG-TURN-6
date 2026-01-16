const { default: makeWASocket, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Session, User, Log } = require('./database');
const config = require('./config');

async function createBotSession(sessionData) {
    try {
        console.log(`🚀 Creating bot session for: ${sessionData.phoneNumber}`);
        
        // Initialize credentials
        let creds = sessionData.creds || initAuthCreds();
        
        // Create WhatsApp socket with pairing code option
        const sock = makeWASocket({
            auth: {
                creds,
                keys: makeCacheableSignalKeyStore(creds, pino({ level: "fatal" }))
            },
            logger: pino({ level: "fatal" }),
            printQRInTerminal: false,
            browser: ["WRONG TURN 6", "Chrome", "3.0"],
            syncFullHistory: false,
            connectTimeoutMs: 30000
        });
        
        // Handle credentials update
        sock.ev.on("creds.update", async () => {
            try {
                await Session.findOneAndUpdate(
                    { sessionId: sessionData.sessionId },
                    { creds: sock.authState.creds },
                    { new: true }
                );
            } catch (error) {
                console.error('Error updating credentials:', error);
            }
        });
        
        // Handle connection updates
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // QR Code for pairing (if needed)
            if (qr) {
                console.log(`📱 QR Code generated for ${sessionData.phoneNumber}`);
                // You can emit QR via WebSocket if needed
            }
            
            if (connection === "open") {
                console.log(`✅ Bot connected for ${sessionData.phoneNumber}`);
                
                // Update session
                await Session.findOneAndUpdate(
                    { sessionId: sessionData.sessionId },
                    {
                        status: 'active',
                        'connectionInfo.connectedAt': new Date(),
                        'connectionInfo.lastSeen': new Date(),
                        'connectionInfo.device': 'WhatsApp Web'
                    }
                );
                
                // Send welcome message
                await sendWelcomeMessage(sock, sessionData);
            }
            
            if (connection === "close") {
                const error = lastDisconnect?.error;
                console.log(`❌ Connection closed for ${sessionData.phoneNumber}:`, error?.message);
                
                // Update session status
                await Session.findOneAndUpdate(
                    { sessionId: sessionData.sessionId },
                    { 
                        status: 'inactive',
                        'connectionInfo.lastSeen': new Date()
                    }
                );
                
                // Remove from active bots
                global.activeBots.delete(sessionData.sessionId);
                
                // Auto-reconnect logic (only if not logged out)
                const shouldReconnect = error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect && sessionData.status !== 'expired') {
                    console.log(`🔄 Will try to reconnect ${sessionData.phoneNumber}...`);
                    setTimeout(async () => {
                        try {
                            const session = await Session.findOne({ sessionId: sessionData.sessionId });
                            if (session && session.status !== 'expired') {
                                await createBotSession(session);
                            }
                        } catch (err) {
                            console.error('Reconnect failed:', err);
                        }
                    }, 10000);
                }
            }
        });
        
        // Handle incoming messages
        sock.ev.on("messages.upsert", async ({ messages }) => {
            if (!messages || messages.length === 0) return;
            
            const message = messages[0];
            
            // Skip own messages
            if (message.key.fromMe) return;
            
            // Update last seen
            await Session.findOneAndUpdate(
                { sessionId: sessionData.sessionId },
                { 'connectionInfo.lastSeen': new Date() }
            );
            
            // Handle the message
            await handleMessage(sock, message, sessionData);
        });
        
        return {
            socket: sock,
            sessionId: sessionData.sessionId,
            phoneNumber: sessionData.phoneNumber,
            userId: sessionData.userId
        };
        
    } catch (error) {
        console.error('Error creating bot session:', error);
        throw error;
    }
}

async function sendWelcomeMessage(sock, sessionData) {
    try {
        const welcomeMsg = `🚀 *${config.botName.toUpperCase()} IS NOW ACTIVE* 🚀\n\n` +
            `Welcome to *${config.botName}*\n` +
            `Developer: *${config.developer}*\n\n` +
            `📱 *Connected Number:* ${sessionData.phoneNumber}\n` +
            `⚡ *Prefix:* ${config.prefix}\n\n` +
            `*Your bot is now ready to use!*\n` +
            `Type *${config.prefix}menu* to see all commands\n\n` +
            `📢 *Join our community:*\n` +
            `• Group: ${config.groupLink}\n` +
            `• Channel: ${config.channelLink}\n\n` +
            `_This bot will auto-disconnect after 24 hours of inactivity._`;
        
        await sock.sendMessage(sock.user.id, { text: welcomeMsg });
        console.log(`📨 Welcome message sent to ${sessionData.phoneNumber}`);
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
}

async function handleMessage(sock, message, sessionData) {
    try {
        const from = message.key.remoteJid;
        const sender = message.key.participant || from;
        const body = extractMessageText(message);
        
        if (!body || !from) return;
        
        // Check if message is a command
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = global.commands.get(commandName);
            
            if (command) {
                // Update user stats
                await updateUserStats(sender, sessionData.phoneNumber);
                
                // Execute command
                await command.execute(sock, message, args, sessionData);
                
                // Log command usage
                await Log.create({
                    type: 'command',
                    sessionId: sessionData.sessionId,
                    userId: sender,
                    details: {
                        command: commandName,
                        args: args,
                        from: from
                    }
                });
            } else {
                // Unknown command
                await sock.sendMessage(from, {
                    text: `❌ Unknown command: *${commandName}*\n\nType *${config.prefix}menu* to see available commands.`
                });
            }
        }
        
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

function extractMessageText(message) {
    const msg = message.message;
    if (!msg) return '';
    
    return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        ''
    ).trim();
}

async function updateUserStats(userId, phoneNumber) {
    try {
        await User.findOneAndUpdate(
            { userId },
            {
                $inc: { 'stats.commandsUsed': 1 },
                $set: { 
                    'stats.lastActive': new Date(),
                    phoneNumber: phoneNumber
                }
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

module.exports = {
    createBotSession,
    handleMessage
};
