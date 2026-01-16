const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const config = require("./config");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

mongoose.connect(config.mongoUri).then(() => console.log("✅ Database Matrix Ready"));

let sock;

async function startEngine(num = null, res = null) {
    // Tunatumia faili la kawaida kwa muda kule Render ili iwe na kasi (UptimeRobot italilinda)
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- PAIRING CODE LOGIC (Neural Surge Fix) ---
    if (!sock.authState.creds.registered && num) {
        try {
            await delay(5000); // 5s pekee inatosha kama kodi imekuwa optimized
            const code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) {
                console.log(`✅ CODE GENERATED: ${code}`);
                return res.json({ code });
            }
        } catch (e) {
            console.error("Pairing Fail:", e.message);
            if (res && !res.headersSent) res.status(500).json({ error: "Try Again" });
        }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 IS LIVE!");
            await sock.sendPresenceUpdate('available');
            // Welcome Message
            const welcome = `🚀 *WRONG TURN 6 CONNECTED* 🚀\n\nWelcome Master *STANYTZ*.\n\n*STATUS:* Online ✅\n*COMMANDS:* 500+ Active\n\n_Type .menu to begin the matrix._`;
            await sock.sendMessage(sock.user.id, { text: welcome });
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

// Pair Endpoint
app.get("/get-code", async (req, res) => {
    const num = req.query.num;
    if (!num) return res.status(400).json({ error: "Missing Number" });
    await startEngine(num, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on Port ${PORT}`);
    startEngine();
});
