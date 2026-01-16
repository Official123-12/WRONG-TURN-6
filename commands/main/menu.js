module.exports = {
    name: "menu",
    async execute(sock, msg, args, config) {
        const from = msg.key.remoteJid;
        const categories = {};
        global.commands.forEach(cmd => {
            if (!categories[cmd.category]) categories[cmd.category] = [];
            categories[cmd.category].push(cmd.name);
        });

        let menuText = `┏━━━━ 『 *WRONG TURN 6* 』 ━━━━┓\n┃ 👤 *Developer:* STANYTZ ✔️\n┃ 🚀 *Status:* Overlord Online\n┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;

        Object.keys(categories).sort().forEach(cat => {
            menuText += `🌸 *${cat} HUB* 🌸\n`;
            categories[cat].sort().forEach(cmd => {
                menuText += `┃ ➥ .${cmd}\n`;
            });
            menuText += `┃\n`;
        });

        menuText += `┗━━━━━━━━━━━━━━━━━━━━━━┛\n🌸 *Follow:* ${config.channelLink}`;

        // Send VCard Identity
        const vcard = 'BEGIN:VCARD\nVERSION:3.0\n' + `FN:${config.botName} ✔️\n` + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` + 'END:VCARD';
        await sock.sendMessage(from, { contacts: { displayName: `${config.botName} ✔️`, contacts: [{ vcard }] } });

        await sock.sendMessage(from, { image: { url: config.menuImage }, caption: menuText });
    }
};
