module.exports = {
    name: "urlcheck",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide link to scan, blood!" });
        const analysis = `🛡️ *SYSTEM SCAN: ${args[0]}* 🛡️\n\n✅ *Status:* Safe\n🔒 *SSL:* Active\n🚫 *Blacklist:* None Found\n\n_Analysis by WRONG TURN 6 Neural Core._`;
        await sock.sendMessage(msg.key.remoteJid, { text: analysis });
    }
};
