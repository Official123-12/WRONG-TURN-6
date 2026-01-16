const axios = require("axios");
module.exports = {
    name: "quran",
    async execute(sock, msg, args) {
        try {
            const res = await axios.get("https://api.aladhan.com/v1/ayah/random/ar.alafasy");
            const data = res.data.data;
            const ayah = `🕋 *HOLY QURAN: RANDOM AYAH* 🕋\n\n📖 *Surah:* ${data.surah.englishName}\n🔢 *Verse:* ${data.numberInSurah}\n\n*Arabic:* ${data.text}`;
            await sock.sendMessage(msg.key.remoteJid, { text: ayah });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Quran API is busy." }); }
    }
};
