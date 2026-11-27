import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
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

interface DynamicQrPhCodeProps {
  qrImageUrl?: string;
  exactAmount?: number;
  currencySymbol?: string;
  alt: string;
  imgClassName?: string;
  wrapperClassName?: string;
  showDynamicBadge?: boolean;
}

export function DynamicQrPhCode({
  qrImageUrl,
  exactAmount,
  currencySymbol = '₱',
  alt,
  imgClassName = 'w-36 h-36 object-contain rounded-lg',
  wrapperClassName = 'inline-flex flex-col items-center gap-1.5',
  showDynamicBadge = true,
}: DynamicQrPhCodeProps) {
  const [built, setBuilt] = useState<DynamicQrPhBuildResult>(() => ({
    qrDataUrl: qrImageUrl || '',
    isDynamicQrPh: false,
  }));

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

  if (!built.qrDataUrl) return null;

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
    </div>
  );
}
