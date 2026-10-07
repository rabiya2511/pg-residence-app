import { getFirestore, doc, writeBatch } from '@react-native-firebase/firestore';
import {
  properties, initialRooms, adminResidents, adminPaymentHistory, adminComplaints, announcements,
} from '../constants/mockData';

const last10 = (p: string) => p.replace(/[^\d]/g, '').slice(-10);

export async function seedFirestore() {
  const db = getFirestore();
  const batch = writeBatch(db);
  const now = Date.now();

  properties.forEach((p) => batch.set(doc(db, 'properties', p.id), { ...p, isPublic: true }));
  initialRooms.forEach((r) => batch.set(doc(db, 'rooms', r.id), r));

  adminResidents.forEach((r, i) => {
    batch.set(doc(db, 'residents', r.id), {
      ...r, phoneKey: last10(r.phone), archived: false, createdAt: now - i * 1000,
    });
    batch.set(doc(db, 'identityDocuments', r.id), {
      residentId: r.id, propertyId: r.propertyId, frontUri: null, backUri: null,
    });
  });

  adminPaymentHistory.forEach((p, i) => {
    const resident = adminResidents.find((r) => r.id === p.residentId);
    batch.set(doc(db, 'payments', p.id), {
      ...p, propertyId: resident?.propertyId ?? '', createdAt: now - i * 1000,
    });
  });

  adminComplaints.forEach((c, i) => {
    const resident = adminResidents.find((r) => r.name === c.residentName);
    batch.set(doc(db, 'complaints', c.id), {
      ...c, residentId: resident?.id ?? null, propertyId: resident?.propertyId ?? 'prop1', createdAt: now - i * 1000,
    });
  });

  // Your resident-side mock notices use propertyId 'pg1'; the real property is 'prop1'.
  announcements.forEach((a, i) => {
    batch.set(doc(db, 'announcements', a.id), { ...a, propertyId: 'prop1', createdAt: now - i * 86400000 });
  });

  await batch.commit(); // about 100 writes, under the 500 limit
}