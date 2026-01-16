const config = require("./config");
const { User } = require("./database");

const commandHandler = async (sock, msg) => {
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();

    // 1. AUTO STATUS VIEW & LIKE
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.participant] });
        return;
    }

    // 2. ANTI-LINK PROTECTION
    if (body.match(/(chat.whatsapp.com|whatsapp.com\/channel)/gi) && from.endsWith('@g.us')) {
        await sock.sendMessage(from, { delete: msg.key });
        return await sock.sendMessage(from, { text: "🚫 *Links are strictly blocked by WRONG TURN 6.*" });
    }

    if (!body.startsWith(config.prefix)) return;

    // 3. FORCE JOIN LOCKDOWN
    try {
        const metadata = await sock.groupMetadata(config.groupId);
        const isMember = metadata.participants.find(p => p.id === sender);
        if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
            return await sock.sendMessage(from, { text: `⚠️ *MATRIX LOCKED*\n\nJoin Group & Channel to use commands.\n\n🔗 ${config.groupLink}` });
        }
    } catch (e) {}

    // 4. DYNAMIC COMMAND EXECUTION
    const arg = body.slice(config.prefix.length).trim().split(/ +/g);
    const cmdName = arg.shift().toLowerCase();
    const command = global.commands.get(cmdName);

    if (command) {
        await sock.sendPresenceUpdate('composing', from); // Auto-typing (Anti-ban policy)
        await command.execute(sock, msg, arg, config);
    }
};

module.exports = { commandHandler };
