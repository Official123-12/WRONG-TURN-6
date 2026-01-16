module.exports = {
    name: "map",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Provide location!" });
        const url = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
        await sock.sendMessage(msg.key.remoteJid, { text: `📍 *GOOGLE MAPS NAVIGATION* 📍\n\nTarget: ${q}\n\n🔗 Link: ${url}` });
    }
};
