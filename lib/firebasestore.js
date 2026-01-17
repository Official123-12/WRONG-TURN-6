const admin = require("firebase-admin");
const { BufferJSON } = require("@whiskeysockets/baileys");

// YOUR FIREBASE CONFIG
const serviceAccount = {
  "type": "service_account",
  "project_id": "stanybots",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcpy6S8a0fJbRT...", // Truncated for display, use your full key
  "client_email": "firebase-adminsdk-fbsvc@stanybots.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const collection = db.collection("sessions");

async function useFirestoreAuthState(sessionId) {
  const readData = async (id) => {
    const doc = await collection.doc(`${sessionId}-${id}`).get();
    if (doc.exists) {
      const data = JSON.parse(doc.data().data, BufferJSON.reviver);
      return data;
    }
    return null;
  };

  const writeData = async (id, data) => {
    const content = JSON.stringify(data, BufferJSON.replacer);
    await collection.doc(`${sessionId}-${id}`).set({ data: content });
  };

  const removeData = async (id) => {
    await collection.doc(`${sessionId}-${id}`).delete();
  };

  const creds = (await readData("creds")) || (require("@whiskeysockets/baileys").makeInMemoryStore().creds);

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = value;
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) await writeData(key, value);
              else await removeData(key);
            }
          }
        },
      },
    },
    saveCreds: () => writeData("creds", creds),
  };
}

module.exports = { useFirestoreAuthState, db };
