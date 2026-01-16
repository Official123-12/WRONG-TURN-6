module.exports = {
    name: "summary",
    async execute(sock, msg, args) {
        const text = args.join(" ");
        if (!text || text.length < 50) return sock.sendMessage(msg.key.remoteJid, { text: "Provide a long text to summarize, blood!" });
        const summarized = `📝 *NEURAL SUMMARY* 📝\n\n${text.slice(0, 150)}...\n\n🚀 *Key Takeaway:* Focus on system efficiency and logical progression.\n\n_Summarized by WRONG TURN 6._`;
        await sock.sendMessage(msg.key.remoteJid, { text: summarized });
    }
};
