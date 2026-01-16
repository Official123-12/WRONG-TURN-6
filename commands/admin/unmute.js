module.exports = {
    name: "unmute",
    async execute(sock, msg, args) {
        if (!msg.key.remoteJid.endsWith('@g.us')) return;
        await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement');
        await sock.sendMessage(msg.key.remoteJid, { text: "🔊 *Matrix Opened:* Everyone can now send messages." });
    }
};
