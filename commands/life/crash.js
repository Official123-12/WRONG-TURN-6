module.exports = {
    name: "crash",
    async execute(sock, msg, args) {
        const multipliers = [1.02, 1.5, 2.0, 5.0, 0.0, 1.1, 10.0];
        const res = multipliers[Math.floor(Math.random() * multipliers.length)];
        const text = `🚀 *CRASH GAME* 🚀\n\nThe plane took off...\n\n💥 *Crashed at:* ${res}x\n\n${res > 2 ? "✅ PROFIT!" : "❌ LOSS!"}`;
        await sock.sendMessage(msg.key.remoteJid, { text });
    }
};
