module.exports = {
    name: "tagall",
    async execute(sock, msg, args) {
        const metadata = await sock.groupMetadata(msg.key.remoteJid);
        const participants = metadata.participants.map(v => v.id);
        await sock.sendMessage(msg.key.remoteJid, { text: `📢 *ATTENTION EVERYONE:*\n\n${args.join(" ") || "No message."}`, mentions: participants });
    }
};
