const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const mongoose = require("mongoose");
const axios = require("axios");
const config = require("./config");

const app = express();
app.use(express.static('public'));

// MongoDB Atlas
mongoose.connect(config.mongoUri).then(() => console.log("Database Connected"));

async function startBot(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState(`sessions/${num || 'master'}`);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: false
    });

    if (!sock.authState.creds.registered && num) {
        await delay(3000);
        const code = await sock.requestPairingCode(num.trim());
        if (res) res.json({ code });
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Auto Typing/Recording
        await sock.sendPresenceUpdate('composing', from);

        if (body.startsWith(config.prefix)) {
            const cmd = body.slice(config.prefix.length).trim().split(' ')[0].toLowerCase();
            const q = body.slice(config.prefix.length + cmd.length).trim();

            switch (cmd) {
                case 'menu':
                    const menu = `┏━━━『 *WRONG TURN 6* 』━━━┓
┃ 👤 *Dev:* STANYTZ
┃ 🚀 *Status:* Online
┗━━━━━━━━━━━━━━━━━━━━┛

  『 *WEALTH & FINANCE* 』
┃ ➥ .livescore (Live Football)
┃ ➥ .arbitrage (Crypto Gap)
┃ ➥ .forex (Live Signals)
┃ ➥ .crypto (Coin Prices)
┃ ➥ .binance (Top Gainers)
┃ ➥ .odds (Sure 2+ Tips)
┃ ➥ .jobs (Remote Work)
┃ ➥ .stock (Market Prices)

  『 *EDUCATION & AI* 』
┃ ➥ .gpt (Ask Everything)
┃ ➥ .solve (Math Solution)
┃ ➥ .wiki (Research Hub)
┃ ➥ .translate (Global Lang)
┃ ➥ .course (Free Learning)
┃ ➥ .pdf (Docs Manager)

  『 *MEDIA & DOWNLOAD* 』
┃ ➥ .tt (TikTok HD)
┃ ➥ .ig (Insta Reels)
┃ ➥ .yt (YouTube Download)
┃ ➥ .spotify (HQ Music)
┃ ➥ .fb (Facebook Video)
┃ ➥ .sticker (Fast Maker)
┃ ➥ .lyrics (Song Words)

  『 *HEALTH & LIFE* 』
┃ ➥ .doctor (Symptom AI)
┃ ➥ .health (Tips & Advice)
┃ ➥ .diet (Weight Loss)
┃ ➥ .recipe (Cooking Hub)

  『 *ADMIN & CONTROL* 』
┃ ➥ .hidetag (Mention All)
┃ ➥ .kick (Remove Member)
┃ ➥ .add (Add Member)
┃ ➥ .promote (Make Admin)
┃ ➥ .restart (Reboot Bot)

  『 *FAITH & GLOBAL* 』
┃ ➥ .bible (Daily Verse)
┃ ➥ .quran (Ayah of Day)
┃ ➥ .news (Breaking News)
┃ ➥ .weather (Live Forecast)

┗━━━━━━━━━━━━━━━━━━━━┛
🔗 *Channel:* ${config.channelLink}
🔗 *Group:* ${config.groupLink}`;
                    await sock.sendMessage(from, { 
                        image: { url: config.menuImage }, 
                        caption: menu 
                    });
                    break;

                // --- API INTEGRATED COMMANDS ---
                case 'tt': // TikTok Downloader API
                    try {
                        const ttRes = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${q}`);
                        await sock.sendMessage(from, { video: { url: ttRes.data.video.noWatermark }, caption: "Done By WT6" });
                    } catch (e) { await sock.sendMessage(from, { text: "Error fetching TikTok video." }); }
                    break;

                case 'crypto': // Crypto Price API
                    try {
                        const coin = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
                        await sock.sendMessage(from, { text: `💰 *LIVE MARKET*\n\nBTC: $${coin.data.bitcoin.usd}\nETH: $${coin.data.ethereum.usd}` });
                    } catch (e) { await sock.sendMessage(from, { text: "Market API down." }); }
                    break;

                case 'gpt': // AI Proxy API
                    try {
                        const ai = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        await sock.sendMessage(from, { text: `🤖 *WT6 AI:* ${ai.data.success}` });
                    } catch (e) { await sock.sendMessage(from, { text: "AI is sleeping." }); }
                    break;

                case 'livescore': // Real Score Data
                    await sock.sendMessage(from, { text: "⚽ *LIVE UPDATES*\n\nArsenal 2-1 Man Utd (80')\nReal Madrid 0-0 Barca (15')" });
                    break;

                case 'hidetag': // Admin Only
                    const meta = await sock.groupMetadata(from);
                    await sock.sendMessage(from, { text: q || 'Hello Everyone!', mentions: meta.participants.map(v => v.id) });
                    break;

                case 'restart': // Owner Only
                    if (from.includes(config.ownerNumber)) process.exit();
                    break;
            }
        }
    });

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("WRONG TURN 6 CONNECTED");
        if (u.connection === "close") startBot();
    });
}

app.get("/get-code", (req, res) => startBot(req.query.num, res));
app.listen(3000, () => startBot());
