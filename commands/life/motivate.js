const axios = require("axios");
module.exports = {
    name: "motivate",
    async execute(sock, msg, args) {
        const res = await axios.get("https://api.quotable.io/random?tags=motivation");
        await sock.sendMessage(msg.key.remoteJid, { text: `🚀 *STANYTZ MOTIVATION*\n\n"${res.data.content}"\n\n- ${res.data.author}` });
    }
};
