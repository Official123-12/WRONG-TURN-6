const axios = require("axios");
module.exports = {
    name: "stocks",
    async execute(sock, msg, args) {
        const symbol = args[0] || "AAPL";
        try {
            const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}USDT`);
            await sock.sendMessage(msg.key.remoteJid, { text: `📈 *STOCK/CRYPTO DATA: ${symbol.toUpperCase()}*\n\n💰 *Price:* $${parseFloat(res.data.price).toFixed(2)}\n📊 *Market:* Active\n\n_System analysis complete._` });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Symbol not found or API busy." }); }
    }
};
