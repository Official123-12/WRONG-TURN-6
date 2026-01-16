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

async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_wt6_matrix" });
    const creds = session ? session.creds : initAuthCreds();
    return {
        state: { creds, keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" })) },
        saveCreds: async () => {
            await Session.findOneAndUpdate({ id: "stanytz_wt6_matrix" }, { creds }, { upsert: true });
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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false // Speed boost
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered && num) {
        try {
            await delay(8000); // Wait for Render to breathe
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) return res.json({ code });
        } catch (e) {
            if (res && !res.headersSent) return res.status(500).json({ error: "System Busy" });
        }
    }

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("✅ WRONG TURN 6 ONLINE");
            await sock.sendPresenceUpdate('available');
            await sock.sendMessage(sock.user.id, { text: "🚀 *WRONG TURN 6 CONNECTED*\n\nSession secured." });
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
