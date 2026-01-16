const config = require("./config");
const { User } = require("./database");

const commandHandler = async (sock, msg) => {
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();

    // AUTO STATUS
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.participant] });
        return;
    }

    if (msg.key.fromMe) return;

    // BYPASS VIEW-ONCE
    if (msg.message.viewOnceMessageV2) {
        await sock.sendMessage(sock.user.id, { forward: msg });
        await sock.sendMessage(from, { text: "🔓 *Anti-ViewOnce Detected:* Media Captured." });
    }

    if (!body.startsWith(config.prefix)) return;

    // FORCE JOIN LOCKDOWN
    try {
        const metadata = await sock.groupMetadata(config.groupId);
        const isMember = metadata.participants.find(p => p.id === sender);
        if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
            return await sock.sendMessage(from, { text: `⚠️ *LOCKED BY STANYTZ*\n\nJoin our Group & Channel to unlock commands.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
        }
    } catch (e) {}

    const arg = body.slice(config.prefix.length).trim().split(/ +/g);
    const cmdName = arg.shift().toLowerCase();
    const command = global.commands.get(cmdName);

    if (command) {
        await sock.sendPresenceUpdate('composing', from);
        await command.execute(sock, msg, arg);
    }
};

module.exports = { commandHandler };
