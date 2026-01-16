const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { commandHandler } = require("./handler");

const app = express();
app.use(express.static('public'));

mongoose.connect(config.mongoUri).then(() => console.log("✅ DATABASE OF STANY TZ CONNECTED"));

global.commands = new Map();
const loadCmds = () => {
    const folders = fs.readdirSync('./commands');
    for (const folder of folders) {
        const files = fs.readdirSync(`./commands/${folder}`).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const cmd = require(`./commands/${folder}/${file}`);
            global.commands.set(cmd.name, cmd);
        }
    }
};

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    if (!sock.authState.creds.registered && num) {
        await delay(12000); 
        const code = await sock.requestPairingCode(num.trim());
        if (res) res.json({ code });
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
        if (u.connection === "open") {
            console.log("🚀 WRONG TURN 6 LIVE");
            // WELCOME MESSAGE & MANUAL TO OWNER
            const welcome = `🚀 *WRONG TURN 6 CONNECTED SUCCESSFULLY!* 🚀\n\nDeveloper: *STANYTZ*\n\n*USER MANUAL:*\n1. Use .menu to see all hubs.\n2. Commands are split into Wealth, Edu, Hack, etc.\n3. Anti-Delete & View-Once are AUTO-ENABLED.\n\n*System Status:* ALWAYS ONLINE ✅`;
            await sock.sendMessage(sock.user.id, { text: welcome });
        }
        if (u.connection === "close") startEngine();
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        await commandHandler(sock, messages[0]);
    });
}

loadCmds();
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
