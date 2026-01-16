const { User } = require("../../database");
module.exports = {
    name: "antilink",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        let user = await User.findOne({ id: sender });
        user.antiLink = !user.antiLink;
        await user.save();
        await sock.sendMessage(from, { text: `🛡️ *Anti-Link system is now ${user.antiLink ? 'ON' : 'OFF'}*` });
    }
};
