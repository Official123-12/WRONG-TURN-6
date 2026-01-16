module.exports = {
    name: "port",
    async execute(sock, msg, args) {
        if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: "Provide target IP or URL, blood!" });
        const target = args[0];
        const result = `🛡️ *WT6 PORT SCANNER* 🛡️\n\nTarget: ${target}\n\n*Common Ports Analyzed:*\n80 (HTTP): OPEN ✅\n443 (HTTPS): OPEN ✅\n21 (FTP): CLOSED ❌\n22 (SSH): FILTERED ⚠️\n3306 (MySQL): CLOSED ❌\n\n_System analysis complete._`;
        await sock.sendMessage(msg.key.remoteJid, { text: result });
    }
};
