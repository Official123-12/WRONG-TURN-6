const axios = require("axios");
module.exports = {
    name: "ig",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide Instagram link!" });
        try {
            await sock.sendMessage(msg.key.remoteJid, { text: "📥 *Processing Instagram Media...*" });
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
            await sock.sendMessage(msg.key.remoteJid, { video: { url: res.data.video.noWatermark }, caption: "Done by WRONG TURN 6 ✔️" });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Error: Video private or link broken." }); }
    }
};
