/**
 * WRONG TURN 6 - Helper Utilities
 * Developed by STANYTZ
 */

const createVCard = (name, number) => {
    // Inatengeneza muundo wa VCard kwa ajili ya mawasiliano ya bot
    return (
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        `FN:${name} ✔️\n` + // Jina la Bot na Blue Tick
        'ORG:WRONG TURN 6;\n' +
        `TEL;type=CELL;type=VOICE;waid=${number}:${number}\n` +
        'END:VCARD'
    );
};

const formatSize = (bytes) => {
    // Inabadilisha Bytes kwenda MB/GB
    if (bytes >= 1000000000) return (bytes / 1000000000).toFixed(2) + ' GB';
    if (bytes >= 1000000) return (bytes / 1000000).toFixed(2) + ' MB';
    if (bytes >= 1000) return (bytes / 1000).toFixed(2) + ' KB';
    return bytes + ' B';
};

const runtime = (seconds) => {
    // Inatengeneza Uptime inayosomeka
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor((seconds % (3600 * 24)) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + (d == 1 ? " siku, " : " siku, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " saa, " : " saa, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " dkk, " : " dkk, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " sek" : " sek") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
};

module.exports = { createVCard, formatSize, runtime };
