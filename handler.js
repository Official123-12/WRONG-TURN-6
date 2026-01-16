const axios = require("axios");
const config = require("./config");
const { db } = require("./database");

const commandHandler = async (sock, msg) => {
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
    const isCmd = body.startsWith(config.prefix);

    // 1. AUTO STATUS VIEW & LIKE
    if (from === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        await sock.sendMessage('status@broadcast', { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.participant] });
        return;
    }

    // 2. FORCE JOIN CHECK (Strict Lockdown)
    if (isCmd) {
        try {
            const groupMetadata = await sock.groupMetadata(config.groupId);
            const isMember = groupMetadata.participants.find(p => p.id === sender);
            if (!isMember && sender !== config.ownerNumber + "@s.whatsapp.net") {
                return await sock.sendMessage(from, { text: `⚠️ *LOCKED BY STANYTZ*\n\nYou must join our Group and Channel to use WRONG TURN 6.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}` });
            }
        } catch (e) {}
    }

    if (!isCmd) return;

    const arg = body.slice(config.prefix.length).trim().split(/ +/g);
    const cmdName = arg.shift().toLowerCase();
    const q = arg.join(" ");
    const command = global.commands.get(cmdName);

    if (command) {
        // AUTO PRESENCE
        await sock.sendPresenceUpdate('composing', from); 
        try {
            await command.execute(sock, msg, arg, config);
        } catch (e) {
            console.error(e);
        }
    }
};

module.exports = { commandHandler };
