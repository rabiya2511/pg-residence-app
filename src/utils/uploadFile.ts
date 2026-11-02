import { getStorage, ref, putFile, getDownloadURL, deleteObject } from '@react-native-firebase/storage';

// Uploads any local file (PDF or image) as-is and returns its download link.
export async function uploadFile(uri: string, path: string, contentType?: string): Promise<string> {
  const r = ref(getStorage(), path);
  await putFile(r, uri, contentType ? { contentType } : undefined);
  return getDownloadURL(r);
}

// Best effort: a leftover file is harmless, so a failure here is only logged.
export async function deleteFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(getStorage(), path));
  } catch (e: any) {
    console.warn('deleteFile:', e?.code ?? e?.message);
  }
}