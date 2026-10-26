// Pure helpers (no React Native imports): turn one property's data into sheets, an .xlsx file and a PDF page.

export type Cell = string | number | null | undefined;
export type Sheet = { name: string; headers: string[]; rows: Cell[][] };
export type PropertyBundle = {
  property: any;
  rooms: any[];
  residents: any[];
  payments: any[];
  guests: any[];
  complaints: any[];
};

const s = (v: any): string => (v === null || v === undefined ? '' : String(v));
const n = (v: any): number => Number(v) || 0;
const yesNo = (v: any) => (v ? 'Yes' : 'No');

/* ───────────────────────── sheets ───────────────────────── */

export function buildSheets(b: PropertyBundle, isGuestActive: (g: any) => boolean): Sheet[] {
  const roomNo = (id: string) => b.rooms.find((r) => r.id === id)?.roomNumber ?? '';
  const residentName = (id: string) => b.residents.find((r) => r.id === id)?.name ?? '';
  const live = b.residents.filter((r) => !r.archived);

  const overview: Sheet = {
    name: 'Overview',
    headers: ['Item', 'Value'],
    rows: [
      ['Property', s(b.property.name)],
      ['Address', s(b.property.address)],
      ['Floors', n(b.property.floors)],
      ['Branch manager', s(b.property.branchManager)],
      ['Contact phone', s(b.property.contactPhone)],
      ['Standard rent', n(b.property.standardRent)],
      ['UPI id', s(b.property.upiId)],
      ['Total rooms', b.rooms.length],
      ['Total beds', b.rooms.reduce((t, r) => t + n(r.capacity), 0)],
      ['Active residents', live.length],
      ['Archived residents', b.residents.length - live.length],
      ['Day guests (all time)', b.guests.length],
      ['Rent records', b.payments.length],
      ['Rent collected (paid records)', b.payments.filter((p) => p.status === 'Paid').reduce((t, p) => t + n(p.amount), 0)],
      [
        'Rent pending (unpaid records, after deductions)',
        b.payments.filter((p) => p.status !== 'Paid').reduce((t, p) => t + Math.max(0, n(p.amount) - n(p.deduction)), 0),
      ],
      ['Complaints (total)', b.complaints.length],
      ['Complaints open / in progress', b.complaints.filter((c) => c.status !== 'Resolved').length],
      ['Report generated', new Date().toLocaleString('en-GB')],
    ],
  };

  const rooms: Sheet = {
    name: 'Rooms',
    headers: ['Room', 'Floor', 'Beds', 'Residents', 'Active day guests', 'Vacant beds'],
    rows: [...b.rooms]
      .sort((a, c) => n(a.floor) - n(c.floor) || s(a.roomNumber).localeCompare(s(c.roomNumber), undefined, { numeric: true }))
      .map((r) => {
        const res = live.filter((x) => x.roomId === r.id).length;
        const gst = b.guests.filter((g) => g.roomId === r.id && isGuestActive(g)).length;
        return [s(r.roomNumber), n(r.floor), n(r.capacity), res, gst, Math.max(0, n(r.capacity) - res - gst)];
      }),
  };

  const residents: Sheet = {
    name: 'Residents',
    headers: [
      'Name', 'Phone', 'Email', 'Gender', 'Room', 'Bed', 'Joining date', 'Monthly rent', 'Rent due day',
      'Rent status', 'Security deposit', 'Vacating date', 'Vacate reason', 'Pre-booked', 'Archived', 'Archived on',
    ],
    rows: [...b.residents]
      .sort((a, c) => s(a.name).localeCompare(s(c.name)))
      .map((r) => [
        s(r.name), s(r.phone), s(r.email), s(r.gender), roomNo(r.roomId), s(r.bedNumber), s(r.joiningDate),
        n(r.monthlyRent), n(r.rentDueDay), s(r.rentStatus), n(r.securityDeposit), s(r.vacatingDate),
        s(r.vacateReason), yesNo(r.isPreBooking), yesNo(r.archived), s(r.archivedOn),
      ]),
  };

  const rent: Sheet = {
    name: 'Rent',
    headers: ['Resident', 'Room', 'Month', 'Rent', 'Deduction', 'Deduction reason', 'Amount payable', 'Due date', 'Paid on', 'Status', 'Method', 'Transaction id'],
    rows: [...b.payments]
      .sort((a, c) => n(c.createdAt) - n(a.createdAt))
      .map((p) => {
        const res = b.residents.find((r) => r.id === p.residentId);
        const ded = n(p.deduction);
        return [
          s(res?.name ?? residentName(p.residentId)), roomNo(res?.roomId), s(p.month), n(p.amount), ded,
          s(p.deductionReason), p.status === 'Paid' ? n(p.amount) : Math.max(0, n(p.amount) - ded),
          s(p.dueDate), s(p.paidOn), s(p.status), s(p.method), s(p.transactionId),
        ];
      }),
  };

  const guests: Sheet = {
    name: 'Day Guests',
    headers: [
      'Name', 'Phone', 'Gender', 'Room', 'Check-in', 'Vacating', 'Days', 'Total amount', 'Paid',
      'Balance', 'Payment status', 'Method', 'Security deposit', 'Checked out',
    ],
    rows: [...b.guests]
      .sort((a, c) => n(c.createdAt) - n(a.createdAt))
      .map((g) => [
        s(g.name), s(g.phone), s(g.gender), roomNo(g.roomId), s(g.checkInDate), s(g.vacatingDate), n(g.numDays),
        n(g.totalAmount), n(g.advanceAmount), Math.max(0, n(g.totalAmount) - n(g.advanceAmount)),
        s(g.paymentStatus), s(g.paymentMethod), n(g.securityDeposit), yesNo(g.checkedOut),
      ]),
  };

  const complaints: Sheet = {
    name: 'Complaints',
    headers: ['Resident', 'Room', 'Category', 'Description', 'Raised on', 'Status', 'In progress on', 'Resolved on'],
    rows: [...b.complaints]
      .sort((a, c) => n(c.createdAt) - n(a.createdAt))
      .map((c) => [s(c.residentName), s(c.room), s(c.category), s(c.description), s(c.date), s(c.status), s(c.inProgressOn), s(c.resolvedOn)]),
  };

  return [overview, rooms, residents, rent, guests, complaints];
}

/* ───────────────────────── PDF ───────────────────────── */

const esc = (v: any) =>
  s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildPdfHtml(propertyName: string, sheets: Sheet[]): string {
  const [overview, ...rest] = sheets;
  const kpis = overview.rows
    .map((r) => `<tr><td class="k">${esc(r[0])}</td><td>${esc(typeof r[1] === 'number' && /rent|amount/i.test(s(r[0])) ? '₹' + Math.round(r[1] as number).toLocaleString('en-IN') : r[1])}</td></tr>`)
    .join('');
  const tables = rest
    .map((sh) => {
      const head = sh.headers.map((h) => `<th>${esc(h)}</th>`).join('');
      const body = sh.rows.length
        ? sh.rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${sh.headers.length}" class="empty">No records</td></tr>`;
      return `<h2>${esc(sh.name)} <span>(${sh.rows.length})</span></h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:18px;font-size:10px}
    h1{font-size:20px;margin:0 0 2px} .sub{color:#666;margin-bottom:12px}
    h2{font-size:13px;margin:18px 0 6px;color:#1d4ed8} h2 span{color:#888;font-weight:normal}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}
    th{background:#1d4ed8;color:#fff;text-align:left;padding:5px;font-size:9px}
    td{border-bottom:1px solid #e5e7eb;padding:4px 5px;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc} td.k{font-weight:bold;width:38%} td.empty{text-align:center;color:#888;padding:10px}
  </style></head><body>
    <h1>${esc(propertyName)}</h1><div class="sub">Complete property data report</div>
    <h2>Overview</h2><table><tbody>${kpis}</tbody></table>
    ${tables}
  </body></html>`;
}

/* ───────────────────────── .xlsx (no library) ───────────────────────── */

function utf8(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

let CRC_TABLE: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// A ZIP container with no compression ("stored"), which every .xlsx reader accepts.
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => [v & 255, (v >> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];

  files.forEach((f) => {
    const name = utf8(f.name);
    const crc = crc32(f.data);
    const local = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0),
    ]);
    parts.push(local, name, f.data);
    central.push(
      Uint8Array.from([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
        ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ]),
      name
    );
    offset += local.length + name.length + f.data.length;
  });

  const centralSize = central.reduce((t, c) => t + c.length, 0);
  const end = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((t, p) => t + p.length, 0));
  let pos = 0;
  all.forEach((p) => {
    out.set(p, pos);
    pos += p.length;
  });
  return out;
}

const xml = (v: any) =>
  s(v)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function colName(i: number): string {
  let name = '';
  let x = i + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    name = String.fromCharCode(65 + m) + name;
    x = Math.floor((x - 1) / 26);
  }
  return name;
}

const safeSheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';

function sheetXml(sh: Sheet): string {
  const widths = sh.headers.map((h, c) =>
    Math.min(60, Math.max(h.length, ...sh.rows.map((r) => s(r[c]).length), 6) + 2)
  );
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const cell = (v: Cell, r: number, c: number, bold: boolean) => {
    const ref = `${colName(c)}${r}`;
    const style = bold ? ' s="1"' : '';
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
    if (v === null || v === undefined || v === '') return `<c r="${ref}"${style}/>`;
    return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  const rowsXml = [
    `<row r="1">${sh.headers.map((h, c) => cell(h, 1, c, true)).join('')}</row>`,
    ...sh.rows.map((row, i) => `<row r="${i + 2}">${sh.headers.map((_, c) => cell(row[c], i + 2, c, false)).join('')}</row>`),
  ].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const names = sheets.map((sh) => safeSheetName(sh.name));
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  const contentTypes =
    head +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '</Types>';

  const rootRels =
    head +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

  const workbook =
    head +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names.map((nm, i) => `<sheet name="${xml(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';

  const wbRels =
    head +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>';

  const styles =
    head +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const files = [
    { name: '[Content_Types].xml', data: utf8(contentTypes) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'xl/workbook.xml', data: utf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(wbRels) },
    { name: 'xl/styles.xml', data: utf8(styles) },
    ...sheets.map((sh, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(sheetXml(sh)) })),
  ];
  return zipStore(files);
}