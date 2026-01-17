const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// CONFIG
const CONFIG = {
    botName: "WRONG TURN 6",
    developer: "STANYTZ",
    owner: "255618558502@s.whatsapp.net",
    prefix: ".",
    port: process.env.PORT || 3000,
    channel: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
    group: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y"
};

let sock = null;
let isConnected = false;
global.commands = new Map();

// CREATE FOLDERS
!fs.existsSync('./sessions') && fs.mkdirSync('./sessions', { recursive: true });
!fs.existsSync('./commands') && fs.mkdirSync('./commands', { recursive: true });

// LOAD COMMANDS FROM FOLDERS
function loadCommands() {
    console.log("📂 Loading commands...");
    
    function loadFolder(folder) {
        const items = fs.readdirSync(folder);
        
        items.forEach(item => {
            const fullPath = path.join(folder, item);
            
            if (fs.statSync(fullPath).isDirectory()) {
                loadFolder(fullPath);
            } else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const cmd = require(fullPath);
                    
                    if (cmd.name && cmd.execute) {
                        global.commands.set(cmd.name.toLowerCase(), cmd);
                        console.log(`✅ ${cmd.name} loaded`);
                    }
                } catch (e) {
                    console.log(`❌ Error in ${item}: ${e.message}`);
                }
            }
        });
    }
    
    loadFolder('./commands');
    console.log(`📦 Commands: ${global.commands.size}`);
}

// CONNECT TO WHATSAPP
async function startBot() {
    try {
        console.log("🔄 Connecting to WhatsApp...");
        
        const { state, saveCreds } = await useMultiFileAuthState('./sessions');
        
        sock = makeWASocket({
            auth: state,
            browser: [CONFIG.botName, "Chrome", "1.0.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true,
        });
        
        sock.ev.on("creds.update", saveCreds);
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "open") {
                isConnected = true;
                console.log("✅ WHATSAPP CONNECTED!");
                console.log(`🤖 Bot: ${sock.user.id}`);
                
                // Send welcome to owner
                const welcome = `🚀 *${CONFIG.botName} ACTIVATED*\n\n` +
                               `*Developer:* ${CONFIG.developer}\n` +
                               `*Status:* Online ✅\n` +
                               `*Users:* Ready\n` +
                               `*Channel:* ${CONFIG.channel}\n\n` +
                               `_Bot is now active for Use._`;
                
                sock.sendMessage(CONFIG.owner, { text: welcome });
            }
            
            if (connection === "close") {
                isConnected = false;
                console.log("🔌 Reconnecting...");
                setTimeout(startBot, 3000);
            }
        });
        
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;
            
            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const pushName = m.pushName || "User";
            
            // Extract text
            let text = "";
            if (m.message.conversation) text = m.message.conversation;
            else if (m.message.extendedTextMessage?.text) text = m.message.extendedTextMessage.text;
            else if (m.message.imageMessage?.caption) text = m.message.imageMessage.caption;
            
            text = text.trim();
            
            // Save user session
            const userFile = `./sessions/users/${sender.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            !fs.existsSync('./sessions/users') && fs.mkdirSync('./sessions/users', { recursive: true });
            
            fs.writeFileSync(userFile, JSON.stringify({
                jid: sender,
                name: pushName,
                joined: new Date().toISOString()
            }, null, 2));
            
            // Auto status view
            if (from === 'status@broadcast') {
                await sock.readMessages([m.key]);
                await sock.sendMessage(from, {
                    react: { text: "❤️", key: m.key }
                });
                return;
            }
            
            // Anti-link protection
            if (text && /(https?:\/\/[^\s]+)/g.test(text)) {
                await sock.sendMessage(from, { delete: m.key });
                await sock.sendMessage(from, {
                    text: `🚫 *LINK REMOVED*\nNo links allowed.\n\n_This action was performed by ${CONFIG.botName}_`
                });
                return;
            }
            
            // View-once capture
            if (m.message.viewOnceMessage || m.message.viewOnceMessageV2) {
                const mediaType = m.message.viewOnceMessage ? 
                    Object.keys(m.message.viewOnceMessage.message)[0] :
                    Object.keys(m.message.viewOnceMessageV2.message)[0];
                
                await sock.sendMessage(CONFIG.owner, {
                    forward: m,
                    caption: `🔓 View-once captured\nFrom: ${pushName}\nType: ${mediaType}`
                });
                
                await sock.sendMessage(from, {
                    text: "⚠️ View-once media captured by security system"
                });
                return;
            }
            
            // Auto typing
            await sock.sendPresenceUpdate('composing', from);
            setTimeout(() => sock.sendPresenceUpdate('paused', from), 1000);
            
            // Commands
            if (text.startsWith(CONFIG.prefix)) {
                const args = text.slice(CONFIG.prefix.length).trim().split(/ +/);
                const cmd = args.shift().toLowerCase();
                const command = global.commands.get(cmd);
                
                if (command) {
                    await command.execute(sock, m, args);
                }
            }
        });
        
    } catch (error) {
        console.log("❌ Connection error:", error.message);
        setTimeout(startBot, 5000);
    }
}

// GENERATE REAL 8-DIGIT PAIRING CODE
async function generatePairingCode(number) {
    try {
        if (!sock || !isConnected) {
            return { error: "Bot is connecting. Please wait 10 seconds." };
        }
        
        // Format number
        let cleanNum = number.replace(/\D/g, '');
        
        if (cleanNum.startsWith('0')) {
            cleanNum = '255' + cleanNum.substring(1);
        } else if (!cleanNum.startsWith('255')) {
            cleanNum = '255' + cleanNum;
        }
        
        console.log(`🔐 Generating code for: ${cleanNum}`);
        
        // Get REAL WhatsApp pairing code
        const code = await sock.requestPairingCode(cleanNum);
        
        console.log(`✅ Code: ${code}`);
        
        return {
            success: true,
            code: code,
            number: cleanNum
        };
        
    } catch (error) {
        console.log("❌ Pairing error:", error.message);
        return { error: error.message };
    }
}

// WEB INTERFACE
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${CONFIG.botName}</title>
            <style>
                body { font-family: monospace; padding: 20px; background: #000; color: #0f0; }
                .header { color: #f00; font-size: 24px; }
                .status { background: ${isConnected ? '#0a0' : '#a00'}; padding: 10px; }
                .code { font-size: 40px; letter-spacing: 5px; color: #0f0; }
                input, button { padding: 10px; background: #222; color: #0f0; border: 1px solid #0f0; }
            </style>
        </head>
        <body>
            <div class="header">🤖 ${CONFIG.botName}</div>
            <div class="status">Status: ${isConnected ? '🟢 ONLINE' : '🔴 OFFLINE'}</div>
            <p>Developer: ${CONFIG.developer}</p>
            <p>Users: Active</p>
            
            <h3>🔐 GET PAIRING CODE</h3>
            <form action="/pair" method="GET">
                <input type="text" name="number" placeholder="255618558502" required>
                <button type="submit">Generate Code</button>
            </form>
            
            <p>Channel: ${CONFIG.channel}</p>
            <p>Group: ${CONFIG.group}</p>
        </body>
        </html>
    `);
});

app.get("/pair", async (req, res) => {
    const number = req.query.number;
    
    if (!number) {
        return res.send("❌ Number required: /pair?number=255618558502");
    }
    
    const result = await generatePairingCode(number);
    
    if (result.success) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pairing Code</title>
                <style>
                    body { font-family: monospace; }
                    .code { font-size: 48px; font-weight: bold; color: #0a0; }
                </style>
            </head>
            <body>
                <h1>🔐 WHATSAPP PAIRING CODE</h1>
                <p>For: ${result.number}</p>
                <div class="code">${result.code}</div>
                <p>⏰ Expires in 60 seconds</p>
                
                <h3>📱 INSTRUCTIONS:</h3>
                <ol>
                    <li>Open WhatsApp on phone</li>
                    <li>Settings → Linked Devices</li>
                    <li>Tap "Link a Device"</li>
                    <li>Select "Pair with code instead"</li>
                    <li>Enter: <strong>${result.code}</strong></li>
                </ol>
            </body>
            </html>
        `);
    } else {
        res.send(`❌ Error: ${result.error}`);
    }
});

// START SERVER
const PORT = CONFIG.port;
app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🤖 Bot: ${CONFIG.botName}`);
    console.log(`👨‍💻 Developer: ${CONFIG.developer}`);
    
    loadCommands();
    startBot();
});
