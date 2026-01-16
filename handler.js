const config = require("./config");
const { User } = require("./database");

const commandHandler = async (sock, msg) => {
    try {
        if (!msg.message) return;
        
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const body = (msg.message.conversation || 
                      msg.message.extendedTextMessage?.text || 
                      msg.message.imageMessage?.caption || 
                      msg.message.videoMessage?.caption || "").trim();

        if (msg.key.fromMe) return;

        // AUTO STATUS
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            return;
        }

        // BYPASS VIEW-ONCE
        if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
            await sock.sendMessage(sock.user.id, { 
                forward: msg,
                contextInfo: { 
                    mentionedJid: [sender],
                    isForwarded: true 
                }
            });
            await sock.sendMessage(from, { text: "🔓 *Anti-ViewOnce Detected:* Media Captured." });
            return;
        }

        if (!body.startsWith(config.prefix)) return;

        // VERIFY USER IN DATABASE
        let user = await User.findOne({ id: sender });
        if (!user) {
            user = new User({ id: sender });
            await user.save();
        }

        // FORCE JOIN LOCKDOWN - Only if not owner
        const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
        if (!sender.includes(ownerJid)) {
            try {
                const metadata = await sock.groupMetadata(config.groupId);
                const isMember = metadata.participants.find(p => p.id === sender);
                if (!isMember) {
                    const lockMsg = `⚠️ *LOCKED BY STANYTZ*\n\nJoin our Group & Channel to unlock commands.\n\n🔗 *Group:* ${config.groupLink}\n🔗 *Channel:* ${config.channelLink}`;
                    await sock.sendMessage(from, { 
                        text: lockMsg,
                        contextInfo: { 
                            mentionedJid: [sender],
                            forwardingScore: 999,
                            isForwarded: true 
                        }
                    });
                    return;
                }
            } catch (e) {
                console.log("Group check error:", e.message);
            }
        }

        const args = body.slice(config.prefix.length).trim().split(/ +/g);
        const cmdName = args.shift().toLowerCase();
        const command = global.commands.get(cmdName);

        if (command) {
            await sock.sendPresenceUpdate('composing', from);
            await command.execute(sock, msg, args);
        } else {
            await sock.sendMessage(from, { 
                text: `❌ Command *${cmdName}* haipo!\n\nTumia *.menu* kuona commands zote.` 
            });
        }

    } catch (error) {
        console.log("Handler error:", error);
        await sock.sendMessage(sock.user.id, { 
            text: `❌ Error in handler:\n${error.message}` 
        });
    }
};

module.exports = { commandHandler };
