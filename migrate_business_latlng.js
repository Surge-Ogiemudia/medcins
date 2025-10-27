// Run this script with Node.js after setting up firebase-admin
// It will add top-level lat/lng fields to business users if missing


import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateBusinessLatLng() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('userType', '==', 'business').get();
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.location && (data.location.latitude || data.location.lat) && (data.location.longitude || data.location.lng)) {
      const lat = data.location.latitude || data.location.lat;
      const lng = data.location.longitude || data.location.lng;
      if (typeof data.lat === 'undefined' || typeof data.lng === 'undefined') {
        await doc.ref.update({ lat, lng });
        updated++;
        console.log(`Updated ${doc.id}: lat=${lat}, lng=${lng}`);
      }
    }
  }
  console.log(`Migration complete. Updated ${updated} business users.`);
}

migrateBusinessLatLng().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
