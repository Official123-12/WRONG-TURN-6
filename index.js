const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    getContentType 
} = require("@whiskeysockets/baileys");
const admin = require("firebase-admin");
const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");

// 1. FIREBASE CREDENTIALS (STANYTZ CONFIG)
const serviceAccount = {
  "type": "service_account",
  "project_id": "stanybots",
  "private_key_id": "746be8a70fe0db83f0436d9d030c46c47d7c84f6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT\n7mcDBeJgh1Q4i0M296SiI/fq6YkJ5adOh9zQd70Km5tLttt9IajHJ1NdSjZLSnGT\n3NSTsvUxB2PoWPSZtqsL0AyDLmoJx3PEGel5EBvPpD3NWfu9kaTdF9OMKuu2WZUj\nxW4S9HX0M9KAuSCdTFRVCWFozEqf2e+7Obhj8bFIUbUICjqLSh9SsKtxdGxJ9wq0\n6BttfemM2/GhseCuRfu7/0bmiYjbqAwGTEuw3uuKW6+r6sQV5+068E3yjAIgYj3B\n82v7Zwt8XytJfGa6CV+Kj1esHytQPJJ4+x5fpwW0b0mMq6y6Tp77+wiqXQwle5zB\n6rI5CzxnAgMBAAECggEAFEgpt8gPKbXFhZF8VoLL9CN8UlY6r2rD70NvHmCpAAfk\nAQvr+B2JetgixirgsffOE8BBoWmY5ALLvdOmloz0jLUpMco7cYWg400UWVqC1LNI\nqNXY6A/a/pMSOzXyNdKVXN07zL6FPBWv58HWBFgEH5ZD2yEpJkxF1CswkPl2QosR\n/zqeRYuYjWRica/ztaizNk+NC4cy7h0uqiLzA0BYJn/ZTkOypTkYvUafoQEKxtsp\nvZrEQ+d4p/2wLYF9SnWv218Y9b5fsZJESzaUQbNazNZwcNaSFFYmiY2dTm5pleOU\nPfFcYm8eQukVxcN4KORWc7BmUxaxBGHW+1mBSyX3QQKBgQD84KRIMODhT5sP3bel\nDFOVKOg3i6PhUMigkXrXJIUsHPibd63pnVEeXr850fVuRBVERXjpBlC+aMoA90Tz\nzaSLILPY5WIniePLH6ben5T3wC9iYU0wO3ZkwJqW1jZ47CfCnxrmv70TpuPP/kKc\nMnMDyxMpb4zCHzG6YREVIXYeRQKBgQDfYK1XtuVgaxMf+kjV2jp/U3t54uobPH3D\n65pDrnslLZfe6eNJ+woHlxKgTgFqJnMjLGff1Tu1e7t99CbieRfEplmCyNttzHdm\nKXyCzr+G+llgkNpvfIZHS6ZEksay41oTcO0JkSVpTCCxs2osOSICM6yhi9qnYvre\nE/7QOviguwKBgQDbJ2CYw+uQuKnc5T0LyBQD2BDwWo+rbJSDO7FNppMa5vJhhN\nty4fEOPPG1wFtPFtWnwAD54Ydr5ieemDFXx9qtjSp3EabRFC72px04GJ+T/XlhYM\nL+xaQuV2xa0tvRR0QelRg2g8yMz0bBmUPtCYv/0aUvd9IQW6zfa9BmPUtQKBgC42\nG+ZHihB2VlCJQMQtD2kD5kmC7heQXhxIA3P5BrTcR8zv6fuGGb8UO+A6AwToy2z9\ZMfjnySeYl1eQyUbFBW0rFPoJa0DXbge4QlWqDzOUesuTGJACq95MP6CtuSPMDVR\naVhPVMQB4cmhaleXwjdeZVpOSn/SdD+5Nz/w0zq9AoGAO7j7hc9SRacoTUU2MJOT\n6+y8q1hFUuOb+tb3LwHzkdQ5kyHyNs5PT0Ib994jAon7Ocfl8bL6ILtNDMBiKVXf\nkg3B0lPkRSW+cDAUAENasCH3OrQrlYVceYnmu/Yc2K3nOvoJS2BLiGa/aCjCPHE2\nNVhK+Ycb7OpMDt2fyWIkyEY=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 2. COMMAND LOADER
const commands = new Map();
const loadCommands = () => {
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) fs.mkdirSync(cmdPath);
    fs.readdirSync(cmdPath).forEach(folder => {
        const folderPath = path.join(cmdPath, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            fs.readdirSync(folderPath).forEach(file => {
                if (file.endsWith('.js')) {
                    const cmd = require(path.join(folderPath, file));
                    cmd.category = folder;
                    commands.set(cmd.name, cmd);
                }
            });
        }
    });
};
loadCommands();

const app = express();
app.use(express.static('public'));

async function startBot() {
    // FIX: Tunapitisha COLLECTION pekee, sio Document.
    const { useFirebaseAuthState } = require("./lib/firestoreAuth");
    const sessionCollection = db.collection("WRONG_TURN_6_SESSIONS");
    const { state, saveCreds } = await useFirebaseAuthState(sessionCollection);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["WRONG TURN 6", "MacOS", "3.0.0"]
    });

    // PAIRING CODE ENDPOINT
    app.get('/code', async (req, res) => {
        let num = req.query.number;
        if (!num) return res.status(400).send({ error: "Weka namba!" });
        try {
            let code = await sock.requestPairingCode(num.replace(/[^0-9]/g, ''));
            res.send({ code });
        } catch (e) {
            res.status(500).send({ error: "Haikuweza kupata code" });
        }
    });

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public/index.html'));
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("✅ WRONG TURN 6 IMEWAKA!");
            sock.sendPresenceUpdate('available'); 
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const prefix = ".";

        // ANTI-LINK
        if (body.includes("chat.whatsapp.com") || body.includes("http")) {
            await sock.sendMessage(from, { delete: m.key });
        }

        // AUTO STATUS VIEW
        if (from === 'status@broadcast') {
            await sock.readMessages([m.key]);
        }

        // COMMAND HANDLER
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const cmd = commands.get(cmdName);
            if (cmd) {
                try {
                    await cmd.execute(m, sock, Array.from(commands.values()), args);
                } catch (err) {
                    console.error(err);
                }
            }
        }
    });

    // ANTI-CALL
    sock.ev.on('call', async (c) => {
        if (c[0].status === 'offer') {
            await sock.rejectCall(c[0].id, c[0].from);
            await sock.sendMessage(c[0].from, { text: "📵 *SECURITY:* WRONG TURN 6 Calls Blocked." });
        }
    });
}

app.listen(3000, () => {
    console.log("Server active: Port 3000");
    startBot();
});
