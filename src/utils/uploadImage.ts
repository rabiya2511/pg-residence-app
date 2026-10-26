import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Firestore documents are limited to 1 MB. identityDocuments holds a front and a back photo,
// so each picture is kept well under 500 KB of text.
const MAX_CHARS = 350_000;

// "Uploads" an image by shrinking it and returning it as a data link that is stored in Firestore.
// The path decides how large the picture may be: ID documents need to stay readable,
// profile photos can be small.
export async function uploadImage(localUri: string, path: string): Promise<string> {
  // Already a web link or an already-shrunk picture: nothing to do.
  if (/^(https?:|data:)/.test(localUri)) return localUri;

  const isId = path.startsWith('identity/');
  const widths = isId ? [1000, 800, 640, 480] : [400, 300, 200];

  try {
    for (const width of widths) {
      const out = await manipulateAsync(localUri, [{ resize: { width } }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (out.base64 && out.base64.length <= MAX_CHARS) {
        return `data:image/jpeg;base64,${out.base64}`;
      }
    }
    throw new Error('image-too-large');
  } catch (e: any) {
    console.warn('uploadImage failed:', e?.code, e?.message, 'path:', path);
    throw e;
  }
}