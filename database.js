const mongoose = require('mongoose');

// User Session Schema
const SessionSchema = new mongoose.Schema({
    sessionId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    userId: { 
        type: String, 
        required: true 
    },
    phoneNumber: { 
        type: String, 
        required: true 
    },
    creds: { 
        type: Object, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'expired', 'pending'],
        default: 'pending'
    },
    pairingCode: {
        type: String
    },
    connectionInfo: {
        connectedAt: Date,
        lastSeen: Date,
        device: String,
        platform: String
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    expiresAt: { 
        type: Date, 
        default: () => new Date(+new Date() + 24*60*60*1000) // 24 hours
    }
});

// User Data Schema
const UserSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    phoneNumber: { 
        type: String, 
        required: true 
    },
    name: String,
    botSettings: {
        antiDelete: { 
            type: Boolean, 
            default: true 
        },
        antiLink: { 
            type: Boolean, 
            default: true 
        },
        autoReply: { 
            type: Boolean, 
            default: false 
        },
        language: { 
            type: String, 
            default: 'en' 
        }
    },
    stats: {
        commandsUsed: { 
            type: Number, 
            default: 0 
        },
        messagesSent: { 
            type: Number, 
            default: 0 
        },
        lastActive: Date
    },
    subscription: {
        status: { 
            type: String, 
            enum: ['free', 'premium', 'vip'], 
            default: 'free' 
        },
        expiresAt: Date,
        features: [String]
    },
    joinedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Bot Log Schema
const LogSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['connection', 'message', 'command', 'error', 'pairing']
    },
    sessionId: String,
    userId: String,
    details: Object,
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

// Group Session Management
const GroupSessionSchema = new mongoose.Schema({
    groupId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    sessionId: { 
        type: String, 
        required: true 
    },
    settings: {
        antiLink: { type: Boolean, default: true },
        welcomeMessage: { type: Boolean, default: true },
        autoReply: { type: Boolean, default: false }
    },
    members: [{
        userId: String,
        joinedAt: Date,
        role: String
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const Session = mongoose.model('Session', SessionSchema);
const User = mongoose.model('User', UserSchema);
const Log = mongoose.model('Log', LogSchema);
const GroupSession = mongoose.model('GroupSession', GroupSessionSchema);

module.exports = { 
    Session, 
    User, 
    Log, 
    GroupSession,
    
    // Helper functions
    connectDB: async () => {
        try {
            await mongoose.connect(process.env.MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('✅ MongoDB Connected');
        } catch (error) {
            console.error('❌ MongoDB Connection Error:', error);
            process.exit(1);
        }
    }
};
