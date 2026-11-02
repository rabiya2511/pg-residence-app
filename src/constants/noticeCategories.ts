// Categories an admin can pick for a notice; residents can filter by them.
export type NoticeCategory = { id: string; label: string; icon: string };

export const NOTICE_CATEGORIES: NoticeCategory[] = [
  { id: 'general', label: 'General', icon: 'megaphone-outline' },
  { id: 'rent', label: 'Rent Reminder', icon: 'cash-outline' },
  { id: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { id: 'power', label: 'Power / Generator', icon: 'flash-outline' },
  { id: 'water', label: 'Water / Hot Water', icon: 'water-outline' },
  { id: 'food', label: 'Food', icon: 'restaurant-outline' },
  { id: 'cleaning', label: 'Cleaning', icon: 'sparkles-outline' },
  { id: 'holiday', label: 'Holiday', icon: 'calendar-outline' },
  { id: 'rules', label: 'Rules', icon: 'document-text-outline' },
  { id: 'emergency', label: 'Emergency', icon: 'warning-outline' },
];

// Older notices have no category: they count as General.
export const categoryOf = (n: { category?: string } | any): NoticeCategory =>
  NOTICE_CATEGORIES.find((c) => c.id === n?.category) ?? NOTICE_CATEGORIES[0];