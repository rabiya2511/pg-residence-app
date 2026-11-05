// The same charts as ChartCard, as an HTML/SVG string for the PDF exports.
import { ChartSpec, CHART_COLORS, fmtCompact, fmtFull, shortLabel } from './chartSpec';

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const W = 560;
const H = 190;
const PT = 22;
const PB = 26;
const PX = 8;

function bar(spec: ChartSpec): string {
  const n = spec.data.length;
  const max = Math.max(1, ...spec.data.map((d) => d.value));
  const plotH = H - PT - PB;
  const slot = (W - PX * 2) / Math.max(1, n);
  const bw = Math.min(40, slot * 0.6);
  const bars = spec.data
    .map((d, i) => {
      const h = d.value > 0 ? Math.max(3, (d.value / max) * plotH) : 0;
      const x = PX + slot * i + (slot - bw) / 2;
      const y = H - PB - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${d.color ?? CHART_COLORS[0]}"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="10" fill="#6b7280" text-anchor="middle">${esc(fmtCompact(d.value, spec.money, spec.percent))}</text>
        <text x="${(x + bw / 2).toFixed(1)}" y="${H - 9}" font-size="10" fill="#6b7280" text-anchor="middle">${esc(shortLabel(d.label, slot < 50 ? 5 : 10))}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${PX}" x2="${W - PX}" y1="${H - PB}" y2="${H - PB}" stroke="#e5e7eb"/>${bars}</svg>`;
}

function line(spec: ChartSpec): string {
  const n = spec.data.length;
  const top = spec.percent ? 100 : Math.max(1, ...spec.data.map((d) => d.value)) * 1.15;
  const plotH = H - PT - PB;
  const slot = (W - PX * 2) / Math.max(1, n);
  const pts = spec.data.map((d, i) => ({ x: PX + slot * i + slot / 2, y: PT + plotH * (1 - Math.min(top, d.value) / top), d }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1]
    .map((f) => `<line x1="${PX}" x2="${W - PX}" y1="${PT + plotH * f}" y2="${PT + plotH * f}" stroke="#e5e7eb" ${f === 1 ? '' : 'stroke-dasharray="4,4"'}/>`)
    .join('');
  const dots = pts
    .map(
      (p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${CHART_COLORS[0]}"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" font-size="10" fill="#6b7280" text-anchor="middle">${esc(fmtCompact(p.d.value, spec.money, spec.percent))}</text>
        <text x="${p.x.toFixed(1)}" y="${H - 9}" font-size="10" fill="#6b7280" text-anchor="middle">${esc(shortLabel(p.d.label, slot < 50 ? 5 : 10))}</text>`
    )
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${grid}${pts.length > 1 ? `<path d="${path}" stroke="${CHART_COLORS[0]}" stroke-width="2.5" fill="none"/>` : ''}${dots}</svg>`;
}

function donut(spec: ChartSpec): string {
  const total = spec.data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const size = 150;
  const stroke = 28;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  const segs = spec.data
    .map((d, i) => {
      const len = total > 0 ? (Math.max(0, d.value) / total) * c : 0;
      const s = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${d.color ?? CHART_COLORS[i % CHART_COLORS.length]}" stroke-width="${stroke}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
      off += len;
      return s;
    })
    .join('');
  const legend = spec.data
    .map(
      (d, i) => `<tr><td style="padding:3px 6px 3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${d.color ?? CHART_COLORS[i % CHART_COLORS.length]}"></span></td>
        <td style="padding:3px 10px 3px 0">${esc(d.label)}</td><td style="padding:3px 0;color:#6b7280">${esc(fmtFull(d.value, spec.money))}${total > 0 ? ` · ${Math.round((d.value / total) * 100)}%` : ''}</td></tr>`
    )
    .join('');
  return `<table style="width:100%"><tr><td style="width:${size + 10}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}"/>${segs}
    <text x="${size / 2}" y="${size / 2 + 5}" font-size="16" font-weight="bold" text-anchor="middle" fill="#111827">${esc(fmtCompact(total, spec.money))}</text></svg>
    </td><td><table style="font-size:11px">${legend}</table></td></tr></table>`;
}

/** One chart as a bordered block. Two charts per row in the PDF. */
export function chartToHtml(spec: ChartSpec): string {
  const empty = spec.data.length === 0 || spec.data.every((d) => !d.value);
  const body = empty ? '<div style="color:#6b7280;padding:24px 0;text-align:center">Nothing to chart yet.</div>' : spec.kind === 'bar' ? bar(spec) : spec.kind === 'line' ? line(spec) : donut(spec);
  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:12px;page-break-inside:avoid">
    <div style="font-weight:700;font-size:12px">${esc(spec.title)}</div>
    ${spec.subtitle ? `<div style="color:#6b7280;font-size:10px;margin-bottom:4px">${esc(spec.subtitle)}</div>` : ''}
    ${body}</div>`;
}
