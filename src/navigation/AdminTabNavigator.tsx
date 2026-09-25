import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import AdminResidentsScreen from '../screens/Admin/AdminResidentsScreen';
import AdminComplaintsScreen from '../screens/Admin/AdminComplaintsScreen';
import AdminRentScreen from '../screens/Admin/AdminRentScreen';

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any = 'grid-outline';
          if (route.name === 'Dashboard') iconName = focused ? 'grid' : 'grid-outline';
          if (route.name === 'Residents') iconName = focused ? 'people' : 'people-outline';
          if (route.name === 'AdminComplaints') iconName = focused ? 'alert-circle' : 'alert-circle-outline';
          if (route.name === 'AdminRent') iconName = focused ? 'cash' : 'cash-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
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
    </Tab.Navigator>
  );
}