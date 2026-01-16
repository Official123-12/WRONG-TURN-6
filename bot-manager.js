const { default: makeWASocket, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Session, User, Log } = require('./database');
const config = require('./config');

async function createBotSession(sessionData) {
    try {
        // Get or create credentials
        let creds = sessionData.creds || initAuthCreds();
        
        // Create WhatsApp socket
        const sock = makeWASocket({
            auth: {
                creds,
                keys: makeCacheableSignalKeyStore(creds, pino({ level: "fatal" }))
            },
            logger: pino({ level: "fatal" }),
            printQRInTerminal: false,
            browser: ["WRONG TURN 6", "Chrome", "3.0"],
            syncFullHistory: false
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
            const { connection, lastDisconnect } = update;
            
            if (connection === "open") {
                console.log(`✅ Bot connected for ${sessionData.phoneNumber}`);
                
                // Update session
                await Session.findOneAndUpdate(
                    { sessionId: sessionData.sessionId },
                    {
                        status: 'active',
                        'connectionInfo.connectedAt': new Date(),
                        'connectionInfo.lastSeen': new Date()
                    }
                );
                
                // Send welcome message to owner
                const welcomeMsg = `🚀 *${config.botName} IS NOW ACTIVE* 🚀\n\n` +
                    `Welcome to *${config.botName}*\n` +
                    `Developer: *${config.developer}*\n\n` +
                    `*Your bot is now connected!*\n` +
                    `Use *${config.prefix}menu* to see all commands\n\n` +
                    `📢 Join our community:\n` +
                    `• Group: ${config.groupLink}\n` +
                    `• Channel: ${config.channelLink}`;
                
                try {
                    await sock.sendMessage(sock.user.id, { text: welcomeMsg });
                } catch (error) {
                    console.error('Error sending welcome message:', error);
                }
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
                
                // Check if we should reconnect
                const shouldReconnect = error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log(`🔄 Reconnecting ${sessionData.phoneNumber} in 10 seconds...`);
                    setTimeout(async () => {
                        try {
                            const session = await Session.findOne({ sessionId: sessionData.sessionId });
                            if (session) {
                                await createBotSession(session);
                            }
                        } catch (error) {
                            console.error('Reconnect failed:', error);
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
            
            // Handle the message (command processing)
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

async function handleMessage(sock, message, sessionData) {
    try {
        const from = message.key.remoteJid;
        const sender = message.key.participant || from;
        const body = extractMessageText(message);
        
        if (!body) return;
        
        // Check if message is a command
        if (body.startsWith(config.prefix)) {
            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = global.commands.get(commandName);
            
            if (command) {
                // Update user stats
                await updateUserStats(sender);
                
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
            } else if (commandName === 'menu') {
                // Default menu command
                await sendMenu(sock, from, sessionData);
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

async function updateUserStats(userId) {
    try {
        await User.findOneAndUpdate(
            { userId },
            {
                $inc: { 'stats.commandsUsed': 1 },
                $set: { 'stats.lastActive': new Date() }
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

async function sendMenu(sock, from, sessionData) {
    try {
        const menuText = `
╔═══════════════════════
║  *${config.botName.toUpperCase()}*
║  ────────────────────
║  👑 Developer: ${config.developer}
║  📱 Connected: ${sessionData.phoneNumber}
║  ⚡ Prefix: ${config.prefix}
║  ────────────────────
║  📁 *OWNER COMMANDS*
║  • ${config.prefix}menu - Show this menu
║  • ${config.prefix}help - Show help
║  • ${config.prefix}ping - Check bot status
║  • ${config.prefix}status - Bot info
║  ────────────────────
║  📁 *GROUP COMMANDS*
║  • ${config.prefix}antilink [on/off]
║  • ${config.prefix}antidelete [on/off]
║  • ${config.prefix}welcome [on/off]
║  ────────────────────
║  📢 *COMMUNITY LINKS*
║  • Group: ${config.groupLink}
║  • Channel: ${config.channelLink}
║  ────────────────────
║  *Type ${config.prefix}help <command>*
║  *for detailed info*
╚═══════════════════════
        `;
        
        await sock.sendMessage(from, {
            image: { url: config.menuImage },
            caption: menuText.trim()
        });
        
    } catch (error) {
        console.error('Error sending menu:', error);
        // Fallback to text only
        await sock.sendMessage(from, {
            text: `*${config.botName} Menu*\n\nType ${config.prefix}help to see all commands\n\nGroup: ${config.groupLink}\nChannel: ${config.channelLink}`
        });
    }
}

module.exports = {
    createBotSession,
    handleMessage
};
