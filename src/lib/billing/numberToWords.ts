// Indian numbering system: lakhs, crores
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + ' Hundred');
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

export function numberToIndianWords(amount: number): string {
  if (!isFinite(amount)) return '';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const parts: string[] = [];
  const rupeesWords = (() => {
    if (rupees === 0) return 'Zero';
    let n = rupees;
    const chunks: string[] = [];
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const hundred = n;
    if (crore) chunks.push(twoDigits(crore) + ' Crore');
    if (lakh) chunks.push(twoDigits(lakh) + ' Lakh');
    if (thousand) chunks.push(twoDigits(thousand) + ' Thousand');
    if (hundred) chunks.push(threeDigits(hundred));
    return chunks.join(' ');
  })();

  parts.push(rupeesWords + ' Rupees');
  if (paise > 0) parts.push('and ' + twoDigits(paise) + ' Paise');
  parts.push('Only');
  return (isNeg ? 'Minus ' : '') + parts.join(' ');
}
