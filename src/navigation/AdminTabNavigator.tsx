import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import AdminResidentsScreen from '../screens/Admin/AdminResidentsScreen';
import AdminComplaintsScreen from '../screens/Admin/AdminComplaintsScreen';
import AdminRentScreen from '../screens/Admin/AdminRentScreen';
import AdminDialerScreen from '../screens/Admin/AdminDialerScreen';

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  // The phone's own bottom area (gesture bar, or the back / home / recents buttons).
  // The tab bar sits above it so the two never overlap.
  const insets = useSafeAreaInsets();
  const bottomSpace = Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + bottomSpace,
          paddingTop: 8,
          paddingBottom: bottomSpace,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ color, focused }) => {
          let iconName: any = 'grid-outline';
          if (route.name === 'Dashboard') iconName = focused ? 'grid' : 'grid-outline';
          if (route.name === 'Residents') iconName = focused ? 'people' : 'people-outline';
          if (route.name === 'AdminComplaints') iconName = focused ? 'alert-circle' : 'alert-circle-outline';
          if (route.name === 'AdminRent') iconName = focused ? 'cash' : 'cash-outline';
          if (route.name === 'AdminDialer') iconName = focused ? 'call' : 'call-outline';
          return <Ionicons name={iconName} size={26} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Residents" component={AdminResidentsScreen} options={{ title: 'Residents' }} />
      <Tab.Screen
        name="AdminComplaints"
        component={AdminComplaintsScreen}
        options={{ title: 'Complaints' }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.setParams({ filterStatus: undefined });
          },
        })}
      />
      <Tab.Screen name="AdminRent" component={AdminRentScreen} options={{ title: 'Rent' }} />
      <Tab.Screen name="AdminDialer" component={AdminDialerScreen} options={{ title: 'Dialer' }} />
    </Tab.Navigator>
  );
}