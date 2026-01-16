module.exports = {
    name: "solidarity",
    async execute(sock, msg, args) {
        const tips = [
            "🤝 *Mutual Aid:* Help others not out of charity, but out of shared humanity.",
            "🌍 *Justice:* Injustice anywhere is a threat to justice everywhere.",
            "🌸 *Empathy:* Understand the struggle of others as if it were your own.",
            "✊ *Unity:* We are stronger when we stand together against oppression."
        ];
        const random = tips[Math.floor(Math.random() * tips.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: `🌹 *HUMANITY & SOLIDARITY* 🌹\n\n${random}\n\n_Live for more than yourself by STANYTZ._` });
    }
};
