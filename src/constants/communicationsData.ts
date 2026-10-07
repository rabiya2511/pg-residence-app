export type MessageCategory =
  | 'Welcome'
  | 'PaymentReminder'
  | 'PendingDues'
  | 'ExitNotice'
  | 'GeneralNotification'
  | 'ReviewRequest';

export const CATEGORY_LABELS: Record<MessageCategory, string> = {
  Welcome: 'Welcome / Onboarding',
  PaymentReminder: 'Payment Reminder',
  PendingDues: 'Pending Dues',
  ExitNotice: 'Exit / Notice-to-Leave',
  GeneralNotification: 'General Notification',
  ReviewRequest: 'Review Request',
};

export const CATEGORY_ORDER: MessageCategory[] = [
  'Welcome',
  'PaymentReminder',
  'PendingDues',
  'ExitNotice',
  'GeneralNotification',
  'ReviewRequest',
];

export type Channel = 'WhatsApp' | 'SMS' | 'Email' | 'InApp';

export const CHANNEL_LABELS: Record<Channel, string> = {
  WhatsApp: 'WhatsApp',
  SMS: 'SMS',
  Email: 'Email',
  InApp: 'In-App Alert',
};

export type MessageTemplate = {
  id: string;
  category: MessageCategory;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  isActive: boolean;
};

// Every token is replaced at send time by resolvePlaceholders() in CommunicationsContext.
export const PLACEHOLDER_GROUPS: { key: string; label: string; tokens: string[] }[] = [
  {
    key: 'resident',
    label: 'Resident',
    tokens: ['{{ResidentName}}', '{{MobileNumber}}', '{{Email}}', '{{RoomNumber}}', '{{BedNumber}}', '{{JoiningDate}}'],
  },
  {
    key: 'property',
    label: 'Property',
    tokens: [
      '{{PropertyName}}',
      '{{PropertyAddress}}',
      '{{PropertyContactNumber}}',
      '{{PropertyEmail}}',
      '{{WifiName}}',
      '{{WifiPassword}}',
      '{{WhatsappGroupLink}}',
      '{{UpiId}}',
      '{{PayeeName}}',
      '{{GoogleReviewLink}}',
    ],
  },
  {
    key: 'payment',
    label: 'Payment',
    tokens: [
      '{{RentAmount}}',
      '{{PaymentDueAmount}}',
      '{{DueDate}}',
      '{{PendingAmount}}',
      '{{PaymentLink}}',
      '{{CurrentDate}}',
      '{{NoticeDate}}',
      '{{ExitDate}}',
      '{{StaffName}}',
    ],
  },
];

export const ALL_PLACEHOLDER_TOKENS: string[] = PLACEHOLDER_GROUPS.flatMap((g) => g.tokens);

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl_welcome',
    category: 'Welcome',
    name: 'Standard Welcome & Onboarding',
    subject: 'Welcome to {{PropertyName}}!',
    isDefault: true,
    isActive: true,
    body:
      'Welcome to {{PropertyName}}! 🏠\n\n' +
      'Hello {{ResidentName}},\n\n' +
      'Welcome to {{PropertyName}}! We are thrilled to have you with us. Here are your onboarding details:\n\n' +
      '🛏️ Accommodation Details:\n' +
      '• Room: {{RoomNumber}}\n' +
      '• Bed: {{BedNumber}}\n' +
      '• Joining Date: {{JoiningDate}}\n\n' +
      '📶 Wifi: {{WifiName}} / {{WifiPassword}}\n' +
      '💬 Resident Group: {{WhatsappGroupLink}}\n\n' +
      'If you need anything, reach us at {{PropertyContactNumber}}.',
  },
  {
    id: 'tpl_payment_reminder',
    category: 'PaymentReminder',
    name: 'Friendly Rent Reminder',
    subject: 'Upcoming Rent Reminder - {{PropertyName}}',
    isDefault: true,
    isActive: true,
    body:
      'Rent Due Notice - {{PropertyName}} 📅\n\n' +
      'Hi {{ResidentName}},\n\n' +
      'This is a friendly reminder that your rent of ₹{{RentAmount}} for Room {{RoomNumber}} is due on {{DueDate}}.\n\n' +
      'Pay via UPI: {{UpiId}} ({{PayeeName}}), or use this link: {{PaymentLink}}\n\n' +
      'Thank you!',
  },
  {
    id: 'tpl_pending_dues',
    category: 'PendingDues',
    name: 'Monthly Rent Reminder',
    subject: 'Rent Due Reminder - {{PropertyName}}',
    isDefault: true,
    isActive: true,
    body:
      'Payment Reminder: {{PropertyName}} 💰\n\n' +
      'Dear {{ResidentName}},\n\n' +
      'Our records show a pending amount of ₹{{PendingAmount}} against your account as of {{CurrentDate}}.\n\n' +
      'Kindly clear this at the earliest to avoid any inconvenience. Pay via: {{PaymentLink}}',
  },
  {
    id: 'tpl_exit_notice',
    category: 'ExitNotice',
    name: 'Exit Notice Acknowledgment',
    subject: 'Notice-to-Leave Acknowledgment - {{PropertyName}}',
    isDefault: true,
    isActive: true,
    body:
      'Exit Notice Acknowledgment - {{PropertyName}} 🚪\n\n' +
      'Dear {{ResidentName}},\n\n' +
      'We acknowledge your notice to vacate Room {{RoomNumber}}, received on {{NoticeDate}}. Your exit date is recorded as {{ExitDate}}.\n\n' +
      'Our team ({{StaffName}}) will reach out regarding deposit settlement and checkout formalities.',
  },
  {
    id: 'tpl_general',
    category: 'GeneralNotification',
    name: 'General Property Announcement',
    subject: 'Notice for Residents - {{PropertyName}}',
    isDefault: true,
    isActive: true,
    body:
      'Announcement from {{PropertyName}} 📢\n\n' +
      'Dear Resident {{ResidentName}},\n\n' +
      'This is a general notice regarding {{PropertyName}}. Please check with the front desk for details.\n\n' +
      'Regards,\n{{StaffName}}',
  },
  {
    id: 'tpl_review',
    category: 'ReviewRequest',
    name: 'Google Review & Feedback Request',
    subject: 'How is your stay at {{PropertyName}}? ⭐',
    isDefault: true,
    isActive: true,
    body:
      'How was your experience at {{PropertyName}}? ⭐\n\n' +
      'Dear {{ResidentName}},\n\n' +
      'We hope you are enjoying your stay! If you have a moment, we would love your feedback: {{GoogleReviewLink}}\n\n' +
      'Thank you for choosing {{PropertyName}}.',
  },
  {
    id: 'tpl_payment_due_short',
    category: 'PaymentReminder',
    name: 'Short Payment Due Alert',
    subject: 'Payment Due - {{PropertyName}}',
    isDefault: false,
    isActive: true,
    body: 'Hi {{ResidentName}}, your payment of ₹{{PaymentDueAmount}} is due on {{DueDate}}. — {{PropertyName}}',
  },
  {
    id: 'tpl_general_short',
    category: 'GeneralNotification',
    name: 'Short General Notice',
    subject: 'Notice - {{PropertyName}}',
    isDefault: false,
    isActive: true,
    body: 'Dear {{ResidentName}}, please note an update regarding {{PropertyName}}. Contact {{StaffName}} for details.',
  },
];