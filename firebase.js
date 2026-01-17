const admin = require('firebase-admin');
const config = require('./config');

// Initialize Firebase only if credentials exist
let db = null;
let isInitialized = false;

try {
    // Check if we have Firebase credentials
    if (config.firebaseConfig.privateKey && config.firebaseConfig.privateKey.length > 100) {
        admin.initializeApp({
            credential: admin.credential.cert(config.firebaseConfig),
            databaseURL: `https://${config.firebaseConfig.projectId}.firebaseio.com`
        });
        
        db = admin.firestore();
        isInitialized = true;
        console.log('✅ Firebase initialized successfully');
    } else {
        console.log('⚠️  Firebase credentials not found, using local storage');
    }
} catch (error) {
    console.log('⚠️  Firebase init error:', error.message);
}

// Session Management
const Session = {
    async get(id) {
        if (!isInitialized) return null;
        try {
            const doc = await db.collection('sessions').doc(id).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('❌ Session get error:', error.message);
            return null;
        }
    },

    async save(id, data) {
        if (!isInitialized) {
            console.log('💾 Session saved locally (Firebase not available)');
            return true;
        }
        try {
            await db.collection('sessions').doc(id).set({
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('💾 Session saved to Firebase');
            return true;
        } catch (error) {
            console.error('❌ Session save error:', error.message);
            return false;
        }
    }
};

// User Management
const User = {
    async get(jid) {
        if (!isInitialized) return null;
        try {
            // Create a safe ID for Firebase
            const safeId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            const doc = await db.collection('users').doc(safeId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('❌ User get error:', error.message);
            return null;
        }
    },

    async save(jid, data) {
        if (!isInitialized) {
            // Save locally if Firebase not available
            return true;
        }
        try {
            const safeId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            await db.collection('users').doc(safeId).set({
                ...data,
                jid: jid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ User save error:', error.message);
            return false;
        }
    },

    async update(jid, updates) {
        if (!isInitialized) return true;
        try {
            const safeId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            await db.collection('users').doc(safeId).update({
                ...updates,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('❌ User update error:', error.message);
            return false;
        }
    }
};

// Group Settings
const Group = {
    async getSettings(jid) {
        if (!isInitialized) {
            return {
                antiLink: true,
                antiDelete: true,
                antiPorn: true,
                swearFilter: true
            };
        }
        
        try {
            const safeId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            const doc = await db.collection('groups').doc(safeId).get();
            
            if (doc.exists) {
                return doc.data();
            }
            
            // Default settings
            const defaults = {
                antiLink: true,
                antiDelete: true,
                antiPorn: true,
                swearFilter: true,
                jid: jid,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await this.saveSettings(jid, defaults);
            return defaults;
        } catch (error) {
            console.error('❌ Group get error:', error.message);
            return {
                antiLink: true,
                antiDelete: true,
                antiPorn: true,
                swearFilter: true
            };
        }
    },

    async saveSettings(jid, settings) {
        if (!isInitialized) return true;
        try {
            const safeId = jid.replace(/[^a-zA-Z0-9]/g, '_');
            await db.collection('groups').doc(safeId).set({
                ...settings,
                jid: jid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Group save error:', error.message);
           module.exports = {
    Session,
    User,
    Group,
    db,
    admin,
    isInitialized
};
