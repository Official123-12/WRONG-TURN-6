const axios = require("axios");
module.exports = {
    name: "weather",
    async execute(sock, msg, args) {
        const city = args[0] || "Dar es Salaam";
        try {
            const res = await axios.get(`https://api.popcat.xyz/weather?q=${encodeURIComponent(city)}`);
            const data = res.data[0];
            const text = `☁️ *WEATHER: ${data.location.name.toUpperCase()}* ☁️\n\n🌡️ *Temp:* ${data.current.temperature}°C\n🌬️ *Wind:* ${data.current.winddisplay}\n💧 *Humidity:* ${data.current.humidity}%\n📝 *Status:* ${data.current.skytext}`;
            await sock.sendMessage(msg.key.remoteJid, { text });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Weather API busy." }); }
    }
};
