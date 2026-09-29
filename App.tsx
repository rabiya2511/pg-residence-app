import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { registerForNotificationsAsync, scheduleRentReminder } from './src/services/notifications';
import { MockAuthProvider, useMockAuth } from './src/context/MockAuthContext';
import { AdminProvider, useAdmin } from './src/context/AdminContext';
import { AnnouncementsProvider } from './src/context/AnnouncementsContext';
import { ComplaintsProvider } from './src/context/ComplaintsContext';
import { RentProvider, useRent } from './src/context/RentContext';
import { MaintenanceProvider } from './src/context/MaintenanceContext';
import { FoodProvider } from './src/context/FoodContext';
import { VisitorsProvider } from './src/context/VisitorsContext';
import { DocumentsProvider } from './src/context/DocumentsContext';
import { ResidentProvider } from './src/context/ResidentContext';
import { PaymentMethodsProvider } from './src/context/PaymentMethodsContext';
        
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

// Watches for a logged-in resident's own AdminResident record disappearing
// (i.e. the admin deleted them). The moment that happens, forces an
// immediate logout — role flips to null, which AppNavigator routes straight
// to AuthStackNavigator, so no resident-side screen or action stays
// reachable for them.
function DeletedResidentWatcher() {
  const { role, residentId, logout } = useMockAuth();
  const { residents } = useAdmin();

  useEffect(() => {
    if (role !== 'resident' || !residentId) return;
    const stillExists = residents.some((r) => r.id === residentId);
    if (!stillExists) {
      logout();
    }
  }, [role, residentId, residents, logout]);

  return null;
}

export default function App() {
  return (
    <MockAuthProvider>
      <AdminProvider>
        <AnnouncementsProvider>
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
        </AnnouncementsProvider>
      </AdminProvider>
    </MockAuthProvider>
  );
}