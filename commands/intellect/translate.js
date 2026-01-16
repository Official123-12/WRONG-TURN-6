const axios = require("axios");
module.exports = {
    name: "translate",
    async execute(sock, msg, args) {
        const lang = args[0];
        const text = args.slice(1).join(" ");
        if (!lang || !text) return sock.sendMessage(msg.key.remoteJid, { text: "Use: .translate en Habari" });
        try {
            const res = await axios.get(`https://api.popcat.xyz/translate?to=${lang}&text=${encodeURIComponent(text)}`);
            await sock.sendMessage(msg.key.remoteJid, { text: `🌍 *GLOBAL TRANSLATOR*\n\n*Result:* ${res.data.translated}` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Translation failed!" }); }
    }
};
