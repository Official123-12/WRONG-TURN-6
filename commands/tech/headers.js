const axios = require("axios");
module.exports = {
    name: "headers",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide Website URL!" });
        try {
            const res = await axios.get(`https://api.shizuka.site/headers?url=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { text: `🔍 *HTTP HEADERS: ${args[0]}* 🔍\n\n${res.data.result}` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Failed to fetch headers." }); }
    }
};
