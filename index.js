const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { Session } = require("./database");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

let sock;

// Logic ya kuhifadhi Session kule MongoDB
async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_wt6_core" });
    const creds = session ? session.creds : initAuthCreds();
    return {
        state: { creds, keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" })) },
        saveCreds: async () => {
            await Session.findOneAndUpdate({ id: "stanytz_wt6_core" }, { creds: sock.authState.creds }, { upsert: true });
        }
    };
}

async function startEngine(num = null, res = null) {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(config.mongoUri);
    const { state, saveCreds } = await useMongoDBAuthState();

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        // HII NDIO FIX: Identity ya Mac OS Chrome
        browser: ["Mac OS", "Chrome", "10.15.7"],
        syncFullHistory: true,
        markOnlineOnConnect: true
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered && num) {
        try {
            await delay(12000); // Wait for Render to stabilize
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).json({ error: "WhatsApp Refused. Try again." }); }
    }

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 CONNECTED!");
            await sock.sendPresenceUpdate('available');
            const welcome = `🚀 *WRONG TURN 6 CONNECTED* 🚀\n\nWelcome Master *STANYTZ*.\n\n*STATUS:* Cloud Secured ✅\n*IDENTITY:* Verified ✔️\n\n_System active. Type .menu to begin._`;
            await sock.sendMessage(sock.user.id, { text: welcome });
        }
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startEngine();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(process.env.PORT || 3000, () => startEngine());
