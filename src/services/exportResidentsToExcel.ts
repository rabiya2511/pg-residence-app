import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// expo-file-system changed its API between Expo versions, so it is used through
// `any` here and both the new (File / Paths) and the older (writeAsStringAsync)
// styles are supported.
const fs: any = FileSystem;

type ExportInput = {
  /** The residents to export (pass the same list the screen is showing). */
  residents: any[];
  rooms: any[];
  properties: any[];
  identityDocuments?: any[];
  /** Used in the file name and sheet, e.g. "Active" or "Archived". */
  label: string;
};

export type ExportResult = 'saved' | 'shared' | 'cancelled';

function buildWorkbook({ residents, rooms, properties, identityDocuments = [], label }: ExportInput) {
  const roomOf = (id: string) => rooms.find((r) => r.id === id);
  const propertyOf = (id: string) => properties.find((p) => p.id === id)?.name ?? '';
  const kycOf = (id: string) => {
    const d = identityDocuments.find((x) => x.residentId === id);
    return d && d.frontUri && d.backUri ? 'Complete' : 'Pending';
  };

  const isArchived = label.toLowerCase() === 'archived';

  const header = [
    'S.No',
    'Name',
    'Phone',
    'Email',
    'Gender',
    'Property',
    'Floor',
    'Room',
    'Joining Date',
    'Monthly Rent (₹)',
    'Security Deposit (₹)',
    'Maintenance (₹)',
    'Rent Due Day',
    'Rent Status',
    'Father / Guardian Name',
    'Father / Guardian Mobile',
    'KYC Status',
    'Vehicle Type',
    'Vehicle Number',
    'Vehicle Model',
    'Vacating Date',
    'Vacate Reason',
    ...(isArchived ? ['Archived On', 'Archived Reason'] : []),
  ];

  const body = residents.map((r, i) => {
    const room = roomOf(r.roomId);
    return [
      i + 1,
      r.name ?? '',
      r.phone ?? '',
      r.email ?? '',
      r.gender ?? '',
      propertyOf(r.propertyId),
      room?.floor ?? '',
      room?.roomNumber ?? '',
      r.joiningDate ?? '',
      r.monthlyRent ?? 0,
      r.securityDeposit ?? 0,
      r.maintenanceFee ?? 0,
      r.rentDueDay ?? '',
      r.rentStatus ?? '',
      r.guardianName ?? '',
      r.guardianPhone ?? '',
      kycOf(r.id),
      r.vehicleType ?? '',
      r.vehicleNumber ?? '',
      r.vehicleModel ?? '',
      r.vacatingDate ?? '',
      r.vacateReason ?? '',
      ...(isArchived ? [r.archivedOn ?? '', r.archivedReason ?? ''] : []),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws['!cols'] = header.map((h) => ({ wch: Math.max(12, String(h).length + 2) }));
  ws['!cols'][1] = { wch: 22 }; // Name
  ws['!cols'][3] = { wch: 28 }; // Email
  ws['!cols'][5] = { wch: 28 }; // Property

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${label} Residents`.slice(0, 31));
  return wb;
}

export async function exportResidentsToExcel(input: ExportInput): Promise<ExportResult> {
  const wb = buildWorkbook(input);
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `Residents_${input.label}_${stamp}`;
  const fileName = `${baseName}.xlsx`;

  const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  // ── Android: let the admin pick a folder (e.g. Downloads) and save the file there ──
  if (Platform.OS === 'android') {
    try {
      // Newer Expo: pick a directory and create the file in it.
      if (fs.Directory?.pickDirectoryAsync) {
        const dir = await fs.Directory.pickDirectoryAsync();
        if (dir) {
          const out = dir.createFile(baseName, MIME);
          out.write(bytes);
          return 'saved';
        }
      }
      // Older Expo: Storage Access Framework.
      else if (fs.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
        const perm = await fs.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perm.granted) return 'cancelled';
        const dest = await fs.StorageAccessFramework.createFileAsync(perm.directoryUri, baseName, MIME);
        await fs.writeAsStringAsync(dest, base64, { encoding: fs.EncodingType?.Base64 ?? 'base64' });
        return 'saved';
      }
    } catch {
      // Folder picking failed or was dismissed — fall through to the share sheet below.
    }
  }

  // ── Everywhere else (and as an Android fallback): write to cache, then open the share sheet ──
  let uri: string;
  if (fs.File && fs.Paths) {
    const file = new fs.File(fs.Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    uri = file.uri;
  } else {
    uri = `${fs.cacheDirectory}${fileName}`;
    await fs.writeAsStringAsync(uri, base64, { encoding: fs.EncodingType?.Base64 ?? 'base64' });
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: MIME, dialogTitle: 'Save resident details', UTI: 'org.openxmlformats.spreadsheetml.sheet' });
    return 'shared';
  }
  throw new Error(`File created at ${uri} but sharing is not available on this device.`);
}