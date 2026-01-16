const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({ id: String, data: String });
const UserSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    antiDelete: { type: Boolean, default: true },
    antiLink: { type: Boolean, default: true },
    verified: { type: Boolean, default: true }
});

const Session = mongoose.model('WT6_Session', SessionSchema);
const User = mongoose.model('WT6_User', UserSchema);

module.exports = { Session, User };
