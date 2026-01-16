const axios = require("axios");
module.exports = {
    name: "joke",
    async execute(sock, msg, args) {
        try {
            const res = await axios.get("https://official-joke-api.appspot.com/random_joke");
            await sock.sendMessage(msg.key.remoteJid, { text: `😂 *WT6 JOKE:* \n\n${res.data.setup}\n\n*Answer:* ${res.data.punchline}` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Not in a funny mood right now." }); }
    }
};
