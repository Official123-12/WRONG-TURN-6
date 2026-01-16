module.exports = {
    name: "essay",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Provide a topic, blood!" });
        const outline = `🎓 *ESSAY ARCHITECT: ${q}* 🎓\n\n1. *Introduction:* Background and Thesis statement.\n2. *Body Paragraphs:* Evidence, Analysis, and Transitions.\n3. *Counter-Argument:* Address opposing views.\n4. *Conclusion:* Summary of main points and final thought.\n\n_System logic ready. Need specific content? Ask .gpt_`;
        await sock.sendMessage(msg.key.remoteJid, { text: outline });
    }
};
