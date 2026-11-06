import { Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

// Opens a stored document: a web link opens in the browser; a data link (file kept in Firestore)
// is written to a temporary file and handed to the phone's "Open with / Share" sheet.
export async function openStoredFile(url: string, name?: string): Promise<void> {
  try {
    if (/^https?:/.test(url)) {
      await Linking.openURL(url);
      return;
    }
    const comma = url.indexOf(',');
    if (!url.startsWith('data:') || comma < 0) throw new Error('bad-link');
    const mime = url.slice(5, comma).split(';')[0] || 'application/octet-stream';
    const base = (name ?? 'document').replace(/[^\w\-]/g, '_').replace(/_?(pdf|jpe?g|png)$/i, '') || 'document';
    const path = `${FileSystem.cacheDirectory}${base}-${Date.now()}.${EXT[mime] ?? 'bin'}`;
    await FileSystem.writeAsStringAsync(path, url.slice(comma + 1), { encoding: FileSystem.EncodingType.Base64 });
    if (!(await Sharing.isAvailableAsync())) throw new Error('no-share');
    await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: name ?? 'Open document' });
  } catch {
    Alert.alert('Cannot Open', 'No app on this phone can open this file.');
  }
}
