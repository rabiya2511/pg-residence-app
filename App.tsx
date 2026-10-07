import React, { useEffect } from 'react';
import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';
import AppNavigator from './src/navigation/AppNavigator';
import { registerForNotificationsAsync, scheduleRentReminder } from './src/services/notifications';
import { MockAuthProvider, useMockAuth } from './src/context/MockAuthContext';
import { AdminProvider } from './src/context/AdminContext';
import { AnnouncementsProvider } from './src/context/AnnouncementsContext';
import { ComplaintsProvider } from './src/context/ComplaintsContext';
import { RentProvider, useRent } from './src/context/RentContext';
import { MaintenanceProvider } from './src/context/MaintenanceContext';
import { FoodProvider } from './src/context/FoodContext';
import { VisitorsProvider } from './src/context/VisitorsContext';
import { DocumentsProvider } from './src/context/DocumentsContext';
import { ResidentProvider } from './src/context/ResidentContext';
import { PaymentMethodsProvider } from './src/context/PaymentMethodsContext';
import { CommunicationsProvider } from './src/context/CommunicationsContext';

function NotificationScheduler() {
  const { rentStatus } = useRent();

  useEffect(() => {
    (async () => {
      const granted = await registerForNotificationsAsync();
      if (granted) {
        await scheduleRentReminder(rentStatus.dueDate, rentStatus.amount, rentStatus.status === 'Paid');
      }
    })();
  }, [rentStatus.status]);

  return null;
}

// Watches a logged-in resident's own record. If the admin deletes (or archives) them,
// it forces an immediate logout — role flips to null, which AppNavigator routes straight
// to AuthStackNavigator, so no resident-side screen or action stays reachable for them.
//
// It listens to the resident's document directly and only acts once the SERVER has
// answered. (Checking the in-memory residents list instead logged every resident out
// straight after login, because that list is still empty for a moment.)
function DeletedResidentWatcher() {
  const { role, residentId, logout } = useMockAuth();

  useEffect(() => {
    if (role !== 'resident' || !residentId) return;

    return onSnapshot(
      doc(getFirestore(), 'residents', residentId),
      (snap: any) => {
        if (snap.metadata.fromCache) return; // wait for the server's answer
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        if (!exists || snap.data()?.archived) {
          logout();
        }
      },
      (e: any) => console.warn('resident watcher:', e?.code)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, residentId]);

  return null;
}

export default function App() {
  return (
    <MockAuthProvider>
      <AdminProvider>
        <AnnouncementsProvider>
          <CommunicationsProvider>
            <ResidentProvider>
              <ComplaintsProvider>
                <RentProvider>
                  <MaintenanceProvider>
                    <FoodProvider>
                      <VisitorsProvider>
                        <DocumentsProvider>
                          <PaymentMethodsProvider>
                            <DeletedResidentWatcher />
                            <NotificationScheduler />
                            <AppNavigator />
                          </PaymentMethodsProvider>
                        </DocumentsProvider>
                      </VisitorsProvider>
                    </FoodProvider>
                  </MaintenanceProvider>
                </RentProvider>
              </ComplaintsProvider>
            </ResidentProvider>
          </CommunicationsProvider>
        </AnnouncementsProvider>
      </AdminProvider>
    </MockAuthProvider>
  );
}