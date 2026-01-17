require('dotenv').config();

// Firebase credentials from environment
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || "stanybots",
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com"
};

module.exports = {
    // Bot Identity
    botName: "WRONG TURN 6",
    ownerName: "STANYTZ",
    ownerNumber: "255618558502@s.whatsapp.net",
    ownerJid: "255618558502@s.whatsapp.net",
    prefix: ".",
    
    // Session
    sessionName: "wt6_master_session",
    
    // Security Settings
    antiDelete: true,
    antiLink: true,               // Blocks ALL links
    antiSpam: true,
    antiPorn: true,
    swearFilter: true,
    viewOnceCapture: true,
    autoTyping: true,
    autoStatusView: true,
    
    // Force Join Requirements
    forceJoin: {
        enabled: true,
        groupLink: "https://chat.whatsapp.com/J19JASXoaK0GVSoRvShr4Y",
        channelLink: "https://whatsapp.com/channel/0029Vb7fzu4EwEjmsD4Tzs1p",
        groupId: "120363302194515518@g.us"
    },
    
    // Firebase
    firebaseConfig: firebaseConfig,
    
    // Server
    port: process.env.PORT || 3000,
    
    // Menu
    menuImage: "https://i.ibb.co/vz6mD7y/wrongturn.jpg"
};
