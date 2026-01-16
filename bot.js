const { default: makeWASocket, delay, makeCacheableSignalKeyStore, DisconnectReason, initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys");
const express = require("express");
const admin = require("firebase-admin");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

// --- 1. FIREBASE INITIALIZATION (Using Your Keys) ---
const serviceAccount = {
  "type": "service_account",
  "project_id": "stanybots",
  "private_key_id": "746be8a70fe0db83f0436d9d030c46c47d7c84f6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT\n7mcDBeJgh1Q4i0M296SiI/fq6YkJ5adOh9zQd70Km5tLttt9IajHJ1NdSjZLSnGT\n3NSTsvUxB2PoWPSZtqsL0AyDLmoJx3PEGel5EBvPpD3NWfu9kaTdF9OMKuu2WZUj\nxW4S9HX0M9KAuSCdTFRVCWFozEqf2e+7Obhj8bFIUbUICjqLSh9SsKtxdGxJ9wq0\n6BttfemM2/GhseCuRfu7/0bmiYjbqAwGTEuw3uuKW6+r6sQV5+068E3yjAIgYj3B\n82v7Zwt8XytJfGa6CV+Kj1esHytQPJJ4+x5fpwW0b0mMq6y6Tp77+wiqXQwle5zB\n6rI5CzxnAgMBAAECggEAFEgpt8gPKbXFhZF8VoLL9CN8UlY6r2rD70NvHmCpAAfk\nAQvr+B2JetgixirgsffOE8BBoWmY5ALLvdOmloz0jLUpMco7cYWg400UWVqC1LNI\nqNXY6A/a/pMSOzXyNdKVXN07zL6FPBWv58HWBFgEH5ZD2yEpJkxF1CswkPl2QosR\n/zqeRYuYjWRica/ztaizNk+NC4cy7h0uqiLzA0BYJn/ZTkOypTkYvUafoQEKxtsp\nvZrEQ+d4p/2wLYF9SnWv218Y9b5fsZJESzaUQbNazNZwcNaSFFYmiY2dTm5pleOU\nPfFcYm8eQukVxcN4KORWc7BmUxaxBGHW+1mBSyX3QQKBgQD84KRIMODhT5sP3bel\nDFOVKOg3i6PhUMigkXrXJIUsHPibd63pnVEeXr850fVuRBVERXjpBlC+aMoA90Tz\nzaSLILPY5WIniePLH6ben5T3wC9iYU0wO3ZkwJqW1jZ47CfCnxrmv70TpuPP/kKc\nMnMDyxMpb4zCHzG6YREVIXYeRQKBgQDfYK1XtuVgaxMf+kjV2jp/U3t54uobPH3D\n65pDrnslLZfe6eNJ+woHlxKgTgFqJnMjLGff1Tu1e7t99CbieRfEplmCyNttzHdm\nKXyCzr+G+llgkNpvfIZHS6ZEksay41oTcO0JkSVpTCCxs2osOSICM6yhi9qnYvre\nE/7QOviguwKBgQDbJ2CYw+uQuKnc5T0LyBQD2BDwWo+rbJSDO7FnFNppMa5vJhhN\nty4fEOPPG1wFtPFtWnwAD54Ydr5ieemDFXx9qtjSp3EabRFC72px04GJ+T/XlhYM\nL+xaQuV2xa0tvRR0QelRg2g8yMz0bBmUPtCYv/0aUvd9IQW6zfa9BmPUtQKBgC42\nG+ZHihB2VlCJQMQtD2kD5kmC7heQXhxIA3P5BrTcR8zv6fuGGb8UO+A6AwToy2z9\nZMfjnySeYl1eQyUbFBW0rFPoJa0DXbge4QlWqDzOUesuTGJACq95MP6CtuSPMDVR\naVhPVMQB4cmhaleXwjdeZVpOSn/SdD+5Nz/w0zq9AoGAO7j7hc9SRacoTUU2MJOT\n6+y8q1hFUuOb+tb3LwHzkdQ5kyHyNs5PT0Ib994jAon7Ocfl8bL6ILtNDMBiKVXf\nkg3B0lPkRSW+cDAUAENasCH3OrQrlYVceYnmu/Yc2K3nOvoJS2BLiGa/aCjCPHE2\nNVhK+Ycb7OpMDt2fyWIkyEY=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
  "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com",
};

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// --- 2. CONFIGURATION ---
const config = {
    botName: "WRONG TURN 6",
    ownerName: "STANYTZ",
    ownerNumber: "255618558502", 
    prefix: ".",
    channelLink: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
    groupLink: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
    groupId: "120363302194515518@g.us",
    menuImage: "https://files.catbox.moe/07uq2a.jpg"
};

const app = express();
app.use(express.static('public'));

global.commands = new Map();
let sock;

// 3. COMMAND LOADER
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
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

// 4. FIREBASE AUTH LOGIC
async function useFirebaseAuthState() {
    const sessionDoc = db.collection("Sessions").doc("stanytz_wt6");
    const doc = await sessionDoc.get();
    const creds = doc.exists ? JSON.parse(doc.data().creds, BufferJSON.reviver) : initAuthCreds();

    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(creds, pino({ level: "silent" }))
        },
        saveCreds: async () => {
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
        browser: ["WRONG TURN 6", "Ubuntu", "20.0.04"],
        syncFullHistory: true
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered && num) {
        await delay(12000); 
        const code = await sock.requestPairingCode(num.trim());
        if (res) res.json({ code });
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const { commandHandler } = require("./handler");
        await commandHandler(sock, messages[0], config);
    });

    sock.ev.on("connection.update", async (u) => {
        if (u.connection === "open") {
            console.log("🚀 WRONG TURN 6 LIVE ON FIREBASE");
            await sock.sendPresenceUpdate('available');
            await sock.sendMessage(sock.user.id, { text: "🚀 *SYSTEM CONNECTED* \n\nSession secured in Google Firebase Cloud. Master: *STANYTZ*" });
        }
        if (u.connection === "close") startEngine();
    });
}

loadCommands();
app.get("/get-code", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
