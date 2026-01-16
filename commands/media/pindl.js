const axios = require("axios");
module.exports = {
    name: "pindl",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Link needed, blood!" });
        try {
            const res = await axios.get(`https://api.shizuka.site/pindl?url=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { image: { url: res.data.result }, caption: "Captured by WRONG TURN 6 ✔️" });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Failed to fetch Pinterest media." }); }
    }
};
