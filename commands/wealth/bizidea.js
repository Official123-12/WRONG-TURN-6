module.exports = {
    name: "bizidea",
    async execute(sock, msg, args) {
        const ideas = [
            "🚀 *AI Automation Agency:* Help local businesses automate customer support using GPT.",
            "🚀 *Niche Dropshipping:* Selling high-end aesthetic home decor via TikTok Shop.",
            "🚀 *Micro-SaaS Tool:* Build a simple background remover for product photographers.",
            "🚀 *Faceless YouTube Channel:* Educational videos in Swahili/English using AI voices."
        ];
        const random = ideas[Math.floor(Math.random() * ideas.length)];
        await sock.sendMessage(msg.key.remoteJid, { text: `💰 *STANYTZ BIZ ADVICE:* \n\n${random}\n\n_Start small, scale fast._` });
    }
};
