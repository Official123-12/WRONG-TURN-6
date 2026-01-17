const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, BufferJSON } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const { useFirestoreAuthState } = require("./lib/firebaseStore");

const app = express();
const port = 3000;

app.use(express.static('public'));

async function startBot() {
  const { state, saveCreds } = await useFirestoreAuthState("WRONG_TURN_6_SESSION");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["Ubuntu", "Chrome", "20.0.04"]
  });

  // Pairing Code Logic
  app.get("/pair", async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Number required" });
    try {
      let code = await sock.requestPairingCode(num);
      res.json({ code });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("WRONG TURN 6 CONNECTED SUCCESSFULLY ✅");
    }
  });

  // Dynamic Command Loader
  const commands = new Map();
  const cmdPath = path.join(__dirname, "commands");
  fs.readdirSync(cmdPath).forEach(dir => {
    const files = fs.readdirSync(path.join(cmdPath, dir)).filter(f => f.endsWith(".js"));
    for (let file of files) {
      const cmd = require(path.join(cmdPath, dir, file));
      cmd.category = dir;
      commands.set(cmd.name, cmd);
    }
  });
  global.commands = commands;

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;
    
    // Auto Status View/Like
    if (msg.key.remoteJid === 'status@broadcast') {
        await sock.readMessages([msg.key]);
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "🌸", key: msg.key } }, { statusJidList: [msg.key.participant] });
        return;
    }

    // Command Handler & Security
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const isLink = text.match(/chat.whatsapp.com/gi);
    
    // Anti-Link
    if (isLink) {
        await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        return;
    }

    if (text.startsWith("!")) {
        const [cmdName, ...args] = text.slice(1).split(" ");
        const command = commands.get(cmdName);
        if (command) await command.execute(sock, msg, args);
    }
  });
}

app.listen(port, () => console.log(`Server running on port ${port}`));
startBot();
