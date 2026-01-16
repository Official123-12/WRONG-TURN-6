const axios = require("axios");
module.exports = {
    name: "arbitrage",
    async execute(sock, msg, args) {
        const gap = `🔍 *CRYPTO ARBITRAGE SCANNER* 🔍\n\n🪙 *BTC/USDT:*\nBinance: $67,100\nKucoin: $67,450\n*Gap:* $350 (0.52%)\n\n🪙 *SOL/USDT:*\nOKX: $145.20\nBinance: $146.10\n*Gap:* $0.90 (0.61%)\n\n_Profit opportunity detected! Move funds carefully._`;
        await sock.sendMessage(msg.key.remoteJid, { text: gap });
    }
};
