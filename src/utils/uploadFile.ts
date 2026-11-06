import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Firebase Storage is not available on the free plan, so files are kept inside the Firestore
// document as a data link. A Firestore document may hold 1 MB, and base64 adds about a third,
// so a PDF must be about 650 KB or smaller. Photos are shrunk automatically.
export const MAX_FILE_BYTES = 650 * 1024;
const MAX_IMAGE_CHARS = 880_000;

export async function uploadFile(uri: string, _path: string, contentType?: string): Promise<string> {
  if (/^(https?:|data:)/.test(uri)) return uri;

  const isPdf = (contentType ?? '').includes('pdf') || /\.pdf($|\?)/i.test(uri);

  if (isPdf) {
    const info: any = await FileSystem.getInfoAsync(uri);
    if (info?.size && info.size > MAX_FILE_BYTES) throw { code: 'file-too-large' };
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    if (b64.length > Math.ceil((MAX_FILE_BYTES * 4) / 3) + 100) throw { code: 'file-too-large' };
    return `data:application/pdf;base64,${b64}`;
  }

  for (const width of [1600, 1200, 900, 700, 500]) {
    const out = await manipulateAsync(uri, [{ resize: { width } }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (out.base64 && out.base64.length <= MAX_IMAGE_CHARS) return `data:image/jpeg;base64,${out.base64}`;
  }
  throw { code: 'file-too-large' };
}

// Nothing is stored outside Firestore any more, so there is no separate file to remove.
export async function deleteFile(_path: string): Promise<void> {}
