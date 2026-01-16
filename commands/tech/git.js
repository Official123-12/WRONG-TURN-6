const axios = require("axios");
module.exports = {
    name: "git",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide GitHub username, blood!" });
        try {
            const res = await axios.get(`https://api.github.com/users/${args[0]}`);
            const data = `💻 *GITHUB NEURAL DATA* 💻\n\n🚀 *User:* ${res.data.name}\n📂 *Public Repos:* ${res.data.public_repos}\n👥 *Followers:* ${res.data.followers}\n📝 *Bio:* ${res.data.bio || "No bio."}\n🔗 *Link:* ${res.data.html_url}`;
            await sock.sendMessage(msg.key.remoteJid, { image: { url: res.data.avatar_url }, caption: data });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "User not found in Matrix database." }); }
    }
};
