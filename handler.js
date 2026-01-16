const config = require("./config");
const { User } = require("./database");
const axios = require("axios");

const commandHandler = async (sock, msg) => {
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
    const isCmd = body.startsWith(config.prefix);

    // 1. AUTO STATUS VIEW
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        return;
    }

    if (msg.key.fromMe) return;

    // 2. USER SETTINGS & REGISTRATION
    let user = await User.findOne({ id: sender }) || await User.create({ id: sender, name: msg.pushName });

    // 3. ANTI-VIEWONCE BYPASS
    if (user.antiViewOnce && msg.message.viewOnceMessageV2) {
        await sock.sendMessage(sock.user.id, { forward: msg }, { quoted: msg });
        await sock.sendMessage(from, { text: "🔓 *Anti-ViewOnce Captured and Saved.*" });
    }

    if (!isCmd) return;

    const arg = body.slice(config.prefix.length).trim().split(/ +/g);
    const cmdName = arg.shift().toLowerCase();
    const command = global.commands.get(cmdName);

    if (command) {
        // ALWAYS ONLINE & TYPING LOGIC
        if (user.alwaysOnline) await sock.sendPresenceUpdate('available', from);
        if (user.autoTyping) await sock.sendPresenceUpdate('composing', from);

        try {
            await command.execute(sock, msg, arg);
        } catch (e) {
            console.log(e);
        }
    }
};

module.exports = { commandHandler };
