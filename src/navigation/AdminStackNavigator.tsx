import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminTabNavigator from './AdminTabNavigator';
import AdminResidentDetailScreen from '../screens/Admin/AdminResidentDetailScreen';
import AdminResidentFullDetailsScreen from '../screens/Admin/AdminResidentFullDetailsScreen';
import AdminResidentFormScreen from '../screens/Admin/AdminResidentFormScreen';
import AdminRevenueScreen from '../screens/Admin/AdminRevenueScreen';
import AdminResidentMonitoringScreen from '../screens/Admin/AdminResidentMonitoringScreen';
import AdminNoticesScreen from '../screens/Admin/AdminNoticesScreen';
import AdminIdentityDocumentsScreen from '../screens/Admin/AdminIdentityDocumentsScreen';
import AdminPropertiesScreen from '../screens/Admin/AdminPropertiesScreen';
import AdminPropertyRoomsScreen from '../screens/Admin/AdminPropertyRoomsScreen';
import AdminRoomDetailScreen from '../screens/Admin/AdminRoomDetailScreen';
import AdminDailyGuestsScreen from '../screens/Admin/AdminDailyGuestsScreen';
import AdminDailyGuestFormScreen from '../screens/Admin/AdminDailyGuestFormScreen';
import AdminDailyGuestReceiptScreen from '../screens/Admin/AdminDailyGuestReceiptScreen';
import AdminPreBookingPropertiesScreen from '../screens/Admin/AdminPreBookingPropertiesScreen';
import AdminPreBookingListScreen from '../screens/Admin/AdminPreBookingListScreen';
import AdminPaymentNotificationsScreen from '../screens/Admin/AdminPaymentNotificationsScreen';
import AdminPropertyFormScreen from '../screens/Admin/AdminPropertyFormScreen';
import AdminVacatingScreen from '../screens/Admin/AdminVacatingScreen';
import AdminRoomFormScreen from '../screens/Admin/AdminRoomFormScreen';
import AdminDayRevenueScreen from '../screens/Admin/AdminDayRevenueScreen';
import AdminDayRevenueDetailScreen from '../screens/Admin/AdminDayRevenueDetailScreen';
import AdminRoomsScreen from '../screens/Admin/RoomManagementScreen';
import AdminDialerScreen from '../screens/Admin/AdminDialerScreen';
import AdminReportsScreen from '../screens/Admin/AdminReportsScreen';
import AdminReportDetailScreen from '../screens/Admin/AdminReportsDetailsScreen';

const Stack = createNativeStackNavigator();
export default function AdminStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
      <Stack.Screen name="AdminResidentDetail" component={AdminResidentDetailScreen} />
      <Stack.Screen name="AdminResidentFullDetails" component={AdminResidentFullDetailsScreen} />
      <Stack.Screen name="AdminResidentForm" component={AdminResidentFormScreen} />
      <Stack.Screen name="AdminRevenue" component={AdminRevenueScreen} />
      <Stack.Screen name="AdminResidentMonitoring" component={AdminResidentMonitoringScreen} />
      <Stack.Screen name="AdminNotices" component={AdminNoticesScreen} />
      <Stack.Screen name="AdminIdentityDocuments" component={AdminIdentityDocumentsScreen} />
      <Stack.Screen name="AdminProperties" component={AdminPropertiesScreen} />
      <Stack.Screen name="AdminPropertyRooms" component={AdminPropertyRoomsScreen} />
      <Stack.Screen name="AdminRoomDetail" component={AdminRoomDetailScreen} />
      <Stack.Screen name="AdminDailyGuests" component={AdminDailyGuestsScreen} />
      <Stack.Screen name="AdminDailyGuestForm" component={AdminDailyGuestFormScreen} />
      <Stack.Screen name="AdminDailyGuestReceipt" component={AdminDailyGuestReceiptScreen} />
      <Stack.Screen name="AdminPreBookingProperties" component={AdminPreBookingPropertiesScreen} />
      <Stack.Screen name="AdminPreBookingList" component={AdminPreBookingListScreen} />
      <Stack.Screen name="AdminPaymentNotifications" component={AdminPaymentNotificationsScreen} />
      <Stack.Screen name="AdminPropertyForm" component={AdminPropertyFormScreen} />
      <Stack.Screen name="AdminRoomForm" component={AdminRoomFormScreen} />
      <Stack.Screen name="AdminVacating" component={AdminVacatingScreen} />
      <Stack.Screen name="AdminDayRevenue" component={AdminDayRevenueScreen} />
      <Stack.Screen name="AdminDayRevenueDetail" component={AdminDayRevenueDetailScreen} />
      <Stack.Screen name="AdminRooms" component={AdminRoomsScreen} />
      <Stack.Screen name="AdminDialer" component={AdminDialerScreen} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="AdminReportDetail" component={AdminReportDetailScreen} />
    </Stack.Navigator>
  );
}