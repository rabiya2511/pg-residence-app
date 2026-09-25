import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rent-reminders', {
      name: 'Rent Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('vacate-notices', {
      name: 'Vacate Notices',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  if (!Device.isDevice) {
    console.log('Must use a physical device or emulator with Play services for notifications');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleRentReminder(dueDate: Date, amount: number, isPaid: boolean) {
  // Cancel any previously scheduled rent reminders first, to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (isPaid) {
    console.log('Rent already paid, skipping reminder scheduling');
    return;
  }

  const year = dueDate.getFullYear();
  const month = dueDate.getMonth(); // 0-indexed, matches the due date's month

  const now = Date.now();
  let scheduledCount = 0;

  // Schedule one notification per day from the 1st to the 10th of the month
  for (let day = 1; day <= 10; day++) {
    const reminderDate = new Date(year, month, day, 9, 0, 0, 0); // 9 AM each day

    // Skip any day that's already in the past
    if (reminderDate.getTime() <= now) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rent Due',
        body: `Your rent of ₹${amount} is still pending for this month. Please pay at the earliest to avoid late fees.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
    scheduledCount++;
  }

  console.log(`Scheduled ${scheduledCount} rent reminder(s) for the 1st-10th window`);
}

export async function scheduleTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rent Due Soon',
      body: 'This is a test of the rent reminder notification.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
    },
  });
}

// Fires immediately (no scheduled trigger) the moment a resident submits a
// vacate notice — this is the "admin gets notified right away" requirement.
// Since admin and resident share one app instance in this mock setup, this
// fires as a normal local notification regardless of which role is currently
// logged in on this device.
export async function sendVacateNoticeAlert(residentName: string, vacatingDateLabel: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Vacate Notice Submitted',
      body: `${residentName} has given notice to vacate on ${vacatingDateLabel}.`,
    },
    trigger: null, // fire immediately
  });
}