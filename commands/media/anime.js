const axios = require("axios");
module.exports = {
    name: "anime",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Anime name, blood?" });
        try {
            const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1`);
            const data = res.data.data[0];
            const text = `🎌 *ANIME INFO: ${data.title}* 🎌\n\n🌟 *Score:* ${data.score}\n📺 *Type:* ${data.type}\n📅 *Status:* ${data.status}\n🎞️ *Episodes:* ${data.episodes}\n\n📝 *Synopsis:* ${data.synopsis.slice(0, 300)}...`;
            await sock.sendMessage(msg.key.remoteJid, { image: { url: data.images.jpg.large_image_url }, caption: text });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Anime server busy." }); }
    }
};
