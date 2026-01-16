const axios = require("axios");
module.exports = {
    name: "dns",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Domain needed (e.g google.com)" });
        try {
            const res = await axios.get(`https://api.shizuka.site/dns?domain=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { text: `🛡️ *DNS RECORDS: ${args[0]}*\n\n${res.data.result}` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Failed to fetch DNS records." }); }
    }
};
