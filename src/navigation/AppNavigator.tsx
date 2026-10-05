import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabNavigator from './TabNavigator';
import AdminStackNavigator from './AdminStackNavigator';
import RentDetailsScreen from '../screens/Rent/RentDetailsScreen';
import PayRentScreen from '../screens/Rent/PayRentScreen';
import PaymentSuccessScreen from '../screens/Rent/PaymentSuccessScreen';
import ComplaintsListScreen from '../screens/Complaints/ComplaintsListScreen';
import NewComplaintScreen from '../screens/Complaints/NewComplaintScreen';
import MaintenanceListScreen from '../screens/Maintenance/MaintenanceListScreen';
import NewMaintenanceScreen from '../screens/Maintenance/NewMaintenanceScreen';
import FoodScreen from '../screens/Food/FoodScreen';
import NoticesScreen from '../screens/Notices/NoticesScreen';
import VisitorsScreen from '../screens/Visitors/VisitorsScreen';
import NewVisitorScreen from '../screens/Visitors/NewVisitorScreen';
import DocumentsScreen from '../screens/Documents/DocumentsScreen';
import { RootStackParamList } from '../types/navigation';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import HelpSupportScreen from '../screens/Help/HelpSupportScreen';
import SupportChatScreen from '../screens/Help/SupportChatScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import PrivacyScreen from '../screens/Privacy/PrivacyScreen';
import AuthStackNavigator from './AuthStackNavigator';
import { useMockAuth } from '../context/MockAuthContext';
import NearbyPlacesScreen from '../screens/NearbyPlaces/NearbyPlacesScreen';
import BookRoomFormScreen from '../screens/BookRoom/BookRoomFormScreen';
import VacateNoticeScreen from '../screens/Resident/VacateNoticeScreen';
import ResidentRegistrationScreen from '../screens/BookRoom/ResidentRegistrationScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

function ResidentStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="RentDetails" component={RentDetailsScreen} />
      <Stack.Screen name="PayRent" component={PayRentScreen} />
      <Stack.Screen name="NearbyPlaces" component={NearbyPlacesScreen} />
      <Stack.Screen name="VacateNotice" component={VacateNoticeScreen} />
      <Stack.Screen
        name="PaymentSuccess"
        component={PaymentSuccessScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Complaints" component={ComplaintsListScreen} />
      <Stack.Screen name="NewComplaint" component={NewComplaintScreen} />
      <Stack.Screen name="Maintenance" component={MaintenanceListScreen} />
      <Stack.Screen name="NewMaintenance" component={NewMaintenanceScreen} />
      <Stack.Screen name="Food" component={FoodScreen} />
      <Stack.Screen name="Notices" component={NoticesScreen} />
      <Stack.Screen name="Visitors" component={VisitorsScreen} />
      <Stack.Screen name="NewVisitor" component={NewVisitorScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="SupportChat" component={SupportChatScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="BookRoomForm" component={BookRoomFormScreen} />
      <Stack.Screen
        name="ResidentRegistration"
        component={ResidentRegistrationScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { role, initializing } = useMockAuth();

  // Firebase restores a saved login asynchronously. Wait for it, so a logged-in
  // user is not flashed the login screen on every app start.
  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {role === 'resident' && <ResidentStackNavigator />}
        {role === 'admin' && <AdminStackNavigator />}
        {role === null && <AuthStackNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}