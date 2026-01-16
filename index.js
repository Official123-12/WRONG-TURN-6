const { 
    default: makeWASocket, 
    delay, 
    makeCacheableSignalKeyStore, 
    DisconnectReason, 
    initAuthCreds, // Hapa ndio tumerekebisha!
    useMultiFileAuthState 
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { Session, User } = require("./database");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

let sock;

// --- CLOUD AUTH LOGIC (MONGODB) ---
async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_wt6_matrix" });
    
    // Kama session ipo, itumie. Kama haipo, tengeneza creds mpya
    const creds = session ? session.creds : initAuthCreds();

    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
        },
        saveCreds: async () => {
            await Session.findOneAndUpdate(
                { id: "stanytz_wt6_matrix" },
                { creds },
                { upsert: true }
            );
        }
    };
}

async function startEngine(num = null, res = null) {
    // Hakikisha DB imeunganishwa kwanza
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

    // PAIRING LOGIC (Fixed for Precondition Error)
    if (!sock.authState.creds.registered && num) {
        try {
            console.log(`Matrix: Deploying Pairing for ${num}`);
            await delay(15000); // 15s Delay kuzuia Render Choking
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) res.json({ code });
        } catch (e) {
            console.error("Pairing Error:", e.message);
            if (res && !res.headersSent) res.status(500).json({ error: "System Booting... Try again in 30s" });
        }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: ENGINE 100% LIVE ON CLOUD!");
            await sock.sendPresenceUpdate('available'); 
            await sock.sendMessage(sock.user.id, { text: "🚀 *WRONG TURN 6 CONNECTED!*\n\nMaster: *STANYTZ*\nSession: *Cloud Secured* ✅" });
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startEngine();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

// Pair Endpoint kwa ajili ya Website yako
app.get("/get-code", async (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).json({ error: "Provide Number!" });
    await startEngine(num, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server live on ${PORT}`);
    startEngine(); // Start Initial Instance
});
