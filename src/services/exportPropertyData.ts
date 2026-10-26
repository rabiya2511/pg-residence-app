import { getFirestore, collection, query, where, getDocs } from '@react-native-firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { isDailyGuestActiveNow } from '../context/AdminContext';
import { PropertyBundle, buildSheets, buildPdfHtml, buildXlsx } from './propertyExportBuilders';

// Reads EVERYTHING that belongs to ONE property straight from the database.
// Every query is limited to this property's id, so no other property's data can end up in the file.
export async function loadPropertyBundle(property: any): Promise<PropertyBundle> {
  const db = getFirestore();
  const forProperty = (name: string) =>
    getDocs(query(collection(db, name), where('propertyId', '==', property.id))).then((snap: any) =>
      snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))
    );

  const [rooms, residents, payments, guests, complaints] = await Promise.all([
    forProperty('rooms'),
    forProperty('residents'),
    forProperty('payments'),
    forProperty('dailyGuests'),
    forProperty('complaints'),
  ]);
  return { property, rooms, residents, payments, guests, complaints };
}

const stamp = () => new Date().toISOString().slice(0, 10);
const safeName = (name: string) => (name || 'Property').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Property';

export async function exportPropertyPdf(property: any): Promise<void> {
  const bundle = await loadPropertyBundle(property);
  const sheets = buildSheets(bundle, isDailyGuestActiveNow);
  // Landscape A4 so the wide tables fit.
  const { uri } = await Print.printToFileAsync({
    html: buildPdfHtml(property.name || 'Property', sheets),
    width: 842,
    height: 595,
    base64: false,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${property.name} data (PDF)`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error(`Sharing is not available. The PDF is at ${uri}`);
  }
}

export async function exportPropertyExcel(property: any): Promise<void> {
  const bundle = await loadPropertyBundle(property);
  const sheets = buildSheets(bundle, isDailyGuestActiveNow);
  const bytes = buildXlsx(sheets);

  const file = new File(Paths.cache, `${safeName(property.name)}_data_${stamp()}_${Date.now()}.xlsx`);
  file.create();
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `${property.name} data (Excel)`,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  } else {
    throw new Error(`Sharing is not available. The file is at ${file.uri}`);
  }
}