const axios = require("axios");
module.exports = {
    name: "ip",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide IP address!" });
        try {
            const res = await axios.get(`http://ip-api.com/json/${args[0]}`);
            const data = `🔐 *IP TRACKER DATA* 🔐\n\n🌍 *Country:* ${res.data.country}\n🏙️ *City:* ${res.data.city}\n📡 *ISP:* ${res.data.isp}\n🕒 *Timezone:* ${res.data.timezone}\n📍 *Lat/Lon:* ${res.data.lat}, ${res.data.lon}`;
            await sock.sendMessage(msg.key.remoteJid, { text: data });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "IP Lookup failed." }); }
    }
};
