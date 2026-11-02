// Builds the "Final Settlement Statement" as an HTML page. expo-print turns it into a PDF.

const esc = (v: any): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[c];
  });

const inr = (n: any): string => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export type StatementInput = {
  propertyName: string;
  residentName: string;
  phone?: string | null;
  roomNumber: string;
  joiningDate?: string | null;
  noticeSubmittedOn?: string | null;
  expectedCheckout?: string | null;
  reason?: string | null;
  settlement: any; // the exitSettlement object saved on the resident record
};

function row(label: string, value: string, opts: { minus?: boolean; bold?: boolean; plus?: boolean } = {}): string {
  const sign = opts.minus ? '− ' : opts.plus ? '+ ' : '';
  return `<tr class="${opts.bold ? 'bold' : ''}"><td>${esc(label)}</td><td class="num">${sign}${esc(value)}</td></tr>`;
}

export function buildStatementHtml(input: StatementInput): string {
  const s = input.settlement ?? {};
  const rentItems: { month: string; amount: number }[] = Array.isArray(s.pendingRentItems) ? s.pendingRentItems : [];

  const lines: string[] = [];
  lines.push(row('Security deposit held', inr(s.deposit)));
  if (Number(s.advanceCredit) > 0) lines.push(row('Advance balance returned', inr(s.advanceCredit), { plus: true }));
  if (Number(s.emergencyDeduction) > 0) {
    lines.push(row(`Emergency vacate deduction (${esc(s.emergencyPercent)}%)`, inr(s.emergencyDeduction), { minus: true }));
  }
  if (Number(s.pendingRent) > 0) {
    lines.push(row('Pending rent', inr(s.pendingRent), { minus: true }));
    rentItems.forEach((i) => lines.push(`<tr class="sub"><td>&nbsp;&nbsp;${esc(i.month)}</td><td class="num">${esc(inr(i.amount))}</td></tr>`));
  }
  if (Number(s.pendingMaintenance) > 0) lines.push(row('Pending maintenance', inr(s.pendingMaintenance), { minus: true }));
  if (Number(s.additionalDeductions) > 0) {
    lines.push(row(`Other deductions${s.additionalNote ? ` (${s.additionalNote})` : ''}`, inr(s.additionalDeductions), { minus: true }));
  }
  lines.push(row('Total deductions', inr(s.totalDeductions), { bold: true }));

  const owes = Number(s.amountOwed) > 0;
  const finalLabel = owes ? 'Amount owed by resident' : 'Refundable amount';
  const finalValue = owes ? inr(s.amountOwed) : inr(s.refund);

  const payment: string[] = [];
  if (s.status === 'Refunded' && s.refundPaidOn) {
    payment.push(
      `Refund paid on ${esc(s.refundPaidOn)} by ${esc(s.refundMethod ?? '—')}${s.refundReference ? ` (Ref: ${esc(s.refundReference)})` : ''}.`
    );
  }
  if (s.status === 'Dues Received' && s.duesReceivedOn) {
    payment.push(
      `Dues received on ${esc(s.duesReceivedOn)} by ${esc(s.duesMethod ?? '—')}${s.duesReference ? ` (Ref: ${esc(s.duesReference)})` : ''}.`
    );
  }

  const tick = (v: any) => (v ? '✔' : '✘');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 28px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 2px 0; }
  .sub-title { color: #6B7280; margin-bottom: 18px; }
  .box { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
  .grid { width: 100%; }
  .grid td { padding: 3px 0; vertical-align: top; }
  .grid td:first-child { color: #6B7280; width: 42%; }
  table.lines { width: 100%; border-collapse: collapse; }
  table.lines td { padding: 6px 0; border-bottom: 1px solid #F3F4F6; }
  table.lines tr.sub td { color: #6B7280; font-size: 12px; padding: 2px 0; border-bottom: none; }
  td.num { text-align: right; white-space: nowrap; }
  tr.bold td { font-weight: 700; }
  .final { display: flex; justify-content: space-between; margin-top: 10px; padding: 12px 14px; border-radius: 8px;
           background: ${owes ? '#FEE2E2' : '#D1FAE5'}; font-size: 16px; font-weight: 700; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #F3F4F6; font-weight: 700; font-size: 12px; }
  .foot { color: #9CA3AF; font-size: 11px; margin-top: 18px; text-align: center; }
  h2 { font-size: 14px; margin: 0 0 8px 0; }
</style>
</head>
<body>
  <h1>Final Settlement Statement</h1>
  <div class="sub-title">${esc(input.propertyName)}</div>

  <div class="box">
    <table class="grid">
      <tr><td>Resident</td><td><b>${esc(input.residentName)}</b></td></tr>
      ${input.phone ? `<tr><td>Phone</td><td>${esc(input.phone)}</td></tr>` : ''}
      <tr><td>Room</td><td>${esc(input.roomNumber)}</td></tr>
      ${input.joiningDate ? `<tr><td>Joined on</td><td>${esc(input.joiningDate)}</td></tr>` : ''}
      ${input.noticeSubmittedOn ? `<tr><td>Notice submitted</td><td>${esc(input.noticeSubmittedOn)}</td></tr>` : ''}
      ${input.expectedCheckout ? `<tr><td>Expected checkout</td><td>${esc(input.expectedCheckout)}</td></tr>` : ''}
      ${
        s.noticeDays !== null && s.noticeDays !== undefined
          ? `<tr><td>Notice period given</td><td>${esc(s.noticeDays)} of ${esc(s.requiredNoticeDays ?? 30)} days</td></tr>`
          : ''
      }
      ${input.reason ? `<tr><td>Reason for leaving</td><td>${esc(input.reason)}</td></tr>` : ''}
      <tr><td>Checked out on</td><td><b>${esc(s.completedOn ?? '—')}</b></td></tr>
    </table>
  </div>

  <div class="box">
    <h2>Settlement</h2>
    <table class="lines">${lines.join('')}</table>
    <div class="final"><span>${esc(finalLabel)}</span><span>${esc(finalValue)}</span></div>
    <p>Status: <span class="status">${esc(s.status ?? 'Settled')}</span></p>
    ${payment.map((p) => `<p>${p}</p>`).join('')}
  </div>

  <div class="box">
    <h2>Checkout clearance</h2>
    <table class="grid">
      <tr><td>Room inspection completed</td><td>${tick(s.roomInspection)}</td></tr>
      <tr><td>Keys and belongings returned</td><td>${tick(s.keysReturned)}</td></tr>
      <tr><td>Pending dues reviewed</td><td>${tick(s.duesReviewed)}</td></tr>
    </table>
  </div>

  <div class="foot">Generated on ${esc(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))}. This is a system-generated statement.</div>
</body>
</html>`;
}