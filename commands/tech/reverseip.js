const axios = require("axios");
module.exports = {
    name: "reverseip",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide IP address or Domain!" });
        try {
            const res = await axios.get(`https://api.shizuka.site/reverseip?domain=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { text: `🕵️ *REVERSE IP DATA* 🕵️\n\n${res.data.result || "No other domains found on this server."}` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Reverse IP server busy." }); }
    }
};
