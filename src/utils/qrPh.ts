import jsQR from 'jsqr';
import QRCode from 'qrcode';

export interface EmvCoTlvEntry {
  tag: string;
  value: string;
}

export interface QrPhInspectionResult {
  decoded: boolean;
  isEmvCoQrPh: boolean;
  crcValid: boolean;
  networkHint: string;
  rawPayload?: string;
}

export interface DynamicQrPhBuildResult {
  qrDataUrl: string;
  isDynamicQrPh: boolean;
  networkHint?: string;
}

const decodedQrCache = new Map<string, string | null>();
const dynamicQrCache = new Map<string, DynamicQrPhBuildResult>();

export function computeEmvCoCrc16(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function parseEmvCoTlv(payload: string): EmvCoTlvEntry[] | null {
  const trimmed = payload.trim();
  if (!trimmed || trimmed.length < 12 || !trimmed.startsWith('000201')) {
    return null;
  }

  const entries: EmvCoTlvEntry[] = [];
  let idx = 0;
  while (idx < trimmed.length) {
    if (idx + 4 > trimmed.length) return null;
    const tag = trimmed.slice(idx, idx + 2);
    const lenStr = trimmed.slice(idx + 2, idx + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) {
      return null;
    }
    const len = Number(lenStr);
    const valueStart = idx + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > trimmed.length) {
      return null;
    }
    entries.push({
      tag,
      value: trimmed.slice(valueStart, valueEnd),
    });
    idx = valueEnd;
  }

  if (entries.length === 0 || entries[0].tag !== '00' || entries[0].value !== '01') {
    return null;
  }

  return entries;
}

export function verifyEmvCoCrc(payload: string): boolean {
  const trimmed = payload.trim();
  if (trimmed.length < 12) return false;
  const crcTagIndex = trimmed.lastIndexOf('6304');
  if (crcTagIndex === -1 || crcTagIndex + 8 !== trimmed.length) {
    return false;
  }
  const providedCrc = trimmed.slice(crcTagIndex + 4).toUpperCase();
  const computed = computeEmvCoCrc16(trimmed.slice(0, crcTagIndex + 4));
  return providedCrc === computed;
}

export function detectQrPhNetworkHint(entries: EmvCoTlvEntry[]): string {
  const combinedAccountInfo = entries
    .filter((e) => {
      const n = Number(e.tag);
      return (n >= 26 && n <= 51) || n === 62;
    })
    .map((e) => e.value.toUpperCase())
    .join(' ');

  if (combinedAccountInfo.includes('GXCHPH') || combinedAccountInfo.includes('GCASH')) {
    return 'GCash / InstaPay QR Ph';
  }
  if (combinedAccountInfo.includes('PAPHPH') || combinedAccountInfo.includes('MAYA')) {
    return 'Maya / InstaPay QR Ph';
  }
  if (
    combinedAccountInfo.includes('PH.PPMI') ||
    combinedAccountInfo.includes('P2PQRPAY') ||
    combinedAccountInfo.includes('QRPH')
  ) {
    return 'InstaPay / QR Ph';
  }
  const country = entries.find((e) => e.tag === '58')?.value.toUpperCase();
  const currency = entries.find((e) => e.tag === '53')?.value;
  if (country === 'PH' || currency === '608') {
    return 'QR Ph (EMVCo)';
  }
  return 'EMVCo QR';
}

export function isEmvCoQrPhPayload(payload: string): boolean {
  const entries = parseEmvCoTlv(payload);
  if (!entries) return false;
  const hasMerchantOrAccountTag = entries.some((e) => {
    const n = Number(e.tag);
    return n >= 26 && n <= 51;
  });
  const country = entries.find((e) => e.tag === '58')?.value.toUpperCase();
  const currency = entries.find((e) => e.tag === '53')?.value;
  return hasMerchantOrAccountTag && (country === 'PH' || currency === '608' || verifyEmvCoCrc(payload));
}

export function injectEmvCoQrAmount(rawPayload: string, amountPhp: number): string | null {
  if (!Number.isFinite(amountPhp) || amountPhp <= 0) return null;
  const entries = parseEmvCoTlv(rawPayload);
  if (!entries) return null;

  const formattedAmount = amountPhp.toFixed(2);
  const filtered = entries.filter((e) => e.tag !== '54' && e.tag !== '63');

  if (!filtered.some((e) => e.tag === '53')) {
    const insertIdx = filtered.findIndex((e) => Number(e.tag) > 53);
    const currencyEntry: EmvCoTlvEntry = { tag: '53', value: '608' };
    if (insertIdx === -1) filtered.push(currencyEntry);
    else filtered.splice(insertIdx, 0, currencyEntry);
  }

  const amountEntry: EmvCoTlvEntry = { tag: '54', value: formattedAmount };
  const afterCurrencyIdx = filtered.findIndex((e) => e.tag === '53');
  if (afterCurrencyIdx !== -1) {
    filtered.splice(afterCurrencyIdx + 1, 0, amountEntry);
  } else {
    const beforeCountryIdx = filtered.findIndex((e) => Number(e.tag) > 54);
    if (beforeCountryIdx === -1) filtered.push(amountEntry);
    else filtered.splice(beforeCountryIdx, 0, amountEntry);
  }

  const body = filtered
    .map((e) => {
      const len = String(e.value.length).padStart(2, '0');
      return `${e.tag}${len}${e.value}`;
    })
    .join('');

  const payloadWithCrcPrefix = `${body}6304`;
  const crc = computeEmvCoCrc16(payloadWithCrcPrefix);
  return `${payloadWithCrcPrefix}${crc}`;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load QR image.'));
    img.src = src;
  });
}

function tryJsQrOnCanvas(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetSize: number,
  highContrast: boolean
): string | null {
  const scale = Math.min(1, targetSize / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  const imageData = ctx.getImageData(0, 0, dw, dh);
  if (highContrast) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const v = lum < 145 ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const decoded = jsQR(imageData.data, dw, dh, {
    inversionAttempts: 'attemptBoth',
  });
  return decoded?.data ? decoded.data.trim() : null;
}

export async function decodeQrFromImageSource(imageSrc: string): Promise<string | null> {
  if (!imageSrc || typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }

  if (decodedQrCache.has(imageSrc)) {
    return decodedQrCache.get(imageSrc) ?? null;
  }

  try {
    const img = await loadHtmlImage(imageSrc);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) {
      decodedQrCache.set(imageSrc, null);
      return null;
    }

    const attempts: Array<() => string | null> = [
      () => tryJsQrOnCanvas(img, 0, 0, w, h, 900, false),
      () => tryJsQrOnCanvas(img, 0, 0, w, h, 640, true),
    ];

    if (h > w * 1.15) {
      // Mobile wallet screenshots (GCash/Maya/Bank) place the QR block in the upper-middle area
      attempts.push(
        () =>
          tryJsQrOnCanvas(
            img,
            Math.round(w * 0.08),
            Math.round(h * 0.12),
            Math.round(w * 0.84),
            Math.round(h * 0.52),
            720,
            false
          ),
        () =>
          tryJsQrOnCanvas(
            img,
            Math.round(w * 0.1),
            Math.round(h * 0.15),
            Math.round(w * 0.8),
            Math.round(h * 0.48),
            640,
            true
          ),
        () =>
          tryJsQrOnCanvas(
            img,
            Math.round(w * 0.05),
            Math.round(h * 0.2),
            Math.round(w * 0.9),
            Math.round(h * 0.58),
            720,
            false
          )
      );
    }

    let found: string | null = null;
    for (const attempt of attempts) {
      found = attempt();
      if (found) break;
    }

    decodedQrCache.set(imageSrc, found);
    return found;
  } catch {
    decodedQrCache.set(imageSrc, null);
    return null;
  }
}

export async function inspectQrPhImage(imageSrc?: string): Promise<QrPhInspectionResult> {
  if (!imageSrc) {
    return {
      decoded: false,
      isEmvCoQrPh: false,
      crcValid: false,
      networkHint: 'No QR uploaded',
    };
  }

  const rawPayload = await decodeQrFromImageSource(imageSrc);
  if (!rawPayload) {
    return {
      decoded: false,
      isEmvCoQrPh: false,
      crcValid: false,
      networkHint: 'Static image QR',
    };
  }

  const entries = parseEmvCoTlv(rawPayload);
  if (!entries || !isEmvCoQrPhPayload(rawPayload)) {
    return {
      decoded: true,
      isEmvCoQrPh: false,
      crcValid: false,
      networkHint: 'Non-EMVCo QR',
      rawPayload,
    };
  }

  return {
    decoded: true,
    isEmvCoQrPh: true,
    crcValid: verifyEmvCoCrc(rawPayload),
    networkHint: detectQrPhNetworkHint(entries),
    rawPayload,
  };
}

export async function buildDynamicQrPhDataUrl(
  qrImageUrl: string | undefined,
  exactAmountPhp: number
): Promise<DynamicQrPhBuildResult> {
  if (!qrImageUrl) {
    return { qrDataUrl: '', isDynamicQrPh: false };
  }

  const roundedAmount = Math.round(exactAmountPhp * 100) / 100;
  const cacheKey = `${qrImageUrl.slice(0, 120)}::${qrImageUrl.length}::${roundedAmount.toFixed(2)}`;
  const cached = dynamicQrCache.get(cacheKey);
  if (cached) return cached;

  const inspection = await inspectQrPhImage(qrImageUrl);
  if (!inspection.isEmvCoQrPh || !inspection.rawPayload || !Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    const fallback: DynamicQrPhBuildResult = {
      qrDataUrl: qrImageUrl,
      isDynamicQrPh: false,
      networkHint: inspection.networkHint,
    };
    dynamicQrCache.set(cacheKey, fallback);
    return fallback;
  }

  const dynamicPayload = injectEmvCoQrAmount(inspection.rawPayload, roundedAmount);
  if (!dynamicPayload) {
    const fallback: DynamicQrPhBuildResult = {
      qrDataUrl: qrImageUrl,
      isDynamicQrPh: false,
      networkHint: inspection.networkHint,
    };
    dynamicQrCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const generatedUrl = await QRCode.toDataURL(dynamicPayload, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    const result: DynamicQrPhBuildResult = {
      qrDataUrl: generatedUrl,
      isDynamicQrPh: true,
      networkHint: inspection.networkHint,
    };
    dynamicQrCache.set(cacheKey, result);
    return result;
  } catch {
    const fallback: DynamicQrPhBuildResult = {
      qrDataUrl: qrImageUrl,
      isDynamicQrPh: false,
      networkHint: inspection.networkHint,
    };
    return fallback;
  }
}
