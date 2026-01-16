module.exports = {
    name: "mute",
    async execute(sock, msg, args) {
        if (!msg.key.remoteJid.endsWith('@g.us')) return;
        await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement');
        await sock.sendMessage(msg.key.remoteJid, { text: "🔇 *Matrix Silence:* Only admins can send messages now." });
    }
};
