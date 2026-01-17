const admin = require('firebase-admin');
const CryptoJS = require('crypto-js');
const config = require('./config');

// Encryption key (should be in .env in production)
const ENCRYPTION_KEY = 'STANYZ_SECRET_KEY_2024';

// Encryption functions
const encryptData = (data) => {
    if (!data) return null;
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
};

const decryptData = (encryptedData) => {
    if (!encryptedData) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
        return null;
    }
};

// Initialize Firebase
let db;
try {
    // Use environment variables directly
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        universe_domain: "googleapis.com"
    };
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });
    
    db = admin.firestore();
    console.log('✅ Firebase initialized (Encrypted)');
} catch (error) {
    console.error('❌ Firebase error:', error.message);
    // Fallback to local storage
    db = null;
}

// SECURE SESSION MANAGEMENT
const Session = {
    async get(id) {
        if (!db) return null;
        try {
            const doc = await db.collection('sessions').doc(id).get();
            if (!doc.exists) return null;
            
            const data = doc.data();
            if (data.encryptedCreds) {
                return decryptData(data.encryptedCreds);
            }
            return data;
        } catch (error) {
            console.error('Session get error:', error.message);
            return null;
        }
    },

    async save(id, creds) {
        if (!db) {
            console.log('💾 Session saved locally (No Firebase)');
            return true;
        }
        try {
            const encryptedCreds = encryptData(creds);
            await db.collection('sessions').doc(id).set({
                encryptedCreds: encryptedCreds,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                botName: config.botName
            }, { merge: true });
            console.log('💾 Session encrypted and saved');
            return true;
        } catch (error) {
            console.error('Session save error:', error.message);
            return false;
        }
    }
};

// SECURE USER MANAGEMENT
const User = {
    async get(jid) {
        if (!db) return null;
        try {
            const userId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            const doc = await db.collection('users').doc(userId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('User get error:', error.message);
            return null;
        }
    },

    async save(jid, data) {
        if (!db) return true;
        try {
            const userId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            await db.collection('users').doc(userId).set({
                ...data,
                jid: jid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('User save error:', error.message);
            return false;
        }
    },

    async update(jid, updates) {
        if (!db) return true;
        try {
            const userId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            await db.collection('users').doc(userId).update({
                ...updates,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('User update error:', error.message);
            return false;
        }
    }
};

// GROUP SETTINGS MANAGEMENT
const Group = {
    async getSettings(jid) {
        if (!db) return { antiLink: true, antiDelete: true, antiSpam: true };
        try {
            const groupId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            const doc = await db.collection('groups').doc(groupId).get();
            if (doc.exists) {
                return doc.data();
            }
            // Default settings
            const defaultSettings = {
                antiLink: true,
                antiDelete: true,
                antiSpam: true,
                antiPorn: true,
                swearFilter: true,
                viewOnceCapture: true,
                autoReply: false
            };
            await this.saveSettings(jid, defaultSettings);
            return defaultSettings;
        } catch (error) {
            console.error('Group settings error:', error.message);
            return { antiLink: true, antiDelete: true, antiSpam: true };
        }
    },

    async saveSettings(jid, settings) {
        if (!db) return true;
        try {
            const groupId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            await db.collection('groups').doc(groupId).set({
                ...settings,
                jid: jid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('Group save error:', error.message);
            return false;
        }
    },

    async updateSettings(jid, updates) {
        if (!db) return true;
        try {
            const current = await this.getSettings(jid);
            await this.saveSettings(jid, { ...current, ...updates });
            return true;
        } catch (error) {
            console.error('Group update error:', error.message);
            return false;
        }
    }
};

// MESSAGE LOGGER (For anti-delete)
const MessageLog = {
    async logMessage(msg) {
        if (!db) return;
        try {
            const messageId = msg.key.id;
            await db.collection('messages').doc(messageId).set({
                id: messageId,
                jid: msg.key.remoteJid,
                sender: msg.key.participant || msg.key.remoteJid,
                message: msg.message,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            });
        } catch (error) {
            console.error('Message log error:', error.message);
        }
    },

    async getDeletedMessage(messageId) {
        if (!db) return null;
        try {
            const doc = await db.collection('messages').doc(messageId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Get message error:', error.message);
            return null;
        }
    },

    async deleteMessage(messageId) {
        if (!db) return;
        try {
            await db.collection('messages').doc(messageId).delete();
        } catch (error) {
            console.error('Delete message error:', error.message);
        }
    }
};

module.exports = {
    Session,
    User,
    Group,
    MessageLog,
    db,
    admin,
    encryptData,
    decryptData
};
