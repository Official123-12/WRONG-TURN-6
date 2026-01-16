const { User } = require("../../database");
module.exports = {
    name: "settings",
    async execute(sock, msg, args) {
        const sender = msg.key.participant || msg.key.remoteJid;
        const user = await User.findOne({ id: sender });
        const sets = `⚙️ *YOUR MATRIX CONFIG* ⚙️\n\n👤 *User:* @${sender.split('@')[0]}\n\n🛡️ Anti-Link: ${user.antiLink ? '✅' : '❌'}\n🛡️ Anti-Delete: ${user.antiDelete ? '✅' : '❌'}\n👁️ Auto-Status: ${user.autoStatus ? '✅' : '❌'}\n\n*Use .set [feature] to toggle!*`;
        await sock.sendMessage(msg.key.remoteJid, { text: sets, mentions: [sender] });
    }
};
