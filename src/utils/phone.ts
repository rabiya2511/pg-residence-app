// One place that understands phone numbers: parsing, validating, storing and WhatsApp.
//
// Numbers are STORED in international format, e.g. "+919876543210".
// Older numbers saved as "9876543210", "98765 43210" or "+91 98765 43210" are never rewritten
// in the database by this file; they are read and understood here, and converted to the
// international format only when the admin edits and saves that person again.

export type Country = {
  iso: string;
  name: string;
  dial: string; // country calling code without "+"
  lengths: number[]; // allowed lengths of the number WITHOUT the country code
  mobile: RegExp; // what a mobile number looks like (without the country code)
  hint: string; // shown to the admin
  example: string;
};

export const COUNTRIES: Country[] = [
  { iso: 'IN', name: 'India', dial: '91', lengths: [10], mobile: /^[6-9]\d{9}$/, hint: '10 digits, starts with 6, 7, 8 or 9', example: '98765 43210' },
  { iso: 'US', name: 'USA / Canada', dial: '1', lengths: [10], mobile: /^[2-9]\d{9}$/, hint: '10 digits', example: '415 555 0123' },
  { iso: 'GB', name: 'United Kingdom', dial: '44', lengths: [10], mobile: /^7\d{9}$/, hint: '10 digits, starts with 7', example: '7123 456789' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', lengths: [9], mobile: /^5\d{8}$/, hint: '9 digits, starts with 5', example: '50 123 4567' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', lengths: [9], mobile: /^5\d{8}$/, hint: '9 digits, starts with 5', example: '51 234 5678' },
  { iso: 'QA', name: 'Qatar', dial: '974', lengths: [8], mobile: /^[3567]\d{7}$/, hint: '8 digits', example: '3123 4567' },
  { iso: 'KW', name: 'Kuwait', dial: '965', lengths: [8], mobile: /^[569]\d{7}$/, hint: '8 digits', example: '5123 4567' },
  { iso: 'OM', name: 'Oman', dial: '968', lengths: [8], mobile: /^[79]\d{7}$/, hint: '8 digits', example: '9123 4567' },
  { iso: 'BH', name: 'Bahrain', dial: '973', lengths: [8], mobile: /^[36]\d{7}$/, hint: '8 digits', example: '3123 4567' },
  { iso: 'SG', name: 'Singapore', dial: '65', lengths: [8], mobile: /^[89]\d{7}$/, hint: '8 digits, starts with 8 or 9', example: '8123 4567' },
  { iso: 'MY', name: 'Malaysia', dial: '60', lengths: [9, 10], mobile: /^1\d{8,9}$/, hint: '9 or 10 digits, starts with 1', example: '12 345 6789' },
  { iso: 'AU', name: 'Australia', dial: '61', lengths: [9], mobile: /^4\d{8}$/, hint: '9 digits, starts with 4', example: '412 345 678' },
  { iso: 'NP', name: 'Nepal', dial: '977', lengths: [10], mobile: /^9[78]\d{8}$/, hint: '10 digits, starts with 97 or 98', example: '98 1234 5678' },
  { iso: 'BD', name: 'Bangladesh', dial: '880', lengths: [10], mobile: /^1[3-9]\d{8}$/, hint: '10 digits, starts with 1', example: '1712 345678' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94', lengths: [9], mobile: /^7\d{8}$/, hint: '9 digits, starts with 7', example: '71 234 5678' },
  { iso: 'PK', name: 'Pakistan', dial: '92', lengths: [10], mobile: /^3\d{9}$/, hint: '10 digits, starts with 3', example: '300 1234567' },
];

export const DEFAULT_DIAL = '91'; // India: used for older numbers saved without a country code

export const findCountry = (dial: string): Country | undefined => COUNTRIES.find((c) => c.dial === dial);

// "919876543210" -> India. Tries 3, 2, then 1 digit country codes.
function matchByPrefix(digits: string): Country | undefined {
  for (const len of [3, 2, 1]) {
    const c = findCountry(digits.slice(0, len));
    if (c) return c;
  }
  return undefined;
}

export type PhoneFailure = {
  ok: false;
  reason: 'empty' | 'short' | 'no_code' | 'unsupported' | 'invalid';
  message: string;
};
export type PhoneSuccess = {
  ok: true;
  e164: string; // "+919876543210"
  dial: string; // "91"
  national: string; // "9876543210"
  country: Country;
};
export type PhoneResult = PhoneSuccess | PhoneFailure;

const fail = (reason: PhoneFailure['reason'], message: string): PhoneFailure => ({ ok: false, reason, message });

function checkNational(c: Country, nationalRaw: string): PhoneResult {
  let national = nationalRaw;
  // A leading 0 is how many countries write the number locally ("07123..."): drop it.
  const longest = Math.max(...c.lengths);
  if (national.length === longest + 1 && national.startsWith('0')) national = national.slice(1);

  if (!c.lengths.includes(national.length)) {
    const need = c.lengths.join(' or ');
    return fail('invalid', `A ${c.name} number must have ${need} digits after +${c.dial}. You entered ${national.length}.`);
  }
  if (!c.mobile.test(national)) {
    return fail('invalid', `This does not look like a valid ${c.name} mobile number (${c.hint}).`);
  }
  return { ok: true, e164: `+${c.dial}${national}`, dial: c.dial, national, country: c };
}

// Understands: "98765 43210", "+91 98765-43210", "919876543210", "09876543210", "0091 9876543210".
export function parsePhone(raw: string | null | undefined): PhoneResult {
  const text = (raw ?? '').trim();
  if (!text) return fail('empty', 'Please enter a phone number.');

  let hasPlus = text.startsWith('+');
  let digits = text.replace(/\D/g, '');
  if (!hasPlus && digits.startsWith('00')) {
    hasPlus = true; // 0091... is the same as +91...
    digits = digits.slice(2);
  }
  if (!digits) return fail('invalid', 'The phone number can only contain digits.');

  // Written WITH a country code.
  if (hasPlus) {
    const country = matchByPrefix(digits);
    if (!country) {
      return fail(
        'unsupported',
        `The country code +${digits.slice(0, 3)} is not supported yet. Supported: ${COUNTRIES.map((c) => `+${c.dial}`).join(', ')}.`
      );
    }
    return checkNational(country, digits.slice(country.dial.length));
  }

  // Written WITHOUT "+": too short to be a mobile number (e.g. 100, 108, 112).
  if (digits.length <= 6) {
    return fail('short', 'This number is too short for a mobile number. Emergency and short codes cannot be used on WhatsApp.');
  }

  // Older numbers saved without a country code are treated as the default country (India).
  const def = findCountry(DEFAULT_DIAL)!;
  const defLen = Math.max(...def.lengths);
  if (digits.length === defLen) return checkNational(def, digits);
  if (digits.length === defLen + 1 && digits.startsWith('0')) return checkNational(def, digits.slice(1));
  if (digits.startsWith(def.dial) && digits.length === def.dial.length + defLen) {
    return checkNational(def, digits.slice(def.dial.length));
  }

  return fail('no_code', 'The country code is missing. Add it with a +, for example +91 98765 43210.');
}

/** "+919876543210" -> "+91 98765 43210". Anything it cannot read is returned unchanged. */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const r = parsePhone(raw);
  if (!r.ok) return (raw ?? '').trim();
  if (r.dial === '91') return `+91 ${r.national.slice(0, 5)} ${r.national.slice(5)}`;
  return `+${r.dial} ${r.national}`;
}

/** The value to save: international format when readable, otherwise exactly what was typed. */
export function normalizePhone(raw: string | null | undefined): string {
  const r = parsePhone(raw);
  return r.ok ? r.e164 : (raw ?? '').trim();
}

/** Used by forms: returns an error message, or null when the number is fine. */
export function validatePhone(
  raw: string | null | undefined,
  opts: { required?: boolean; label?: string } = {}
): string | null {
  const { required = true, label = 'phone number' } = opts;
  if (!raw || !raw.trim()) return required ? `Please enter the ${label}.` : null;
  const r = parsePhone(raw);
  return r.ok ? null : r.message;
}

/** Splits a stored value into the two boxes of the phone field. */
export function splitPhone(value: string | null | undefined): { dial: string; national: string } {
  const r = parsePhone(value);
  if (r.ok) return { dial: r.dial, national: r.national };
  const raw = (value ?? '').trim();
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    const c = matchByPrefix(digits);
    if (c) return { dial: c.dial, national: digits.slice(c.dial.length) };
  }
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return { dial: DEFAULT_DIAL, national: digits };
}

/** The two boxes of the phone field -> the value kept in the form. Empty when no number typed. */
export function buildPhone(dial: string, national: string): string {
  const digits = (national ?? '').replace(/\D/g, '');
  return digits ? `+${dial}${digits}` : '';
}

export type WhatsAppTarget = { ok: true; digits: string } | { ok: false; message: string };

/** Checks a number BEFORE WhatsApp is opened and returns the digits WhatsApp needs, or a clear reason. */
export function whatsappTarget(raw: string | null | undefined): WhatsAppTarget {
  if (!raw || !raw.trim()) return { ok: false, message: 'No phone number is saved for this contact.' };
  const r = parsePhone(raw);
  if (r.ok) return { ok: true, digits: `${r.dial}${r.national}` };
  return { ok: false, message: r.message };
}