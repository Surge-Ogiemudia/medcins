// Run this script in a secure admin environment (Node.js with Firebase Admin SDK)
// It will update all medicine-manager users to add a businessAddress if missing

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function updateBusinessAddresses() {
  const usersSnap = await db.collection('users').where('role', '==', 'medicine-manager').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (!data.businessAddress && data.address) {
      await doc.ref.update({ businessAddress: data.address });
      console.log(`Updated user ${doc.id} with businessAddress from address.`);
    } else if (!data.businessAddress) {
      await doc.ref.update({ businessAddress: 'No address provided' });
      console.log(`Set default businessAddress for user ${doc.id}.`);
    }
  }
  console.log('Business address update complete.');
}

updateBusinessAddresses();
