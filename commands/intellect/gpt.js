const axios = require("axios");
module.exports = {
    name: "gpt",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Ask me anything, blood!" });
        try {
            const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
            await sock.sendMessage(msg.key.remoteJid, { text: `🧠 *WT6 AI:* ${res.data.success}` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "AI is thinking too hard, try later." }); }
    }
};
