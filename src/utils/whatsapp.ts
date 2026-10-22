import { Alert, Linking } from 'react-native';

// Opens WhatsApp on THIS device with the resident's chat and the message already typed in.
// The admin only has to press WhatsApp's own send button. Nothing is sent automatically.

const DEFAULT_COUNTRY_CODE = '91'; // India

// "98765 43210", "+91 98765-43210", "098765 43210" -> "919876543210"
export function toWhatsAppNumber(phone: string, countryCode: string = DEFAULT_COUNTRY_CODE): string | null {
  let d = (phone || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10) d = countryCode + d;
  else if (d.length === 11 && d.startsWith('0')) d = countryCode + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? d : null;
}

export async function openWhatsApp(phone: string, message: string): Promise<boolean> {
  const number = toWhatsAppNumber(phone);
  if (!number) {
    Alert.alert('No valid phone number', 'This resident does not have a valid phone number saved.');
    return false;
  }
  const text = encodeURIComponent(message);
  // First the WhatsApp app itself; if that is not possible, the wa.me link (opens WhatsApp or the browser).
  const urls = [`whatsapp://send?phone=${number}&text=${text}`, `https://wa.me/${number}?text=${text}`];
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // try the next link
    }
  }
  Alert.alert('WhatsApp not available', 'Could not open WhatsApp on this device. Is it installed?');
  return false;
}

/* ------------------------- ready-made messages ------------------------- */

export function rentReminderMessage(p: {
  name: string;
  propertyName: string;
  month: string; // e.g. "October 2026"
  amount: number;
  dueDate?: string; // e.g. "05 Oct 2026"
  overdue?: boolean;
}): string {
  const amount = `₹${Math.round(p.amount).toLocaleString('en-IN')}`;
  return [
    `Hello ${p.name},`,
    '',
    p.overdue
      ? `Your rent of ${amount} for ${p.month} at ${p.propertyName} is overdue${p.dueDate ? ` (due ${p.dueDate})` : ''}.`
      : `This is a friendly reminder that your rent of ${amount} for ${p.month} at ${p.propertyName} is pending${p.dueDate ? ` (due ${p.dueDate})` : ''}.`,
    'Please pay at your earliest convenience and share the payment confirmation here.',
    '',
    'Thank you.',
  ].join('\n');
}

export function rentReceivedMessage(p: {
  name: string;
  propertyName: string;
  month: string;
  amount: number;
  method?: string;
}): string {
  const amount = `₹${Math.round(p.amount).toLocaleString('en-IN')}`;
  return [
    `Hello ${p.name},`,
    '',
    `We have received your rent of ${amount} for ${p.month}${p.method ? ` via ${p.method}` : ''}. Thank you!`,
    `- ${p.propertyName}`,
  ].join('\n');
}

export function complaintStatusMessage(p: {
  name: string;
  propertyName: string;
  category: string;
  description?: string;
  status: 'Open' | 'In Progress' | 'Resolved' | string;
}): string {
  const statusLine =
    p.status === 'Resolved'
      ? 'has been resolved'
      : p.status === 'In Progress'
      ? 'is now in progress, we are working on it'
      : 'has been received and is open';
  return [
    `Hello ${p.name},`,
    '',
    `Your complaint "${p.category}"${p.description ? ` (${p.description})` : ''} ${statusLine}.`,
    p.status === 'Resolved' ? 'Please let us know if the problem continues.' : 'We will keep you updated.',
    '',
    `- ${p.propertyName}`,
  ].join('\n');
}