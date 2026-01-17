const { BufferJSON } = require('@whiskeysockets/baileys');

async function useFirebaseAuthState(collection) {
    // Function ya kusafisha ID (Firestore haitaki / au .)
    const fixId = (id) => id.replace(/\//g, '__').replace(/\@/g, 'at');

    const writeData = (data, id) => {
        const jsonStr = JSON.stringify(data, BufferJSON.replacer);
        return collection.doc(fixId(id)).set(JSON.parse(jsonStr));
    };

    const readData = async (id) => {
        try {
            const doc = await collection.doc(fixId(id)).get();
            if (doc.exists) {
                const jsonStr = JSON.stringify(doc.data());
                return JSON.parse(jsonStr, BufferJSON.reviver);
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    const removeData = async (id) => {
        try {
            await collection.doc(fixId(id)).delete();
        } catch (e) {}
    };

    // Baileys Credentials Initialization
    const creds = await readData('creds') || require('@whiskeysockets/baileys').initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            const { proto } = require('@whiskeysockets/baileys');
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) await writeData(value, `${type}-${id}`);
                            else await removeData(`${type}-${id}`);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

module.exports = { useFirebaseAuthState };
