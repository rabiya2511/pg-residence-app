import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';

// Uploads a local image/file and returns a link that works on any device.
export async function uploadImage(localUri: string, path: string): Promise<string> {
  const storageRef = ref(getStorage(), path);
  await putFile(storageRef, localUri);
  return getDownloadURL(storageRef);
}