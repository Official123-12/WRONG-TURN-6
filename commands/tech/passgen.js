const config = require("../../config");
module.exports = {
    name: "broadcast",
    async execute(sock, msg, args) {
        const sender = msg.key.participant || msg.key.remoteJid;
        if (!sender.includes(config.ownerNumber)) return;
        const text = args.join(" ");
        if (!text) return;
        // Logic ya kutuma kwa watu wote kwenye DB inakuja hapa
        await sock.sendMessage(msg.key.remoteJid, { text: "📢 *Broadcast in progress...*" });
    }
};
