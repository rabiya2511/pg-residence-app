// Entry pass for an approved visitor. The code is derived from the request id, so nothing extra
// is stored in Firestore: the resident's QR and the admin's lookup always agree.
export const passCodeOf = (id: string): string => (id || '').slice(0, 6).toUpperCase();

// What the QR contains. A scanner (or the admin typing the code) only needs the short code.
export const passPayload = (id: string): string => `PGPASS:${passCodeOf(id)}:${id}`;