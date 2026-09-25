import { NavigatorScreenParams } from '@react-navigation/native';

export type RootTabParamList = {
  Home: undefined;
  BookRoom: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList>;
  RentDetails: undefined;
  PayRent: undefined;
  PaymentSuccess: { amount: number };
  Complaints: undefined;
  NewComplaint: undefined;
  Maintenance: undefined;
  NewMaintenance: undefined;
  Food: undefined;
  Notices: undefined;
  Visitors: undefined;
  NewVisitor: undefined;
  Documents: undefined;
  Notifications: undefined;
  HelpSupport: undefined;
  SupportChat: undefined;
  Privacy: undefined;
  EditProfile: undefined;
  NearbyPlaces: undefined;
  VacateNotice: undefined;
  BookRoomForm: { propertyId: string; roomId: string; stayType: 'Monthly' | 'DayGuest' };
  ResidentRegistration: {
    propertyId: string;
    roomId: string;
    stayType: 'Monthly' | 'DayGuest';
    name: string;
    phone: string;
    email: string;
    gender: 'Male' | 'Female' | 'Other';
    method: 'Cash' | 'UPI';
    numDays?: number;
    joiningDateISO: string;
    securityDeposit?: number;
  };
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  AdminResidentDetail: { residentId: string };
  AdminResidentForm: { residentId?: string };
};