const axios = require("axios");
module.exports = {
    name: "tt",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Link needed!" });
        const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${args[0]}`);
        await sock.sendMessage(msg.key.remoteJid, { video: { url: res.data.video.noWatermark }, caption: "Done." });
    }
};
