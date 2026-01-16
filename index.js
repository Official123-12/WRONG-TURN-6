const { 
    default: makeWASocket, delay, makeCacheableSignalKeyStore, 
    DisconnectReason, initAuthCreds, useMultiFileAuthState 
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { Session } = require("./database");
const { commandHandler } = require("./handler");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static('public'));

let sock;
global.commands = new Map();

// --- 1. DYNAMIC COMMAND LOADER ---
const loadCommands = () => {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return;
    const folders = fs.readdirSync(commandsPath);
    for (const folder of folders) {
        const folderPath = path.join(commandsPath, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
            for (const file of files) {
                const cmd = require(path.join(folderPath, file));
                global.commands.set(cmd.name, cmd);
            }
        }
    }
    console.log(`✅ Loaded ${global.commands.size} Commands`);
};

// --- 2. MONGODB AUTH STATE ---
async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_wt6_session" });
    const creds = session ? session.creds : initAuthCreds();
    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
        },
        saveCreds: async () => {
            await Session.findOneAndUpdate(
                { id: "stanytz_wt6_session" },
                { creds },
                { upsert: true }
            );
        }
    };
}

async function startBot() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(config.mongoUri);
    }

    const { state, saveCreds } = await useMongoDBAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: CONNECTED!");
            await sock.sendPresenceUpdate('available'); 
            await sock.sendMessage(sock.user.id, { text: "🚀 *WRONG TURN 6 IS LIVE!* \n\nSession secured in MongoDB Cloud. Bot will not logout." });
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

// --- 3. WEB API ---
app.get("/get-code", async (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).json({ error: "Number required" });

    try {
        if (!sock || sock.authState.creds.registered) {
            return res.json({ error: "Bot already linked or engine not ready. Restart Render." });
        }
        // Subiri sekunde 10 ili socket itulize connection
        await delay(10000); 
        const code = await sock.requestPairingCode(num.trim());
        res.json({ code: code });
    } catch (err) {
        res.status(500).json({ error: "Engine Busy. Try again in 30s." });
    }
});

loadCommands();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server live on ${PORT}`);
    startBot();
});
