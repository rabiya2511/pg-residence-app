export const residentData = {
  name: 'Rabiya',
  pgName: 'Lokansh Aditya PG Residency',
  room: 'A-204',
  bed: 'B2',
  floor: '2nd Floor',
  joiningDate: '12 Jan 2026',
  monthlyRent: 8500,
  nextDueDate: 'Sep 5',
  stayStatus: 'Active',
  email: 'rabiya@example.com',
  phone: '+91 90011 22334',
  dob: '15 Aug 1999',
  gender: 'Female',
  profileImageUri: null as string | null,
  occupation: '',
  companyName: '',
  occupationAddress: '',
  nativePlace: '',
  emergencyContact1: '',
  emergencyContact2: '',
  companyIdProofUri: null as string | null,
};

export type RentPaymentStatus = 'Pending' | 'Paid';

export const rentStatus = {
  amount: 8500,
  monthLabel: 'September Rent',
  dueDate: new Date(2026, 8, 5),
  dueInDays: 4,
  status: 'Pending' as RentPaymentStatus,
  isPaid: false,
};

export type QuickAction = {
  id: string;
  label: string;
  icon: string;
};

export const quickActions: QuickAction[] = [
  { id: 'rent', label: 'Rent', icon: 'cash-outline' },
  { id: 'complaints', label: 'Complaints', icon: 'alert-circle-outline' },
  { id: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { id: 'food', label: 'Food', icon: 'restaurant-outline' },
  { id: 'notices', label: 'Notices', icon: 'megaphone-outline' },
  { id: 'visitors', label: 'Visitors', icon: 'people-outline' },
  { id: 'nearby', label: 'Nearby', icon: 'location-outline' },
  { id: 'vacate', label: 'Vacate Notice', icon: 'exit-outline' },
];

export type Announcement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  date: string;
  propertyId: string;
};
export const announcements: Announcement[] = [
  {
    id: '1',
    title: 'Rent Payment Reminder',
    description: 'Your September rent is due in 4 days. Pay on time to avoid late fees.',
    date: 'Sep 1',
    icon: 'cash-outline',
    propertyId: 'pg1',
  },
  {
    id: '2',
    title: 'Scheduled Maintenance',
    description: 'Water supply will be interrupted on 3rd Sep from 10 AM to 1 PM for pipe repair.',
    date: 'Aug 30',
    icon: 'construct-outline',
    propertyId: 'pg1',
  },
  {
    id: '3',
    title: 'New Mess Menu Available',
    description: 'Check out the updated weekly mess menu with new dishes added.',
    date: 'Aug 28',
    icon: 'restaurant-outline',
    propertyId: 'pg1',
  },
  {
    id: '4',
    title: 'Wi-Fi Maintenance Completed',
    description: 'Wi-Fi router on the 2nd floor has been replaced. You should now experience faster and more stable internet.',
    date: 'Aug 26',
    icon: 'wifi-outline',
    propertyId: 'pg1',
  },
  {
    id: '5',
    title: 'Common Area Cleaning Schedule Updated',
    description: 'Common areas will now be cleaned twice daily — 8 AM and 6 PM — instead of once. Please cooperate with housekeeping staff.',
    date: 'Aug 24',
    icon: 'sparkles-outline',
    propertyId: 'pg1',
  },
  {
    id: '6',
    title: 'Diwali Holiday Notice',
    description: 'The PG office will remain closed on Diwali. For emergencies, please contact the warden directly at the number provided on the notice board.',
    date: 'Aug 20',
    icon: 'calendar-outline',
    propertyId: 'pg1',
  },
];

export type PaymentRecord = {
  id: string;
  month: string;
  amount: number;
  paidOn: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  method?: string;
  transactionId?: string;
};

export const paymentHistory: PaymentRecord[] = [
  { id: 'p1', month: 'August 2026', amount: 8500, paidOn: 'Aug 3, 2026', status: 'Paid' },
  { id: 'p2', month: 'July 2026', amount: 8500, paidOn: 'Jul 2, 2026', status: 'Paid' },
  { id: 'p3', month: 'June 2026', amount: 8500, paidOn: 'Jun 5, 2026', status: 'Paid' },
  { id: 'p4', month: 'May 2026', amount: 8000, paidOn: 'May 4, 2026', status: 'Paid' },
];

export type ComplaintStatus = 'Open' | 'In Progress' | 'Resolved';

export type Complaint = {
  id: string;
  category: string;
  description: string;
  date: string;
  status: ComplaintStatus;
};

export const complaints: Complaint[] = [
  {
    id: 'c1',
    category: 'Electrical',
    description: 'Ceiling fan in room A-204 is making a loud noise.',
    date: 'Aug 30, 2026',
    status: 'In Progress',
  },
  {
    id: 'c2',
    category: 'Plumbing',
    description: 'Bathroom tap is leaking continuously.',
    date: 'Aug 25, 2026',
    status: 'Resolved',
  },
  {
    id: 'c3',
    category: 'Housekeeping',
    description: 'Common area on 2nd floor was not cleaned yesterday.',
    date: 'Aug 20, 2026',
    status: 'Resolved',
  },
];

export const complaintCategories = [
  'Electrical',
  'Plumbing',
  'Housekeeping',
  'Wi-Fi / Internet',
  'Furniture',
  'Other',
];

export type MaintenanceStatus = 'Open' | 'In Progress' | 'Resolved';

export type MaintenanceRequest = {
  id: string;
  category: string;
  description: string;
  date: string;
  status: MaintenanceStatus;
};

export const maintenanceRequests: MaintenanceRequest[] = [
  {
    id: 'm1',
    category: 'AC / Cooling',
    description: 'AC in room A-204 is not cooling properly.',
    date: 'Aug 29, 2026',
    status: 'Open',
  },
  {
    id: 'm2',
    category: 'Furniture',
    description: 'Study table drawer handle is broken.',
    date: 'Aug 22, 2026',
    status: 'In Progress',
  },
  {
    id: 'm3',
    category: 'Electrical',
    description: 'Power socket near the bed is not working.',
    date: 'Aug 15, 2026',
    status: 'Resolved',
  },
];

export const maintenanceCategories = [
  'AC / Cooling',
  'Electrical',
  'Plumbing',
  'Furniture',
  'Appliance',
  'Other',
];

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export type MenuEntry = {
  day: string;
  mealType: MealType;
  items: string;
};

export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const weeklyMenu: MenuEntry[] = [
  { day: 'Monday', mealType: 'Breakfast', items: 'Poha, Boiled Eggs, Tea/Coffee' },
  { day: 'Monday', mealType: 'Lunch', items: 'Dal, Rice, Roti, Mixed Veg, Salad' },
  { day: 'Monday', mealType: 'Dinner', items: 'Paneer Curry, Rice, Roti, Curd' },

  { day: 'Tuesday', mealType: 'Breakfast', items: 'Idli, Sambar, Chutney' },
  { day: 'Tuesday', mealType: 'Lunch', items: 'Rajma, Rice, Roti, Aloo Sabzi' },
  { day: 'Tuesday', mealType: 'Dinner', items: 'Chicken Curry, Rice, Roti' },

  { day: 'Wednesday', mealType: 'Breakfast', items: 'Bread Omelette, Tea/Coffee' },
  { day: 'Wednesday', mealType: 'Lunch', items: 'Chole, Rice, Roti, Salad' },
  { day: 'Wednesday', mealType: 'Dinner', items: 'Egg Curry, Rice, Roti, Curd' },

  { day: 'Thursday', mealType: 'Breakfast', items: 'Upma, Banana, Tea/Coffee' },
  { day: 'Thursday', mealType: 'Lunch', items: 'Sambar, Rice, Roti, Beans Sabzi' },
  { day: 'Thursday', mealType: 'Dinner', items: 'Paneer Butter Masala, Rice, Roti' },

  { day: 'Friday', mealType: 'Breakfast', items: 'Paratha, Curd, Pickle' },
  { day: 'Friday', mealType: 'Lunch', items: 'Kadhi, Rice, Roti, Bhindi Sabzi' },
  { day: 'Friday', mealType: 'Dinner', items: 'Chicken Biryani, Raita' },

  { day: 'Saturday', mealType: 'Breakfast', items: 'Dosa, Chutney, Sambar' },
  { day: 'Saturday', mealType: 'Lunch', items: 'Dal Fry, Rice, Roti, Mix Veg' },
  { day: 'Saturday', mealType: 'Dinner', items: 'Veg Pulao, Raita, Papad' },

  { day: 'Sunday', mealType: 'Breakfast', items: 'Chole Bhature' },
  { day: 'Sunday', mealType: 'Lunch', items: 'Special Thali - Chicken Curry, Paneer, Dal, Rice, Roti, Sweet' },
  { day: 'Sunday', mealType: 'Dinner', items: 'Chicken Curry, Rice, Roti' },
];

export type VisitorStatus = 'Checked In' | 'Checked Out';

export type VisitorLog = {
  id: string;
  visitorName: string;
  purpose: string;
  checkInTime: string;
  checkOutTime: string | null;
  date: string;
  status: VisitorStatus;
};

export const visitorLogs: VisitorLog[] = [
  {
    id: 'v1',
    visitorName: 'Amit Sharma',
    purpose: 'Friend visit',
    checkInTime: '4:30 PM',
    checkOutTime: '7:15 PM',
    date: 'Aug 31, 2026',
    status: 'Checked Out',
  },
  {
    id: 'v2',
    visitorName: 'Priya Patel',
    purpose: 'Family visit',
    checkInTime: '11:00 AM',
    checkOutTime: '2:00 PM',
    date: 'Aug 28, 2026',
    status: 'Checked Out',
  },
  {
    id: 'v3',
    visitorName: 'Rohan Verma',
    purpose: 'Delivery pickup',
    checkInTime: '6:45 PM',
    checkOutTime: '6:50 PM',
    date: 'Aug 24, 2026',
    status: 'Checked Out',
  },
  {
    id: 'v4',
    visitorName: 'Sneha Reddy',
    purpose: 'Friend visit',
    checkInTime: '5:00 PM',
    checkOutTime: null,
    date: 'Sep 1, 2026',
    status: 'Checked In',
  },
];
export type DocumentStatus = 'Uploaded' | 'Pending' | 'Rejected';

export type ResidentDocument = {
  id: string;
  name: string;
  description: string;
  status: DocumentStatus;
  uploadedOn: string | null;
  fileUri?: string | null;
};

export const residentDocuments: ResidentDocument[] = [
  {
    id: 'd1',
    name: 'Aadhaar Card',
    description: 'Government-issued ID proof',
    status: 'Uploaded',
    uploadedOn: 'Jan 10, 2026',
  },
  {
    id: 'd2',
    name: 'PAN Card',
    description: 'Permanent Account Number card',
    status: 'Uploaded',
    uploadedOn: 'Jan 10, 2026',
  },
  {
    id: 'd3',
    name: 'Rental Agreement',
    description: 'Signed PG rental agreement',
    status: 'Uploaded',
    uploadedOn: 'Jan 12, 2026',
  },
  {
    id: 'd4',
    name: 'Passport Photo',
    description: 'Recent passport-size photograph',
    status: 'Pending',
    uploadedOn: null,
  },
];

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  date: string;
  icon: string;
  read: boolean;
};

export const notificationsList: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Rent Due Soon',
    body: 'Your rent of ₹8,500 is due on Sep 5, 2026. Pay on time to avoid late fees.',
    date: 'Today, 9:00 AM',
    icon: 'cash-outline',
    read: false,
  },
  {
    id: 'n2',
    title: 'Rent Due Soon',
    body: 'Your rent of ₹8,500 is due on Sep 5, 2026. Pay on time to avoid late fees.',
    date: 'Yesterday, 9:00 AM',
    icon: 'cash-outline',
    read: true,
  },
  {
    id: 'n3',
    title: 'Scheduled Maintenance',
    body: 'Water supply will be interrupted on 3rd Sep from 10 AM to 1 PM for pipe repair.',
    date: 'Aug 30, 10:15 AM',
    icon: 'construct-outline',
    read: true,
  },
  {
    id: 'n4',
    title: 'New Mess Menu Available',
    body: 'Check out the updated weekly mess menu with new dishes added.',
    date: 'Aug 28, 8:00 AM',
    icon: 'restaurant-outline',
    read: true,
  },
]; 

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export const faqs: FAQItem[] = [
  {
    id: 'f1',
    question: 'How do I pay my rent?',
    answer: 'Go to Home or Profile, tap "Rent" / "Payment History", then tap "Pay Now" and choose your preferred payment method.',
  },
  {
    id: 'f2',
    question: 'How do I raise a complaint?',
    answer: 'Tap "Complaints" from Home or Profile, then tap the "+" button to submit a new complaint with a category and description.',
  },
  {
    id: 'f3',
    question: 'Can I have visitors stay overnight?',
    answer: 'Overnight stays require prior approval from the warden. Please log all visitors under the Visitors section.',
  },
  {
    id: 'f4',
    question: 'How do I request maintenance?',
    answer: 'Tap "Maintenance" from Home, then submit a request with the issue category and description.',
  },
  {
    id: 'f5',
    question: 'What is the mess timing?',
    answer: 'Breakfast: 7:30–9:30 AM, Lunch: 12:30–2:30 PM, Dinner: 8:00–10:00 PM. Check the Food section for the weekly menu.',
  },
];

export const supportContact = {
  wardenName: 'Mr. Suresh Kumar',
  phone: '+91 98765 12345',
  email: 'support@lokanshadityapg.example.com',
};

export type PrivacySetting = {
  id: string;
  label: string;
  description: string;
  defaultValue: boolean;
};

export const privacySettings: PrivacySetting[] = [
  {
    id: 'profileVisibility',
    label: 'Profile Visibility',
    description: 'Allow other residents to see your name and room number.',
    defaultValue: true,
  },
  {
    id: 'notificationPrefs',
    label: 'Personalized Notifications',
    description: 'Receive notifications tailored to your stay and preferences.',
    defaultValue: true,
  },
  {
    id: 'dataSharing',
    label: 'Data Sharing with PG Management',
    description: 'Share your usage data with PG management to improve services.',
    defaultValue: false,
  },
];


export const privacyPolicyText = `We value your privacy. This app collects only the information necessary to provide PG residency services, including your profile details, rent and payment history, complaints, and maintenance requests.

Your data is used solely to manage your stay and is not sold to third parties. You can control visibility and notification preferences below.

For any privacy-related concerns, please contact the warden or use the Help & Support section.`;

export type RoomAssignmentRecord = {
  id: string;
  propertyId: string;
  roomId: string;
  fromDate: string; // display date they moved into this room
  toDate: string | null; // display date they moved out — null means current
};

export type AdminResident = {
  id: string;
  name: string;
  email: string;
  gender: AdminGender;
  propertyId: string;
  roomId: string;
  phone: string;
  joiningDate: string;
  rentStatus: 'Paid' | 'Pending' | 'Overdue';
  monthlyRent: number;
  rentDueDay: number;
  vacatingDate: string | null; // set once the resident submits a Vacate Notice, e.g. "25 Sep 2026"
  securityDeposit: number; // held deposit, admin sets when adding the resident
  vacateReason: string | null; // resident's stated reason for vacating
  emergencyVacateDeductionPercent: number | null; // % of deposit cut, only set for an Emergency Vacate
  roomHistory?: RoomAssignmentRecord[];
  emergencyContact1?: string;
  emergencyContact2?: string;
  profileImageUri?: string | null;
  occupation?: string;
  occupationAddress?: string;
  nativePlace?: string;
  companyIdProofUri?: string | null;
    guardianName?: string;
  guardianPhone?: string;
  maintenanceFee?: number;
  advanceDepositStatus?: 'Paid' | 'Not Paid' | 'No Advance';
  isPreBooking?: boolean;
  firstMonthPayment?: { amount: number; method: string; reference?: string };
  vehicleType?: 'Bicycle' | 'Two-Wheeler' | 'Four-Wheeler';
  vehicleNumber?: string;
  vehicleModel?: string;
};

export const adminResidents: AdminResident[] = [
  { id: 'r1', name: 'Rabiya', email: 'rabiya@example.com', gender: 'Female', propertyId: 'prop1', roomId: 'prop1-105', phone: '+91 90011 22334', joiningDate: '12 Jan 2026', rentStatus: 'Pending', monthlyRent: 8500, rentDueDay: 5, vacatingDate: null, securityDeposit: 10000, vacateReason: null, emergencyVacateDeductionPercent: null },
  { id: 'r2', name: 'Amit Sharma', email: 'amit.sharma@example.com', gender: 'Male', propertyId: 'prop1', roomId: 'prop1-101', phone: '+91 91234 56780', joiningDate: '5 Mar 2026', rentStatus: 'Paid', monthlyRent: 8000, rentDueDay: 5, vacatingDate: null, securityDeposit: 10000, vacateReason: null, emergencyVacateDeductionPercent: null },
  { id: 'r3', name: 'Priya Patel', email: 'priya.patel@example.com', gender: 'Female', propertyId: 'prop2', roomId: 'prop2-101', phone: '+91 99887 66554', joiningDate: '20 Feb 2026', rentStatus: 'Overdue', monthlyRent: 9000, rentDueDay: 5, vacatingDate: null, securityDeposit: 10000, vacateReason: null, emergencyVacateDeductionPercent: null },
  { id: 'r4', name: 'Rohan Verma', email: 'rohan.verma@example.com', gender: 'Male', propertyId: 'prop1', roomId: 'prop1-105', phone: '+91 90000 11122', joiningDate: '1 Apr 2026', rentStatus: 'Paid', monthlyRent: 8500, rentDueDay: 5, vacatingDate: null, securityDeposit: 10000, vacateReason: null, emergencyVacateDeductionPercent: null },
  { id: 'r5', name: 'Sneha Reddy', email: 'sneha.reddy@example.com', gender: 'Female', propertyId: 'prop2', roomId: 'prop2-103', phone: '+91 98123 45670', joiningDate: '15 Jan 2026', rentStatus: 'Pending', monthlyRent: 8000, rentDueDay: 5, vacatingDate: null, securityDeposit: 10000, vacateReason: null, emergencyVacateDeductionPercent: null },
];

export type AdminComplaint = {
  id: string;
  residentName: string;
  room: string;
  category: string;
  description: string;
  date: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  viewed: boolean;
  inProgressOn?: string;
  resolvedOn?: string;
  residentId: string;
  propertyId?: string;

};

export const adminComplaints: AdminComplaint[] = [
  { id: 'ac1', residentName: 'Rabiya', room: 'A-204', category: 'Electrical', description: 'Ceiling fan making a loud noise.', date: 'Aug 30, 2026', status: 'In Progress', viewed: true, residentId: 'r1' },
  { id: 'ac2', residentName: 'Priya Patel', room: 'B-302', category: 'Plumbing', description: 'Bathroom tap leaking continuously.', date: 'Aug 29, 2026', status: 'Open', viewed: false, residentId: 'r3' },
  { id: 'ac3', residentName: 'Rohan Verma', room: 'A-204', category: 'Wi-Fi / Internet', description: 'Wi-Fi very slow in the evenings.', date: 'Aug 27, 2026', status: 'Open', viewed: false, residentId: 'r4' },
  { id: 'ac4', residentName: 'Amit Sharma', room: 'A-105', category: 'Furniture', description: 'Wardrobe door hinge broken.', date: 'Aug 22, 2026', status: 'Resolved', viewed: true, residentId: 'r2' },
  { id: 'ac5', residentName: 'Sneha Reddy', room: 'B-301', category: 'Housekeeping', description: 'Common bathroom not cleaned properly.', date: 'Aug 20, 2026', status: 'Resolved', viewed: true, residentId: 'r5' },
];

export type MonthlyRevenue = {
  month: string;
  amount: number;
};

export const revenueHistory: MonthlyRevenue[] = [
  { month: 'Apr', amount: 38500 },
  { month: 'May', amount: 40500 },
  { month: 'Jun', amount: 39000 },
  { month: 'Jul', amount: 41500 },
  { month: 'Aug', amount: 42000 },
  { month: 'Sep', amount: 34000 },
];

export type PaymentTiming = 'Early' | 'On Time' | 'Late';

export type AdminPaymentRecord = {
  id: string;
  residentId: string;
  month: string; // e.g. "September 2026"
  amount: number;
  dueDate: string; // display date, e.g. "05 Sep 2026"
  paidOn: string | null; // null until the resident/admin actually records payment
  status: 'Paid' | 'Pending' | 'Overdue';
  timing?: PaymentTiming; // only set once paid — Early / On Time / Late vs dueDate
  method?: string;
  transactionId?: string;
};

export const adminPaymentHistory: AdminPaymentRecord[] = [
  { id: 'ap1', residentId: 'r1', month: 'August 2026', amount: 8500, dueDate: '05 Aug 2026', paidOn: 'Aug 3, 2026', status: 'Paid', timing: 'Early' },
  { id: 'ap2', residentId: 'r1', month: 'July 2026', amount: 8500, dueDate: '05 Jul 2026', paidOn: 'Jul 2, 2026', status: 'Paid', timing: 'Early' },
  { id: 'ap3', residentId: 'r1', month: 'June 2026', amount: 8500, dueDate: '05 Jun 2026', paidOn: 'Jun 5, 2026', status: 'Paid', timing: 'On Time' },
  { id: 'ap4', residentId: 'r2', month: 'August 2026', amount: 8000, dueDate: '05 Aug 2026', paidOn: 'Aug 5, 2026', status: 'Paid', timing: 'On Time' },
  { id: 'ap5', residentId: 'r2', month: 'July 2026', amount: 8000, dueDate: '05 Jul 2026', paidOn: 'Jul 4, 2026', status: 'Paid', timing: 'Early' },
  { id: 'ap6', residentId: 'r3', month: 'August 2026', amount: 9000, dueDate: '05 Aug 2026', paidOn: 'Aug 20, 2026', status: 'Paid', timing: 'Late' },
  { id: 'ap7', residentId: 'r4', month: 'August 2026', amount: 8500, dueDate: '05 Aug 2026', paidOn: 'Aug 2, 2026', status: 'Paid', timing: 'Early' },
  { id: 'ap8', residentId: 'r4', month: 'July 2026', amount: 8500, dueDate: '05 Jul 2026', paidOn: 'Jul 1, 2026', status: 'Paid', timing: 'Early' },
  { id: 'ap9', residentId: 'r5', month: 'August 2026', amount: 8000, dueDate: '05 Aug 2026', paidOn: 'Aug 8, 2026', status: 'Paid', timing: 'Late' },
];

export type AdminResidentDocument = {
  id: string;
  residentId: string;
  name: string;
  status: 'Uploaded' | 'Pending' | 'Rejected';
  uploadedOn: string | null;
};

export const adminResidentDocuments: AdminResidentDocument[] = [
  { id: 'ad1', residentId: 'r1', name: 'Aadhaar Card', status: 'Uploaded', uploadedOn: 'Jan 10, 2026' },
  { id: 'ad2', residentId: 'r1', name: 'PAN Card', status: 'Uploaded', uploadedOn: 'Jan 10, 2026' },
  { id: 'ad3', residentId: 'r1', name: 'Rental Agreement', status: 'Uploaded', uploadedOn: 'Jan 12, 2026' },
  { id: 'ad4', residentId: 'r1', name: 'Passport Photo', status: 'Pending', uploadedOn: null },
  { id: 'ad5', residentId: 'r2', name: 'Aadhaar Card', status: 'Uploaded', uploadedOn: 'Mar 5, 2026' },
  { id: 'ad6', residentId: 'r2', name: 'Rental Agreement', status: 'Uploaded', uploadedOn: 'Mar 6, 2026' },
  { id: 'ad7', residentId: 'r3', name: 'Aadhaar Card', status: 'Uploaded', uploadedOn: 'Feb 20, 2026' },
  { id: 'ad8', residentId: 'r3', name: 'PAN Card', status: 'Pending', uploadedOn: null },
  { id: 'ad9', residentId: 'r4', name: 'Aadhaar Card', status: 'Uploaded', uploadedOn: 'Apr 1, 2026' },
  { id: 'ad10', residentId: 'r5', name: 'Aadhaar Card', status: 'Rejected', uploadedOn: 'Jan 16, 2026' },
];

export type SavedUpi = {
  id: string;
  upiId: string;
};

export type SavedCard = {
  id: string;
  cardNumberLast4: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cardType: 'Visa' | 'Mastercard' | 'RuPay' | 'Other';
};

export const banks = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank',
  'Kotak Mahindra Bank',
];

export type PaymentMethodType = 'UPI' | 'Card' | 'Net Banking';

export type AdminIdentityDocument = {
  residentId: string;
  frontUri: string | null;
  backUri: string | null;
};

export const adminIdentityDocuments: AdminIdentityDocument[] = [
  { residentId: 'r1', frontUri: null, backUri: null },
  { residentId: 'r2', frontUri: null, backUri: null },
  { residentId: 'r3', frontUri: null, backUri: null },
  { residentId: 'r4', frontUri: null, backUri: null },
  { residentId: 'r5', frontUri: null, backUri: null },
];

export type NearbyPlaceCategory = 'Cafe' | 'Grocery/Mart' | 'Restaurant' | 'Pharmacy' | 'ATM/Bank' | 'Gym';

export type NearbyPlace = {
  id: string;
  name: string;
  category: NearbyPlaceCategory;
  distance: string;
  rating: number;
  icon: string;
};

export const nearbyPlaces: NearbyPlace[] = [
  { id: 'np1', name: 'Brew & Bean Cafe', category: 'Cafe', distance: '0.2 km', rating: 4.3, icon: 'cafe-outline' },
  { id: 'np2', name: 'Daily Needs Mart', category: 'Grocery/Mart', distance: '0.3 km', rating: 4.1, icon: 'cart-outline' },
  { id: 'np3', name: 'Spice Route Restaurant', category: 'Restaurant', distance: '0.4 km', rating: 4.5, icon: 'restaurant-outline' },
  { id: 'np4', name: 'CityCare Pharmacy', category: 'Pharmacy', distance: '0.5 km', rating: 4.0, icon: 'medkit-outline' },
  { id: 'np5', name: 'SBI ATM', category: 'ATM/Bank', distance: '0.3 km', rating: 3.8, icon: 'card-outline' },
  { id: 'np6', name: 'FitZone Gym', category: 'Gym', distance: '0.6 km', rating: 4.2, icon: 'barbell-outline' },
  { id: 'np7', name: 'Corner Coffee House', category: 'Cafe', distance: '0.7 km', rating: 4.4, icon: 'cafe-outline' },
  { id: 'np8', name: 'QuickMart Supermarket', category: 'Grocery/Mart', distance: '0.8 km', rating: 4.0, icon: 'cart-outline' },
];

export type PropertyAddress = {
  streetNo: string;
  landmark: string;
  city: string;
  pinCode: string;
};

export const HOUSE_GUIDELINE_PRESETS: Record<'Co-Living' | 'Executive' | 'Student', string> = {
  'Co-Living':
    '1. Gate Timings: Main entrance closes strictly at 10:30 PM. Late entry requires prior warden permission.\n2. Visitor Guidelines: Visitors permitted in common lounge only until 8:00 PM. No entry into private rooms.\n3. Rent Payment: Monthly rent must be settled on or before the due date.',
  Executive:
    '1. Gate Timings: Main entrance closes at 11:30 PM for working professionals.\n2. Visitor Guidelines: Visitors permitted in common areas until 9:00 PM.\n3. Rent Payment: Monthly rent must be settled on or before the due date.',
  Student:
    '1. Gate Timings: Main entrance closes strictly at 9:30 PM on weekdays, 10:30 PM on weekends.\n2. Visitor Guidelines: Visitors permitted in common lounge only until 7:00 PM. No entry into private rooms.\n3. Rent Payment: Monthly rent must be settled on or before the 5th of each month.',
};

export type Property = {
  id: string;
  name: string;
  address: string;
  addressDetails: PropertyAddress;
  images: string[];
  floors?: number;
  branchManager?: string;
  contactPhone?: string;
  standardRent?: number;
  googleReviewLink?: string;
  houseGuidelines?: string;
  logoUri?: string | null;
  upiId?: string | null;
  whatsappGroupLink?: string | null;
};

const EMPTY_ADDRESS: PropertyAddress = { streetNo: '', landmark: '', city: '', pinCode: '' };

export function formatPropertyAddress(details: PropertyAddress): string {
  const parts = [details.streetNo, details.landmark, details.city, details.pinCode].filter(
    (p) => p.trim().length > 0
  );
  return parts.join(', ');
}

export const properties: Property[] = [
  { id: 'prop1', name: 'Lokansh Aditya Co-living PG', address: '', addressDetails: { ...EMPTY_ADDRESS }, images: [] },
  { id: 'prop2', name: 'Lokansh Aditya Ladies PG', address: '', addressDetails: { ...EMPTY_ADDRESS }, images: [] },
];

export type Room = {
  id: string;
  propertyId: string;
  floor: number;
  roomNumber: string;
  capacity: number; // total beds in the room
};

// Base monthly rent by room sharing type, used to price a room for a
// resident's self-service booking flow (admin can still adjust after move-in).
export const MONTHLY_RENT_BY_CAPACITY: Record<number, number> = {
  1: 9500,
  2: 8500,
  3: 7500,
};

const FLOORS_PER_PROPERTY = 6;
const ROOMS_PER_FLOOR = 6;
// Per floor: rooms 1-2 are 1-sharing, 3-4 are 2-sharing, 5-6 are 3-sharing
const CAPACITY_BY_POSITION = [1, 1, 2, 2, 3, 3];

function generateRooms(propertyId: string): Room[] {
  const generated: Room[] = [];
  for (let floor = 1; floor <= FLOORS_PER_PROPERTY; floor++) {
    for (let position = 0; position < ROOMS_PER_FLOOR; position++) {
      const roomNumber = `${floor}${String(position + 1).padStart(2, '0')}`; // e.g. 101, 102 ... 601..606
      generated.push({
        id: `${propertyId}-${roomNumber}`,
        propertyId,
        floor,
        roomNumber,
        capacity: CAPACITY_BY_POSITION[position],
      });
    }
  }
  return generated;
}

export const initialRooms: Room[] = [
  ...generateRooms('prop1'),
  ...generateRooms('prop2'),
];

export const DAILY_GUEST_RATE = 600;
export type AdminDailyGuestPaymentStatus = 'Paid' | 'Pending';
export type AdminDailyGuestPaymentMethod = 'Cash' | 'UPI';
// Emergency Vacate deduction tiers: % of security deposit cut, based on how
// many days' notice the resident gave before their chosen vacating date.
// Sorted descending by minDays — the first matching tier (fewest days
// required) wins.
export const EMERGENCY_VACATE_DEDUCTION_TIERS: { minDays: number; percent: number }[] = [
  { minDays: 25, percent: 10 },
  { minDays: 20, percent: 15 },
  { minDays: 15, percent: 20 },
  { minDays: 10, percent: 30 },
  { minDays: 5, percent: 40 },
  { minDays: 0, percent: 50 },
];

export function getEmergencyVacateDeductionPercent(daysNotice: number): number {
  const tier = EMERGENCY_VACATE_DEDUCTION_TIERS.find((t) => daysNotice >= t.minDays);
  return tier ? tier.percent : 50;
}
export type AdminGender = 'Male' | 'Female' | 'Other';

// TODO: replace with your PG's real UPI ID (VPA), e.g. 'yourname@okhdfcbank' or '9876543210@ybl'
export const PG_UPI_ID = 'yourupi@okhdfcbank';
export const PG_PAYEE_NAME = 'PG Residence';

export type AdminDailyGuest = {
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: AdminGender;
  propertyId: string;
  roomId: string;
  checkInDate: string;
  checkInTimestamp: number;
  vacatingDate?: string;
  numDays: number;
  totalAmount: number;
  identityFrontUri: string | null;
  identityBackUri: string | null;
  advanceAmount: number;
  paymentStatus: AdminDailyGuestPaymentStatus;
  paymentMethod: AdminDailyGuestPaymentMethod | null;
};

export const adminDailyGuests: AdminDailyGuest[] = [];

export type ReportCategory = 'Resident' | 'Room' | 'Financial' | 'Maintenance';

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { id: 'resident-master', title: 'Resident Master Report', description: 'Complete directory of all registered residents with room and contact details', category: 'Resident' },
  { id: 'active-residents', title: 'Active Residents', description: 'List of currently active paying tenants living on premise', category: 'Resident' },
  { id: 'new-residents', title: 'New Residents', description: 'Recently joined residents within the selected timeframe', category: 'Resident' },
  { id: 'checked-out-residents', title: 'Checked-Out Residents', description: 'Residents whose vacating date has already passed', category: 'Resident' },
  { id: 'notice-period-residents', title: 'Notice Period Residents', description: 'Residents currently serving exit notice with an upcoming checkout date', category: 'Resident' },
  { id: 'pre-bookings', title: 'Pre-Bookings', description: 'Upcoming day-guest check-ins not yet arrived', category: 'Resident' },
  { id: 'daily-short-stay', title: 'Daily/Short-Stay Residents', description: 'Day guests with check-in, check-out and per-day tariffs', category: 'Resident' },
  { id: 'room-occupancy', title: 'Room Occupancy', description: 'Bed-by-bed occupancy status across every room', category: 'Room' },
  { id: 'vacant-rooms', title: 'Vacant Rooms', description: 'Rooms with at least one bed available right now', category: 'Room' },
  { id: 'full-rooms', title: 'Full Rooms', description: 'Rooms with zero beds remaining', category: 'Room' },
  { id: 'rent-collection', title: 'Rent Collection', description: 'Rent payments received, with amount, date and timing', category: 'Financial' },
  { id: 'pending-dues', title: 'Pending Dues', description: 'Residents with pending or overdue rent for the current month', category: 'Financial' },
  { id: 'revenue-summary', title: 'Revenue Summary', description: 'Combined resident rent and day-guest revenue collected', category: 'Financial' },
  { id: 'open-complaints', title: 'Open Complaints', description: 'Complaints and maintenance requests still open or in progress', category: 'Maintenance' },
  { id: 'resolved-complaints', title: 'Resolved Complaints', description: 'Complaints marked resolved', category: 'Maintenance' },
  { id: 'all-complaints', title: 'All Complaints', description: 'Every complaint and maintenance request on record', category: 'Maintenance' },
];