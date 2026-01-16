const axios = require("axios");
module.exports = {
    name: "crypto",
    async execute(sock, msg, args) {
        try {
            const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana&vs_currencies=usd');
            const data = `💰 *LIVE MARKET DATA* \n\n🪙 BTC: $${res.data.bitcoin.usd}\n🪙 ETH: $${res.data.ethereum.usd}\n🪙 SOL: $${res.data.solana.usd}\n🪙 BNB: $${res.data.binancecoin.usd}`;
            await sock.sendMessage(msg.key.remoteJid, { text: data });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Market API busy." }); }
    }
};
