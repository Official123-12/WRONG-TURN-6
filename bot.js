const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys");
const express = require("express");
const mongoose = require("mongoose");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const config = {
    botName: "WRONG TURN 6",
    ownerName: "STANYTZ",
    ownerNumber: "255618558502", 
    prefix: ".",
    mongoUri: "mongodb+srv://stanytz076:stanytz076@cluster0.ennpt6t.mongodb.net/WrongTurn6?retryWrites=true&w=majority",
    channelLink: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
    groupLink: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
    groupId: "120363302194515518@g.us",
    menuImage: "https://i.ibb.co/vz6mD7y/wrongturn.jpg"
};

const app = express();
const Session = mongoose.model('Session', new mongoose.Schema({ id: String, data: String }));

global.commands = new Map();
let sock;

// Command Loader
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    fs.readdirSync(cmdPath).forEach(dir => {
        const folder = path.join(cmdPath, dir);
        if (fs.statSync(folder).isDirectory()) {
            fs.readdirSync(folder).filter(f => f.endsWith('.js')).forEach(file => {
                const cmd = require(path.join(folder, file));
                global.commands.set(cmd.name, cmd);
            });
        }
    });
    console.log(`✅ LOADED: ${global.commands.size} Commands`);
};

async function startBot(num = null, res = null) {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(config.mongoUri);
    
    // MONGODB AUTH FIX (Binary to String)
    let cloud = await Session.findOne({ id: "stanytz_session" });
    const creds = cloud ? JSON.parse(cloud.data, BufferJSON.reviver) : initAuthCreds();

    sock = makeWASocket({
        auth: { creds, keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["WRONG TURN 6", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    sock.ev.on("creds.update", async () => {
        const sessionData = JSON.stringify(sock.authState.creds, BufferJSON.replacer);
        await Session.findOneAndUpdate({ id: "stanytz_session" }, { data: sessionData }, { upsert: true });
    });

    if (!sock.authState.creds.registered && num) {
        await delay(12000); 
        const code = await sock.requestPairingCode(num.trim());
        if (res) res.json({ code });
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const { commandHandler } = require("./handler");
        await commandHandler(sock, messages[0], config);
    });

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("🚀 WRONG TURN 6 LIVE");
        if (u.connection === "close") startBot();
    });
}

loadCommands();
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get("/get-code", (req, res) => startBot(req.query.num, res));
app.listen(3000, () => startBot());
