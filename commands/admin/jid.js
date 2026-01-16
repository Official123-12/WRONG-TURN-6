module.exports = {
    name: "jid",
    async execute(sock, msg, args) {
        await sock.sendMessage(msg.key.remoteJid, { text: `🆔 *ENTITY ID:* \n\n${msg.key.remoteJid}` });
    }
};
