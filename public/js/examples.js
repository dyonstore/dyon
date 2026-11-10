/* DYON — country-aware example text for form placeholders (name, amount).
   Pure data + one function; no network. The country is the person's chosen region,
   else the detected one, else a neutral default. */
const NAMES = {
  AE: ['Omar', 'عمر'], BE: ['Luc'], CA: ['Emma'], CH: ['Lukas'], DE: ['Jonas'], DZ: ['Karim', 'كريم'], EG: ['Ahmed', 'أحمد'],
  FR: ['Camille'], GB: ['Oliver'], ID: ['Budi'], IT: ['Giulia'], JO: ['Khaled', 'خالد'], KW: ['Fahad', 'فهد'], LB: ['Rami', 'رامي'],
  LY: ['Salem', 'سالم'], MA: ['Youssef', 'يوسف'], MY: ['Aiman'], NG: ['Chinedu'], PK: ['Ali'], QA: ['Hamad', 'حمد'],
  SA: ['Abdullah', 'عبدالله'], SN: ['Moussa'], TN: ['Sami', 'سامي'], TR: ['Mehmet'], US: ['Emily']
};
/* a typical small loan, in the country's own currency */
const AMOUNTS = {
  AE: [500, 'AED'], BE: [100, 'EUR'], CA: [100, 'CAD'], CH: [100, 'CHF'], DE: [100, 'EUR'], DZ: [20000, 'DZD'], EG: [1000, 'EGP'],
  FR: [100, 'EUR'], GB: [100, 'GBP'], ID: [500000, 'IDR'], IT: [100, 'EUR'], JO: [50, 'JOD'], KW: [30, 'KWD'], LB: [100, 'USD'],
  LY: [500, 'LYD'], MA: [1000, 'MAD'], MY: [200, 'MYR'], NG: [50000, 'NGN'], PK: [20000, 'PKR'], QA: [500, 'QAR'],
  SA: [500, 'SAR'], SN: [50000, 'XOF'], TN: [200, 'TND'], TR: [2000, 'TRY'], US: [100, 'USD']
};
export function exampleFor(country, locale = 'en') {
  const cc = String(country || '').toUpperCase();
  const n = NAMES[cc] || ['Sam'];
  const a = AMOUNTS[cc] || [100, 'USD'];
  return { name: locale === 'ar' && n[1] ? n[1] : n[0], amount: a[0], currency: a[1], amountText: a[0] + ' ' + a[1] };
}
