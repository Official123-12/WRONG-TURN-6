const axios = require("axios");
module.exports = {
    name: "fact",
    async execute(sock, msg, args) {
        try {
            const res = await axios.get("https://uselessfacts.jsph.pl/random.json?language=en");
            await sock.sendMessage(msg.key.remoteJid, { text: `💡 *DID YOU KNOW?*\n\n"${res.data.text}"` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "I've run out of facts for now!" }); }
    }
};
