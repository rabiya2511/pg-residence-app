import { useEffect, useMemo, useState } from 'react';
import { getFirestore, collection, onSnapshot, query, where } from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';

// Visitor requests of the active property that are still waiting for the admin's decision.
export function useAdminVisitors() {
  const { activePropertyId } = useAdmin();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    setRows([]);
    if (!activePropertyId) return;
    return onSnapshot(
      query(
        collection(getFirestore(), 'visitors'),
        where('propertyId', '==', activePropertyId),
        where('status', '==', 'Pending')
      ),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('pending visitors listener:', e?.code)
    );
  }, [activePropertyId]);

  const pendingVisitors = useMemo(
    () => [...rows].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [rows]
  );

  return { pendingVisitors };
}