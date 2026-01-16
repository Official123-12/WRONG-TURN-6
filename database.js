const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    creds: { type: Object } // Hapa ndipo login ya WhatsApp itakaa
});

const UserSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    antiDelete: { type: Boolean, default: true },
    antiViewOnce: { type: Boolean, default: true },
    verified: { type: Boolean, default: false }
});

const Session = mongoose.model('Session', SessionSchema);
const User = mongoose.model('User', UserSchema);

module.exports = { Session, User };
