require('dotenv').config();

module.exports = {
    // STANY CODES
    botName: process.env.BOT_NAME || "WRONG TURN 6",
    ownerName: process.env.OWNER_NAME || "STANYTZ",
    ownerNumber: process.env.OWNER_NUMBER || "255618558502@s.whatsapp.net",
    ownerJid: process.env.OWNER_JID || "255618558502@s.whatsapp.net",
    prefix: process.env.BOT_PREFIX || ".",
    
    // Session
    sessionName: process.env.BOT_SESSION || "wt6_master_session",
    
    // Security Settings
    antiDelete: process.env.ANTI_DELETE === 'true',
    antiLink: process.env.ANTI_LINK === 'true',
    antiSpam: process.env.ANTI_SPAM === 'true',
    antiPorn: process.env.ANTI_PORN === 'true',
    swearFilter: process.env.SWEAR_FILTER === 'true',
    viewOnceCapture: process.env.VIEW_ONCE_CAPTURE === 'true',
    autoTyping: process.env.AUTO_TYPING === 'true',
    autoStatusView: process.env.AUTO_STATUS_VIEW === 'true',
    
    // Auto Reply Settings
    autoReply: {
        enabled: true,
        greeting: "Hello! I'm WRONG TURN 6 bot. How can I help you?",
        responseDelay: 1000,
        typingDuration: 2000
    },
    
    // Links
    channelLink: process.env.CHANNEL_LINK,
    groupLink: process.env.GROUP_LINK,
    groupId: process.env.GROUP_ID,
    menuImage: process.env.MENU_IMAGE,
    
    // System
    port: process.env.PORT || 3000,
    
    // Swear Words (Kiswahili)
    swearWords: [
        'mavi', 'kuma', 'mate', 'chuma', 'mnyiri', 'mtama',
        'wazimu', 'pumbavu', 'fala', 'jinga', 'shupavu',
        'mchepu', 'mshenzi', 'mbwa', 'punda', 'maharimu',
        'mkolopeshi', 'kupiga', 'kufua', 'kukata'
    ],
    
    // Allowed Domains
    allowedDomains: [
        'google.com', 'youtube.com', 'whatsapp.com',
        'instagram.com', 'facebook.com', 'twitter.com',
        'github.com', 'wikipedia.org', 'stackoverflow.com'
    ]
};
