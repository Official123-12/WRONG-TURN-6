const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore, 
    DisconnectReason, 
    initAuthCreds 
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { Session } = require("./database");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

let sock;

// 1. NEURAL SESSION SYNC (MONGODB)
async function useMongoDBAuthState() {
    let session = await Session.findOne({ id: "stanytz_matrix_core" });
    const creds = session ? session.creds : initAuthCreds();
    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
        },
        saveCreds: async () => {
            await Session.findOneAndUpdate(
                { id: "stanytz_matrix_core" },
                { creds: sock.authState.creds },
                { upsert: true }
            );
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
        // MOBILE FINGERPRINT: WhatsApp accepts this 100% without block
        browser: ["Chrome (Android)", "Android", "12"],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on("creds.update", saveCreds);

    // 2. PAIRING LOGIC (THE FIX)
    if (!sock.authState.creds.registered && num) {
        try {
            console.log(`STANYTZ: Generating Neural Code for ${num}...`);
            // We give WhatsApp 15 seconds to trust the session first
            await delay(15000); 
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) {
                return res.json({ code: code });
            }
        } catch (e) {
            console.error("Pairing Failed:", e.message);
            if (res && !res.headersSent) return res.status(500).json({ error: "Try Again" });
        }
    }

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6: CONNECTED SUCCESSFULLY!");
            const vcard = 'BEGIN:VCARD\nVERSION:3.0\n' + `FN:${config.botName} ✔️\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
            await sock.sendMessage(sock.user.id, { contacts: { displayName: 'WRONG TURN 6 ✔️', contacts: [{ vcard }] } });
            await sock.sendMessage(sock.user.id, { text: "🚀 *MATRIX ACTIVE* \n\nSession secured in MongoDB Cloud. Master: *STANYTZ*" });
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

app.get("/get-code", async (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).send("No Number");
    await startEngine(num, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Engine live on ${PORT}`);
    startEngine();
});
