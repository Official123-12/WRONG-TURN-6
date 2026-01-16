module.exports = {
    name: "hidetag",
    async execute(sock, msg, args) {
        if (!msg.key.remoteJid.endsWith('@g.us')) return;
        const metadata = await sock.groupMetadata(msg.key.remoteJid);
        const participants = metadata.participants.map(v => v.id);
        await sock.sendMessage(msg.key.remoteJid, { text: args.join(" ") || "Ghost Tag Active 👻", mentions: participants });
    }
};
