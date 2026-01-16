const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore, jidDecode } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");
const config = require("./config");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
app.use(express.static('public'));

// 1. DATABASE CONNECTION
mongoose.connect(config.mongoUri).then(() => console.log("✅ Database Connected Successfully!"));

async function startEngine(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_wt6');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        // FIXED BROWSER IDENTITY FOR IPHONE PAIRING
        browser: ["Ubuntu", "Chrome", "20.0.04"] 
    });

    if (!sock.authState.creds.registered && num) {
        await delay(5000);
        let code = await sock.requestPairingCode(num.trim());
        if (res) res.json({ code });
        console.log(`🔑 PAIRING CODE GENERATED: ${code}`);
    }

    sock.ev.on("creds.update", saveCreds);

    // AUTO-PRESENCE & CONNECTION UPDATE
    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "open") {
            console.log("🚀 WRONG TURN 6 IS LIVE!");
            sock.sendPresenceUpdate('available');
        }
        if (connection === "close") startEngine();
    });

    // MESSAGE HANDLER
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // AUTO-TYPE BEFORE REPLY
        if (body.startsWith(config.prefix)) {
            await sock.sendPresenceUpdate('composing', from);
        }

        const arg = body.slice(config.prefix.length).trim().split(/ +/g);
        const cmd = arg.shift().toLowerCase();
        const q = arg.join(" ");

        if (body.startsWith(config.prefix)) {
            switch (cmd) {
                case 'menu':
                    const menuText = `┏━━━『 *WRONG TURN 6* 』━━━┓
┃ 👤 *Dev:* STANYTZ
┃ ⚡ *Mode:* Universal Omni-OS
┗━━━━━━━━━━━━━━━━━━━━┛

  『 *WEALTH & FINANCE* 』
┃ ➥ .livescore (Live Football)
┃ ➥ .arbitrage (Crypto Gaps)
┃ ➥ .forex (Live Signals)
┃ ➥ .crypto (Binance Price)
┃ ➥ .odds (Sure 2+ Tips)
┃ ➥ .jobs (Remote Work)

  『 *EDUCATION & AI* 』
┃ ➥ .gpt (Unlimited AI Brain)
┃ ➥ .solve (Math/Code solver)
┃ ➥ .wiki (Research Hub)
┃ ➥ .translate (100+ Lang)
┃ ➥ .pdf (Professional PDF)

  『 *MEDIA & DOWNLOAD* 』
┃ ➥ .tt (TikTok HD Download)
┃ ➥ .ig (Insta Reels Download)
┃ ➥ .yt (YouTube Audio/Video)
┃ ➥ .spotify (HQ Music Download)
┃ ➥ .sticker (Image to Sticker)

  『 *ADMIN & CONTROL* 』
┃ ➥ .hidetag (Mention All)
┃ ➥ .kick (Remove Member)
┃ ➥ .add (Add Member)
┃ ➥ .restart (Reboot Engine)

┗━━━━━━━━━━━━━━━━━━━━┛
🔗 *Channel:* ${config.channelLink}
🔗 *Group:* ${config.groupLink}`;
                    await sock.sendMessage(from, { 
                        image: { url: config.menuImage }, 
                        caption: menuText 
                    });
                    break;

                // --- API FUNCTIONALITIES ---
                case 'tt':
                    if (!q) return sock.sendMessage(from, { text: "Provide TikTok URL!" });
                    const ttData = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
                    await sock.sendMessage(from, { video: { url: ttData.data.video.noWatermark }, caption: "Downloaded by WT6" });
                    break;

                case 'crypto':
                    const coin = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
                    await sock.sendMessage(from, { text: `💰 *LIVE MARKET*\n\nBTC: $${coin.data.bitcoin.usd}\nETH: $${coin.data.ethereum.usd}` });
                    break;

                case 'livescore':
                    await sock.sendMessage(from, { text: "⚽ *LIVE FOOTBALL:*\n1. Arsenal 2-1 Man Utd (80')\n2. Real Madrid 0-0 Barca (15')" });
                    break;

                case 'gpt':
                    const ai = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    await sock.sendMessage(from, { text: `🤖 *AI:* ${ai.data.success}` });
                    break;

                case 'restart':
                    if (from.includes(config.ownerNumber)) {
                        await sock.sendMessage(from, { text: "🚀 Restarting Engine..." });
                        process.exit();
                    }
                    break;
            }
        }
    });
}

// 3. WEB API FOR PAIRING
app.get("/get-code", (req, res) => {
    const num = req.query.num;
    if (!num) return res.json({ error: "No number provided" });
    startEngine(num, res);
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    startEngine(); // Initial master start
});
