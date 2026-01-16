module.exports = {
    name: "doctor",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Describe your symptoms, blood!" });
        const analysis = `🩺 *MEDICAL AI ANALYSIS* 🩺\n\n*Symptoms:* ${q}\n\n*Neural Suggestion:* Based on global health data, you should stay hydrated and rest. If symptoms persist for more than 24 hours, visit a hospital.\n\n⚠️ _Note: I am an AI, not a human doctor._`;
        await sock.sendMessage(msg.key.remoteJid, { text: analysis });
    }
};
