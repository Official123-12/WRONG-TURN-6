const axios = require("axios");
module.exports = {
    name: "movie",
    async execute(sock, msg, args) {
        const q = args.join(" ");
        if (!q) return sock.sendMessage(msg.key.remoteJid, { text: "Movie name, blood?" });
        try {
            const res = await axios.get(`http://www.omdbapi.com/?t=${encodeURIComponent(q)}&apikey=62593d93`);
            if (res.data.Response === "False") return sock.sendMessage(msg.key.remoteJid, { text: "Movie not found!" });
            const info = `🎬 *TITLE:* ${res.data.Title}\n⭐ *IMDB:* ${res.data.imdbRating}\n📅 *Year:* ${res.data.Year}\n🎭 *Genre:* ${res.data.Genre}\n👤 *Actors:* ${res.data.Actors}\n\n📝 *Plot:* ${res.data.Plot}\n\n🔗 *Stream Link:* https://vidsrc.to/embed/movie/${res.data.imdbID}`;
            await sock.sendMessage(msg.key.remoteJid, { image: { url: res.data.Poster }, caption: info });
        } catch (e) { await sock.sendMessage(msg.key.remoteJid, { text: "Cinema API Error." }); }
    }
};
