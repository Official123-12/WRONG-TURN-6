const { 
    default: makeWASocket, useMultiFileAuthState, Browsers, delay, 
    makeCacheableSignalKeyStore, DisconnectReason 
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");
const { User } = require("./database");

const app = express();
const port = process.env.PORT || 3000;
app.use(express.static('public'));

mongoose.connect(config.mongoUri).then(() => console.log("✅ MONGO MATRIX ACTIVE"));

const msgCache = {}; // Memory for Anti-Delete

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false,
        syncFullHistory: true
    });

    // FIX PRECONDITION ERROR: Long delay and check
    if (!sock.authState.creds.registered && num) {
        await delay(15000); 
        try {
            let code = await sock.requestPairingCode(num.trim());
            if (res && !res.headersSent) res.json({ code });
        } catch (e) { if (res) res.status(500).json({ error: "Try Again In 1 Min" }); }
    }

    sock.ev.on("creds.update", saveCreds);

    // AUTO STATUS VIEW & LIKE
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]); // View
            await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.key.participant] }); // Like
            return;
        }

        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        msgCache[msg.key.id] = msg; // Store for Anti-Delete

        // 1. REGISTER USER & LOAD SETTINGS
        let user = await User.findOne({ id: sender });
        if (!user) user = await User.create({ id: sender, name: msg.pushName });

        // 2. FORCE JOIN CHECK
        if (body.startsWith(config.prefix)) {
            try {
                const groupMetadata = await sock.groupMetadata(config.groupId);
                const isMember = groupMetadata.participants.find(p => p.id === sender);
                if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
                    return await sock.sendMessage(from, { text: `⚠️ *ACCESS DENIED*\n\nJoin our Group & Channel to unlock *WRONG TURN 6*.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
                }
            } catch (e) {}
        }

        // 3. ANTI-LINK (PURGE)
        if (user.antiLink && body.match(/(chat.whatsapp.com|whatsapp.com\/channel)/gi) && from.endsWith('@g.us')) {
            await sock.sendMessage(from, { delete: msg.key });
            return await sock.sendMessage(from, { text: "🚫 *Links are blocked here!*" });
        }

        // 4. VIEW-ONCE BYPASS
        if (user.viewOnceBypass && msg.message.viewOnceMessageV2) {
            await sock.sendMessage(sock.user.id, { forward: msg });
            await sock.sendMessage(from, { text: "🔓 *Anti-ViewOnce:* Captured to private vault." });
        }

        const cmd = body.startsWith(config.prefix) ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const q = body.slice(config.prefix.length + cmd.length).trim();

        if (cmd) {
            await sock.sendPresenceUpdate('composing', from);
            
            switch (cmd) {
                case 'menu':
                    // Verified Blue Tick Identity
                    const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + `FN:${config.botName} ✔️\n` + `ORG:DEVELOPER STANYTZ;\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
                    await sock.sendMessage(from, { contacts: { displayName: `${config.botName} ✔️`, contacts: [{ vcard }] } });

                    const menu = `┏━━━━『 *WRONG TURN 6* 』━━━━┓
┃ 👤 *Dev:* STANYTZ ✔️
┃ 🚀 *Status:* Overlord Online
┗━━━━━━━━━━━━━━━━━━━━━━┛

🌸 *⚙️ USER SETTINGS* 🌸
┃ ➥ .settings (View My Config)
┃ ➥ .set [feature] (Toggle ON/OFF)

🌸 *💰 WEALTH HUB* 🌸
┃ ➥ .livescore (Live Football)
┃ ➥ .forex (Live Signals)
┃ ➥ .crypto (Binance Price)
┃ ➥ .odds (Sure 2+ Tips)
┃ ➥ .jobs (Remote Work)

🌸 *🎬 DOWNLOAD HUB* 🌸
┃ ➥ .tt (TikTok HD)
┃ ➥ .ig (Insta Reels)
┃ ➥ .yt (YouTube Master)
┃ ➥ .spotify (HQ Music)
┃ ➥ .movie (Search Info)

🌸 *🛡️ ADMIN HUB* 🌸
┃ ➥ .tagall (Broadcast)
┃ ➥ .hidetag (Ghost Tag)
┃ ➥ .kick / .add / .promote
┃ ➥ .antilink (ON/OFF)

🌸 *🧠 INTELLECT HUB* 🌸
┃ ➥ .gpt (Advanced AI)
┃ ➥ .solve (Math solver)
┃ ➥ .wiki (Encyclopedia)
┃ ➥ .translate (100+ Lang)

┗━━━━━━━━━━━━━━━━━━━━━━┛
🌸 *Powered by STANYTZ*`;
                    await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menu });
                    break;

                case 'settings':
                    const sets = `⚙️ *YOUR BOT CONFIG:* @${sender.split('@')[0]}\n\n1. Anti-Link: ${user.antiLink ? '✅' : '❌'}\n2. Anti-Delete: ${user.antiDelete ? '✅' : '❌'}\n3. Status View: ${user.autoStatusView ? '✅' : '❌'}\n4. View-Once Bypass: ${user.viewOnceBypass ? '✅' : '❌'}\n\n*Use .set [name] to toggle!*`;
                    await sock.sendMessage(from, { text: sets, mentions: [sender] });
                    break;

                case 'set':
                    if (q === 'antilink') user.antiLink = !user.antiLink;
                    if (q === 'antidelete') user.antiDelete = !user.antiDelete;
                    await user.save();
                    await sock.sendMessage(from, { text: `✅ *Settings Updated for ${q}*` });
                    break;

                case 'restart':
                    if (from.includes(config.ownerNumber)) process.exit();
                    break;
            }
        }
    });

    // 5. ANTI-DELETE ENGINE
    sock.ev.on("messages.update", async (u) => {
        for (const update of u) {
            if (update.update.protocolMessage && update.update.protocolMessage.type === 3) {
                const key = update.update.protocolMessage.key;
                const old = msgCache[key.id];
                if (old) {
                    await sock.sendMessage(sock.user.id, { text: `🛡️ *Anti-Delete:* Message from @${key.remoteJid.split('@')[0]} was deleted.\n\nContent: ${old.message.conversation || "Media File"}`, mentions: [key.remoteJid] });
                    await sock.sendMessage(sock.user.id, { forward: old });
                }
            }
        }
    });

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "open") sock.sendPresenceUpdate('available'); 
        if (u.connection === "close") startEngine();
    });
}

app.get("/get-pair", (req, res) => startEngine(req.query.num, res));
app.listen(port, () => startEngine());
