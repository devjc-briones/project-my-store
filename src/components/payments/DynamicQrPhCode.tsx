import React, { useEffect, useState } from 'react';
import { Check, Download, Sparkles } from 'lucide-react';
import {
  buildDynamicQrPhDataUrl,
  DynamicQrPhBuildResult,
  inspectQrPhImage,
  QrPhInspectionResult,
} from '../../utils/qrPh';

export function useQrPhInspection(qrImageUrl?: string): QrPhInspectionResult | null {
  const [result, setResult] = useState<QrPhInspectionResult | null>(null);

  useEffect(() => {
    if (!qrImageUrl) {
      setResult(null);
      return;
    }
    let active = true;
    inspectQrPhImage(qrImageUrl)
      .then((res) => {
        if (active) setResult(res);
      })
      .catch(() => {
        if (active) setResult(null);
      });
    return () => {
      active = false;
    };
  }, [qrImageUrl]);

  return result;
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'payment-qr.png';
}

function getExtensionFromMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('svg')) return 'svg';
  return 'png';
}

function ensureFileExtension(fileName: string, mime: string): string {
  const clean = sanitizeFileName(fileName);
  if (/\.(png|jpe?g|webp|svg)$/i.test(clean)) {
    return clean;
  }
  return `${clean}.${getExtensionFromMime(mime)}`;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const isBase64 = /;base64/i.test(header);

    if (isBase64) {
      const binary = atob(body);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }

    return new Blob([decodeURIComponent(body)], { type: mime });
  } catch {
    return null;
  }
}

function triggerAnchorDownload(href: string, fileName: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function downloadQrImage(src: string, requestedName: string): Promise<void> {
  if (src.startsWith('data:')) {
    const blob = dataUrlToBlob(src);
    if (blob) {
      const fileName = ensureFileExtension(requestedName, blob.type || 'image/png');
      const objectUrl = URL.createObjectURL(blob);
      triggerAnchorDownload(objectUrl, fileName);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      return;
    }
    triggerAnchorDownload(src, ensureFileExtension(requestedName, 'image/png'));
    return;
  }

  try {
    const response = await fetch(src, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      const fileName = ensureFileExtension(requestedName, blob.type || 'image/png');
      const objectUrl = URL.createObjectURL(blob);
      triggerAnchorDownload(objectUrl, fileName);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      return;
    }
  } catch {
    // Fall back to direct anchor download if cross-origin fetch is blocked
  }

  triggerAnchorDownload(src, ensureFileExtension(requestedName, 'image/png'));
}

interface DynamicQrPhCodeProps {
  qrImageUrl?: string;
  exactAmount?: number;
  currencySymbol?: string;
  alt: string;
  imgClassName?: string;
  wrapperClassName?: string;
  showDynamicBadge?: boolean;
  allowDownload?: boolean;
  downloadFileName?: string;
}

export function DynamicQrPhCode({
  qrImageUrl,
  exactAmount,
  currencySymbol = '₱',
  alt,
  imgClassName = 'w-36 h-36 object-contain rounded-lg',
  wrapperClassName = 'inline-flex flex-col items-center gap-1.5',
  showDynamicBadge = true,
  allowDownload = true,
  downloadFileName,
}: DynamicQrPhCodeProps) {
  const [built, setBuilt] = useState<DynamicQrPhBuildResult>(() => ({
    qrDataUrl: qrImageUrl || '',
    isDynamicQrPh: false,
  }));
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!qrImageUrl) {
      setBuilt({ qrDataUrl: '', isDynamicQrPh: false });
      return;
    }
    if (typeof exactAmount !== 'number' || !Number.isFinite(exactAmount) || exactAmount <= 0) {
      setBuilt({ qrDataUrl: qrImageUrl, isDynamicQrPh: false });
      return;
    }

    let active = true;
    setBuilt({ qrDataUrl: qrImageUrl, isDynamicQrPh: false });
    buildDynamicQrPhDataUrl(qrImageUrl, exactAmount)
      .then((res) => {
        if (active) setBuilt(res);
      })
      .catch(() => {
        if (active) setBuilt({ qrDataUrl: qrImageUrl, isDynamicQrPh: false });
      });

    return () => {
      active = false;
    };
  }, [qrImageUrl, exactAmount]);

  useEffect(() => {
    if (!downloaded) return;
    const timer = window.setTimeout(() => setDownloaded(false), 2000);
    return () => window.clearTimeout(timer);
  }, [downloaded]);

  if (!built.qrDataUrl) return null;

  const resolvedFileName =
    downloadFileName ||
    (typeof exactAmount === 'number' && Number.isFinite(exactAmount) && exactAmount > 0
      ? `payment-qr-${exactAmount.toFixed(2).replace('.', '-')}.png`
      : 'payment-qr.png');

  const handleDownload = async () => {
    if (!built.qrDataUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadQrImage(built.qrDataUrl, resolvedFileName);
      setDownloaded(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={wrapperClassName}>
      <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-xs inline-flex items-center justify-center">
        <img src={built.qrDataUrl} alt={alt} className={imgClassName} />
      </div>
      {showDynamicBadge && built.isDynamicQrPh && typeof exactAmount === 'number' && exactAmount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
          <Sparkles className="w-3 h-3 shrink-0" />
          <span>
            Exact {currencySymbol}
            {exactAmount.toFixed(2)} encoded in QR Ph
          </span>
        </span>
      )}
      {allowDownload && (
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={isDownloading}
          aria-label={downloaded ? 'QR code downloaded' : 'Download QR code'}
          className="inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
        >
          {downloaded ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>QR Saved</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Download QR</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
