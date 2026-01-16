const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");
const { User } = require("./database");

const app = express();
app.use(express.static('public'));

mongoose.connect(config.mongoUri).then(() => console.log("✅ Neural Matrix Database Online"));

const msgCache = {}; 

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    if (!sock.authState.creds.registered && num) {
        await delay(10000); 
        try {
            const code = await sock.requestPairingCode(num.trim());
            if (res) res.json({ code });
        } catch (e) { if (res) res.status(500).send("Matrix Fail"); }
    }

    sock.ev.on("creds.update", saveCreds);

    // 1. AUTO STATUS MANAGER (View, Like, Reply)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (msg.key.remoteJid === 'status@broadcast') {
            const botSettings = await User.findOne({ id: config.ownerNumber + "@s.whatsapp.net" });
            if (botSettings?.autoStatusView) {
                await sock.readMessages([msg.key]);
                console.log(`👁️ Status viewed from: ${msg.pushName}`);
            }
            if (botSettings?.autoStatusLike) {
                await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            if (botSettings?.autoStatusReply) {
                await sock.sendMessage(msg.key.participant, { text: botSettings.statusReplyMsg }, { quoted: msg });
            }
            return;
        }

        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        msgCache[msg.key.id] = msg;

        // 2. GLOBAL ANTI-LINK (Auto-Delete)
        if (body.match(/(https:\/\/chat.whatsapp.com)/gi) || body.match(/(https:\/\/whatsapp.com\/channel)/gi)) {
            const user = await User.findOne({ id: sender });
            if (user?.antiLink && from.endsWith('@g.us')) {
                await sock.sendMessage(from, { delete: msg.key });
                return await sock.sendMessage(from, { text: "🚫 *Links are prohibited in this Matrix.*" });
            }
        }

        // 3. FORCE JOIN LOCKDOWN
        if (body.startsWith(config.prefix)) {
            try {
                const metadata = await sock.groupMetadata(config.groupId);
                const isMember = metadata.participants.find(p => p.id === sender);
                if (!isMember) {
                    return await sock.sendMessage(from, { text: `⚠️ *ACCESS DENIED*\n\nFollow Channel & Join Group to unlock commands.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
                }
            } catch (e) {}
        }

        // 4. AUTO-PRESENCE
        await sock.sendPresenceUpdate('composing', from);

        const cmd = body.startsWith(config.prefix) ? body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const q = body.slice(config.prefix.length + cmd.length).trim();

        if (cmd) {
            switch (cmd) {
                case 'menu':
                    const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + `FN:WRONG TURN 6 ✔️\n` + `ORG:DEVELOPER STANYTZ;\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
                    await sock.sendMessage(from, { contacts: { displayName: 'WRONG TURN 6 ✔️', contacts: [{ vcard }] } });

                    const menuText = `┏━━━━『 *WRONG TURN 6* 』━━━━┓
┃ 👤 *Developer:* STANYTZ ✔️
┃ 🚀 *Status:* Overlord Online
┗━━━━━━━━━━━━━━━━━━━━━━┛

🌸 *💰 WEALTH HUB* 🌸
┃ ➥ .livescore (Real-Time)
┃ ➥ .forex (Live Signals)
┃ ➥ .crypto (Binance Price)
┃ ➥ .arbitrage (Price Gap)
┃ ➥ .odds (Sure 2+ Tips)
┃ ➥ .faucet (Daily Coins)

🌸 *🎬 DOWNLOAD HUB* 🌸
┃ ➥ .tt (TikTok HD)
┃ ➥ .ig (Insta Reels)
┃ ➥ .yt (YouTube Master)
┃ ➥ .spotify (HQ Music)
┃ ➥ .fb (Facebook DL)
┃ ➥ .movie (Search Info)

🌸 *🛡️ ADMIN HUB* 🌸
┃ ➥ .tagall (Broadcast)
┃ ➥ .hidetag (Ghost Tag)
┃ ➥ .kick / .add / .promote
┃ ➥ .antilink (ON/OFF)
┃ ➥ .antidelete (Active)
┃ ➥ .settings (User Config)

🌸 *🧠 INTELLECT HUB* 🌸
┃ ➥ .gpt (Advanced AI)
┃ ➥ .solve (Math solver)
┃ ➥ .wiki (Encyclopedia)
┃ ➥ .translate (100+ Lang)

🌸 *🛐 LIFE & FAITH* 🌸
┃ ➥ .bible / .quran
┃ ➥ .motivate (Daily Speech)
┃ ➥ .doctor (Medical AI)

┗━━━━━━━━━━━━━━━━━━━━━━┛
🌸 *Follow:* ${config.channelLink}`;
                    await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menuText });
                    break;

                case 'settings':
                    const user = await User.findOne({ id: sender }) || await User.create({ id: sender, name: pushName });
                    const sets = `⚙️ *USER SETTINGS:* @${sender.split('@')[0]}\n\n1. Anti-Link: ${user.antiLink ? '✅' : '❌'}\n2. Anti-Delete: ${user.antiDelete ? '✅' : '❌'}\n3. Auto-Status View: ${user.autoStatusView ? '✅' : '❌'}\n4. Auto-Status Like: ${user.autoStatusLike ? '✅' : '❌'}\n\n*Use .set [feature] to toggle.*`;
                    await sock.sendMessage(from, { text: sets, mentions: [sender] });
                    break;

                case 'tt':
                    const tt = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
                    await sock.sendMessage(from, { video: { url: tt.data.video.noWatermark }, caption: "Downloaded by WRONG TURN 6" });
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
                    await sock.sendMessage(sock.user.id, { text: `🛡️ *Matrix Anti-Delete:* Captured from @${key.remoteJid.split('@')[0]}\nMsg: ${old.message.conversation || "Media"}`, mentions: [key.remoteJid] });
                    await sock.sendMessage(sock.user.id, { forward: old });
                }
            }
        }
    });
}

app.get("/get-pair", (req, res) => startEngine(req.query.num, res));
app.listen(3000, () => startEngine());
