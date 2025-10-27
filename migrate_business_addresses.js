// Firestore migration script for ES modules
// Run with: node migrate_business_addresses.js
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function migrateBusinessAddresses() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('role', '==', 'medicine-manager').get();
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Only update if old fields exist and new ones are missing
    if (
      (data.businessAddress || data.businessCity || data.businessState) &&
      (!data.address || !data.city || !data.state)
    ) {
      const update = {};
      if (data.businessAddress) update.address = data.businessAddress;
      if (data.businessCity) update.city = data.businessCity;
      if (data.businessState) update.state = data.businessState;
      if (data.businessLandmark) update.landmark = data.businessLandmark;
      await doc.ref.update(update);
      updated++;
      console.log(`Updated business ${doc.id}:`, update);
    }
  }
  console.log(`Migration complete. Updated ${updated} business records.`);
}

migrateBusinessAddresses().catch(console.error);
