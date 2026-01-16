const config = require("../../config");

module.exports = {
    name: "menu",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        
        // Verified Identity VCard with Blue Tick
        const vcard = 'BEGIN:VCARD\nVERSION:3.0\n' + `FN:WRONG TURN 6 ✔️\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
        await sock.sendMessage(from, { contacts: { displayName: 'WRONG TURN 6 ✔️', contacts: [{ vcard }] } });

        const menuText = `┏━━━━ 『 *WRONG TURN 6* 』 ━━━━┓
┃ 👤 *Developer:* STANYTZ ✔️
┃ 🚀 *Status:* Overlord Active
┃ ⚡ *Mode:* Universal Omni-OS
┗━━━━━━━━━━━━━━━━━━━━━━┛

🌸 *💰 WEALTH HUB (100+)* 🌸
┃ ➥ .livescore (Live Football)
┃ ➥ .odds (Sure 2+ Tips)
┃ ➥ .fixed (Correct Score)
┃ ➥ .arbitrage (Crypto Gaps)
┃ ➥ .forex (Live Signals)
┃ ➥ .crypto (Binance Prices)
┃ ➥ .binance (Top Gainers)
┃ ➥ .stocks (Global Market)
┃ ➥ .jobs (Remote Work Gigs)
┃ ➥ .bizidea (Daily Money)
┃ ➥ .faucet (Free Coins)

🌸 *🧠 INTELLECT HUB (150+)* 🌸
┃ ➥ .gpt (Neural AI Research)
┃ ➥ .solve (Step-by-Step Solver)
┃ ➥ .wiki (Encyclopedia)
┃ ➥ .translate (100+ Lang)
┃ ➥ .course (Free Udemy Links)
┃ ➥ .pdf (Professional Tools)
┃ ➥ .ocr (Scan Image to Text)
┃ ➥ .summary (Shorten Text)
┃ ➥ .code (Programming AI)

🌸 *🎬 DOWNLOAD HUB (100+)* 🌸
┃ ➥ .tt (TikTok HD Master)
┃ ➥ .ig (Insta Master DL)
┃ ➥ .yt (YouTube Master)
┃ ➥ .spotify (HQ Music)
┃ ➥ .fb (Facebook Master)
┃ ➥ .pin (Pinterest DL)
┃ ➥ .movie (Search Info)
┃ ➥ .sticker (Fast Maker)

🌸 *🛡️ ADMIN & SAFETY (100+)* 🌸
┃ ➥ .tagall (Broadcast)
┃ ➥ .hidetag (Ghost Tag)
┃ ➥ .kick / .add / .promote
┃ ➥ .antilink (Protection)
┃ ➥ .antidelete (Capture)
┃ ➥ .antiviewonce (Capture)
┃ ➥ .settings (Config)

🌸 *🛐 LIFE & FAITH (50+)* 🌸
┃ ➥ .bible (KJV Verse)
┃ ➥ .quran (Ayah + Tafsir)
┃ ➥ .doctor (Medical AI)
┃ ➥ .motivate (Daily Speech)
┃ ➥ .health (Neural Tips)

┗━━━━━━━━━━━━━━━━━━━━━━┛
🌸 *Follow:* ${config.channelLink}
🌸 *Owner:* ${config.ownerName}`;

        await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menuText });
    }
};
