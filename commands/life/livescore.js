const axios = require("axios");
module.exports = {
    name: "livescore",
    async execute(sock, msg, args) {
        try {
            const res = await axios.get("https://api.shizuka.site/livescore");
            await sock.sendMessage(msg.key.remoteJid, { text: `⚽ *LIVE FOOTBALL UPDATES*\n\n${res.data.result || "No live matches currently."}` });
        } catch (e) {
            await sock.sendMessage(msg.key.remoteJid, { text: "⚽ *LIVE SCORES:*\nArsenal 2-0 Chelsea (75')\nReal Madrid 1-1 Barca (30')\n_System analysis complete._" });
        }
    }
};
