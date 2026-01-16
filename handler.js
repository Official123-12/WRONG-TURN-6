const axios = require("axios");

const commandHandler = async (sock, msg, config) => {
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();

    // 1. AUTO STATUS VIEW & LIKE
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.participant] });
        return;
    }

    if (msg.key.fromMe) return;

    // 2. ANTI-LINK PURGE
    if (body.match(/(chat.whatsapp.com|whatsapp.com\/channel)/gi) && from.endsWith('@g.us')) {
        await sock.sendMessage(from, { delete: msg.key });
        return;
    }

    if (!body.startsWith(config.prefix)) return;

    // 3. FORCE JOIN
    try {
        const metadata = await sock.groupMetadata(config.groupId);
        const isMember = metadata.participants.find(p => p.id === sender);
        if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
            return await sock.sendMessage(from, { text: `⚠️ *LOCKED*\nJoin Group & Channel to use commands.\n\n🔗 ${config.groupLink}` });
        }
    } catch (e) {}

    const arg = body.slice(config.prefix.length).trim().split(/ +/g);
    const cmdName = arg.shift().toLowerCase();
    const command = global.commands.get(cmdName);

    if (command) {
        await sock.sendPresenceUpdate('composing', from);
        await command.execute(sock, msg, arg, config);
    }
};

module.exports = { commandHandler };
