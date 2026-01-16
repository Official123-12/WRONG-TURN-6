const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys");
const express = require("express");
const mongoose = require("mongoose");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const app = express();
app.use(express.static('public'));

global.commands = new Map();
let sock;

// 1. DYNAMIC COMMAND LOADER
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) return;
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
};

// 2. MONGODB AUTH FIX
async function useMongoDBAuthState() {
    const { Session } = require("./database");
    let session = await Session.findOne({ id: "stanytz_wt6_v26" });
    const creds = session ? JSON.parse(session.data, BufferJSON.reviver) : initAuthCreds();

    return {
        state: { creds, keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" })) },
        saveCreds: async () => {
            const sessionData = JSON.stringify(sock.authState.creds, BufferJSON.replacer);
            await Session.findOneAndUpdate({ id: "stanytz_wt6_v26" }, { data: sessionData }, { upsert: true });
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
        // ANTI-BAN IDENTITY: Mobile Emulation
        browser: ["WRONG TURN 6", "Android", "12.0"],
        syncFullHistory: true
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered && num) {
        await delay(15000); // 15s Neural Handshake
        try {
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).send("FAILED"); }
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const { commandHandler } = require("./handler");
        await commandHandler(sock, messages[0]);
    });

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "open") console.log("🚀 WRONG TURN 6 ONLINE");
        if (connection === "close") startEngine();
    });
}

loadCommands();
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(process.env.PORT || 3000, () => startEngine());
