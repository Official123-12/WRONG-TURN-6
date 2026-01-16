const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { db } = require("./database");

const app = express();
app.use(express.static('public'));

global.commands = new Map();
let sock;

// 1. DYNAMIC COMMAND LOADER
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(dir => {
        const folder = path.join(cmdPath, dir);
        if (fs.statSync(folder).isDirectory()) {
            fs.readdirSync(folder).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(folder, file));
                cmd.category = dir.toUpperCase();
                global.commands.set(cmd.name, cmd);
            });
        }
    });
    console.log(`✅ Loaded ${global.commands.size} Commands`);
};

// 2. FIREBASE SESSION STORAGE (The Solution)
async function useFirebaseAuthState() {
    const sessionDoc = db.collection("Sessions").doc("stanytz_wt6_v26");
    const doc = await sessionDoc.get();
    
    // Inasoma creds kutoka Firebase Firestore
    const creds = doc.exists ? JSON.parse(doc.data().creds, BufferJSON.reviver) : initAuthCreds();

    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
        },
        saveCreds: async () => {
            // Inageuza creds kuwa String na kuzisave Firebase
            const credsString = JSON.stringify(sock.authState.creds, BufferJSON.replacer);
            await sessionDoc.set({ creds: credsString }, { merge: true });
        }
    };
}

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useFirebaseAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        // Ubuntu Power Browser
        browser: ["WRONG TURN 6", "Ubuntu", "20.0.04"],
        syncFullHistory: true
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered && num) {
        await delay(12000); 
        try {
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).send("Cloud Sync Busy"); }
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const { commandHandler } = require("./handler");
        await commandHandler(sock, messages[0]);
    });

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 LIVE ON FIREBASE CLOUD");
            await sock.sendPresenceUpdate('available');
            const welcome = `🚀 *WRONG TURN 6 CONNECTED* 🚀\n\nWelcome Master *STANYTZ*.\n\n*DATABASE:* Google Firebase Cloud ✅\n*STATUS:* Always Online\n\n_System active. Your session is now invincible._`;
            await sock.sendMessage(sock.user.id, { text: welcome });
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startEngine();
        }
    });
}

loadCommands();
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
