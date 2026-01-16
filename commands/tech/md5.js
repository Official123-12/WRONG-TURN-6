const crypto = require('crypto');
module.exports = {
    name: "md5",
    async execute(sock, msg, args) {
        const text = args.join(" ");
        if (!text) return sock.sendMessage(msg.key.remoteJid, { text: "Text to hash?" });
        const hash = crypto.createHash('md5').update(text).digest('hex');
        await sock.sendMessage(msg.key.remoteJid, { text: `🔐 *MD5 HASH:* \n\n${hash}` });
    }
};
