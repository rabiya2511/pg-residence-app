import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif',
};

// Uploads a local image/file and returns a link that works on any device.
export async function uploadImage(localUri: string, path: string): Promise<string> {
  // Work out the type from the storage path first, then from the local file name.
  const ext = (path.split('.').pop() ?? localUri.split('?')[0].split('.').pop() ?? '').toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? 'image/jpeg';

  try {
    const storageRef = ref(getStorage(), path);
    await putFile(storageRef, localUri, { contentType });
    return await getDownloadURL(storageRef);
  } catch (e: any) {
    // e.code is usually 'storage/unauthorized', 'storage/object-not-found' or 'storage/unknown'
    console.warn('uploadImage failed:', e?.code, e?.message, 'path:', path);
    throw e;
  }
}