const axios = require("axios");
module.exports = {
    name: "currency",
    async execute(sock, msg, args) {
        const from = args[0] || "USD";
        const to = args[1] || "TZS";
        try {
            const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
            const rate = res.data.rates[to.toUpperCase()];
            await sock.sendMessage(msg.key.remoteJid, { text: `💱 *EXCHANGE RATE:* \n\n1 ${from.toUpperCase()} = ${rate} ${to.toUpperCase()}\n\n_Market data updated via WRONG TURN 6._` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Currency not supported." }); }
    }
};
