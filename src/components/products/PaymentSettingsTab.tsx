import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Landmark,
  QrCode,
  Smartphone,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { CurrencyCode, PaymentSettings } from '../../types/schema';
import { readImageFileAsDataUrl } from '../../utils/paymentQr';
import { formatCurrency, getCurrencySymbol } from '../../utils/pricing';

interface PaymentSettingsTabProps {
  settings: PaymentSettings;
  onChange: (patch: Partial<PaymentSettings>) => void;
}

type OnlineQrMethod = 'gcash' | 'maya' | 'bank';

const CURRENCIES: Array<{ code: CurrencyCode; label: string }> = [
  { code: 'PHP', label: 'PHP (₱)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'SGD', label: 'SGD (S$)' },
  { code: 'EUR', label: 'EUR (€)' },
];

interface QrCodeUploaderProps {
  label: string;
  qrImageUrl?: string;
  hasWarning: boolean;
  shake: boolean;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
  onError: (message: string) => void;
}

function QrCodeUploader({
  label,
  qrImageUrl,
  hasWarning,
  shake,
  onUpload,
  onRemove,
  onError,
}: QrCodeUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      onUpload(dataUrl);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload QR code image.');
    }
  };

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${shake ? 'auth-shake' : ''} ${
        hasWarning
          ? 'border-rose-400 bg-rose-50/70 ring-4 ring-rose-500/15'
          : 'border-slate-200/80 bg-slate-50/70'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {qrImageUrl ? (
            <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 p-1 shrink-0 overflow-hidden flex items-center justify-center">
              <img
                src={qrImageUrl}
                alt={label}
                className="w-full h-full object-contain rounded"
              />
            </div>
          ) : (
            <div
              className={`w-14 h-14 rounded-lg border border-dashed flex items-center justify-center shrink-0 ${
                hasWarning
                  ? 'border-rose-400 bg-white text-rose-500'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              <QrCode className="w-6 h-6" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-bold text-slate-900">{label}</p>
              {qrImageUrl ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Uploaded
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    hasWarning ? 'text-rose-600' : 'text-amber-700'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Required to enable
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {qrImageUrl
                ? 'Customers will scan this QR code during checkout.'
                : 'Upload your store QR image first before enabling this online payment.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{qrImageUrl ? 'Change QR' : 'Upload QR'}</span>
          </button>

          {qrImageUrl && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${label}`}
              className="inline-flex items-center justify-center min-h-[34px] w-[34px] bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-500 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface NumericRuleInputProps {
  id: string;
  value: number;
  max?: number;
  onChangeValue: (val: number) => void;
}

function NumericRuleInput({ id, value, max, onChangeValue }: NumericRuleInputProps) {
  const [text, setText] = useState<string>(() => String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(String(value));
    }
  }, [value, focused]);

  const clampValue = (num: number) => {
    const nonNegative = Math.max(0, num);
    return max !== undefined ? Math.min(max, nonNegative) : nonNegative;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits and at most one decimal point
    let cleaned = raw.replace(/[^0-9.]/g, '');
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex !== -1) {
      cleaned =
        cleaned.slice(0, dotIndex + 1) +
        cleaned.slice(dotIndex + 1).replace(/\./g, '');
    }
    // Strip leading zeros before another digit (e.g., "050" -> "50", keeps "0" and "0.5")
    cleaned = cleaned.replace(/^0+(?=\d)/, '');

    if (cleaned === '') {
      setText('');
      onChangeValue(0);
      return;
    }

    const parsed = parseFloat(cleaned);
    if (Number.isNaN(parsed)) {
      setText('');
      onChangeValue(0);
      return;
    }

    const clamped = clampValue(parsed);
    if (max !== undefined && parsed > max) {
      setText(String(clamped));
    } else {
      setText(cleaned);
    }
    onChangeValue(clamped);
  };

  const handleBlur = () => {
    setFocused(false);
    if (text === '' || text === '.') {
      setText('0');
      onChangeValue(0);
      return;
    }
    const parsed = parseFloat(text);
    const clamped = Number.isNaN(parsed) ? 0 : clampValue(parsed);
    setText(String(clamped));
    onChangeValue(clamped);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      placeholder="0"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onChange={handleChange}
      className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
    />
  );
}

function ToggleSwitch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
        checked ? 'bg-slate-900' : 'bg-slate-200 hover:bg-slate-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function PaymentSettingsTab({ settings, onChange }: PaymentSettingsTabProps) {
  const { pushToast } = useStore();
  const [qrWarningMethod, setQrWarningMethod] = useState<OnlineQrMethod | null>(null);
  const [shakeMethod, setShakeMethod] = useState<OnlineQrMethod | null>(null);

  const symbol = getCurrencySymbol(settings.currency);
  const sampleSubtotal = 1200;
  const freeShippingUnlocked =
    settings.freeShippingThreshold > 0 && sampleSubtotal >= settings.freeShippingThreshold;
  const shippingApplied = freeShippingUnlocked ? 0 : settings.shippingFee;
  const taxApplied = Math.round(sampleSubtotal * (settings.taxPercent / 100) * 100) / 100;
  const serviceApplied =
    Math.round(sampleSubtotal * ((settings.serviceChargePercent ?? 0) / 100) * 100) / 100;
  const simulatedTotal = sampleSubtotal + shippingApplied + taxApplied + serviceApplied;

  const triggerQrWarning = (method: OnlineQrMethod, methodLabel: string) => {
    setQrWarningMethod(method);
    setShakeMethod(null);
    window.requestAnimationFrame(() => {
      setShakeMethod(method);
      window.setTimeout(() => setShakeMethod((curr) => (curr === method ? null : curr)), 400);
    });
    pushToast({
      type: 'error',
      title: 'QR Code Required',
      description: `Please upload a ${methodLabel} QR code first to enable online payment.`,
    });
  };

  const handleToggleGcash = () => {
    if (!settings.gcashEnabled && !settings.gcashDetails.qrImageUrl) {
      triggerQrWarning('gcash', 'GCash');
      return;
    }
    setQrWarningMethod((curr) => (curr === 'gcash' ? null : curr));
    onChange({ gcashEnabled: !settings.gcashEnabled });
  };

  const handleToggleMaya = () => {
    if (!settings.mayaEnabled && !settings.mayaDetails.qrImageUrl) {
      triggerQrWarning('maya', 'Maya');
      return;
    }
    setQrWarningMethod((curr) => (curr === 'maya' ? null : curr));
    onChange({ mayaEnabled: !settings.mayaEnabled });
  };

  const handleToggleBank = () => {
    if (!settings.bankTransferEnabled && !settings.bankDetails.qrImageUrl) {
      triggerQrWarning('bank', 'Bank Transfer');
      return;
    }
    setQrWarningMethod((curr) => (curr === 'bank' ? null : curr));
    onChange({ bankTransferEnabled: !settings.bankTransferEnabled });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Payment Methods */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div>
            <h2 className="text-base font-bold text-slate-900">Accepted Payment Methods</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a QR code image to enable online payment channels (GCash, Maya, Bank Transfer).
            </p>
          </div>

          {/* GCash / E-Wallet */}
          <div className="border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">GCash E-Wallet</p>
                  <p className="text-xs text-slate-500">Instant mobile wallet transfer</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.gcashEnabled}
                onToggle={handleToggleGcash}
                label="Toggle GCash E-Wallet"
              />
            </div>

            <QrCodeUploader
              label="GCash QR Code"
              qrImageUrl={settings.gcashDetails.qrImageUrl}
              hasWarning={qrWarningMethod === 'gcash'}
              shake={shakeMethod === 'gcash'}
              onUpload={(dataUrl) => {
                setQrWarningMethod((curr) => (curr === 'gcash' ? null : curr));
                onChange({
                  gcashEnabled: true,
                  gcashDetails: { ...settings.gcashDetails, qrImageUrl: dataUrl },
                });
                pushToast({
                  type: 'success',
                  title: 'GCash QR uploaded',
                  description: 'GCash online payment is now enabled.',
                });
              }}
              onRemove={() => {
                onChange({
                  gcashEnabled: false,
                  gcashDetails: { ...settings.gcashDetails, qrImageUrl: undefined },
                });
                pushToast({
                  type: 'info',
                  title: 'GCash QR removed',
                  description: 'GCash was disabled until a new QR code is uploaded.',
                });
              }}
              onError={(msg) =>
                pushToast({ type: 'error', title: 'Invalid QR File', description: msg })
              }
            />

            {settings.gcashEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={settings.gcashDetails.accountName}
                    onChange={(e) =>
                      onChange({
                        gcashDetails: { ...settings.gcashDetails, accountName: e.target.value },
                      })
                    }
                    placeholder="Account holder name"
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    GCash Mobile Number
                  </label>
                  <input
                    type="text"
                    value={settings.gcashDetails.mobileNumber}
                    onChange={(e) =>
                      onChange({
                        gcashDetails: { ...settings.gcashDetails, mobileNumber: e.target.value },
                      })
                    }
                    placeholder="0917 555 0148"
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Customer Transfer Note
                  </label>
                  <input
                    type="text"
                    value={settings.gcashDetails.qrNote ?? ''}
                    onChange={(e) =>
                      onChange({
                        gcashDetails: { ...settings.gcashDetails, qrNote: e.target.value },
                      })
                    }
                    placeholder="Instructions displayed at checkout..."
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Maya E-Wallet */}
          <div className="border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Maya E-Wallet</p>
                  <p className="text-xs text-slate-500">Secondary QR / wallet transfer</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.mayaEnabled}
                onToggle={handleToggleMaya}
                label="Toggle Maya E-Wallet"
              />
            </div>

            <QrCodeUploader
              label="Maya QR Code"
              qrImageUrl={settings.mayaDetails.qrImageUrl}
              hasWarning={qrWarningMethod === 'maya'}
              shake={shakeMethod === 'maya'}
              onUpload={(dataUrl) => {
                setQrWarningMethod((curr) => (curr === 'maya' ? null : curr));
                onChange({
                  mayaEnabled: true,
                  mayaDetails: { ...settings.mayaDetails, qrImageUrl: dataUrl },
                });
                pushToast({
                  type: 'success',
                  title: 'Maya QR uploaded',
                  description: 'Maya online payment is now enabled.',
                });
              }}
              onRemove={() => {
                onChange({
                  mayaEnabled: false,
                  mayaDetails: { ...settings.mayaDetails, qrImageUrl: undefined },
                });
                pushToast({
                  type: 'info',
                  title: 'Maya QR removed',
                  description: 'Maya was disabled until a new QR code is uploaded.',
                });
              }}
              onError={(msg) =>
                pushToast({ type: 'error', title: 'Invalid QR File', description: msg })
              }
            />

            {settings.mayaEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={settings.mayaDetails.accountName}
                    onChange={(e) =>
                      onChange({
                        mayaDetails: { ...settings.mayaDetails, accountName: e.target.value },
                      })
                    }
                    placeholder="Account name"
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Maya Mobile Number
                  </label>
                  <input
                    type="text"
                    value={settings.mayaDetails.mobileNumber}
                    onChange={(e) =>
                      onChange({
                        mayaDetails: { ...settings.mayaDetails, mobileNumber: e.target.value },
                      })
                    }
                    placeholder="0917 555 0199"
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm font-mono bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bank Transfer */}
          <div className="border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Bank Transfer</p>
                  <p className="text-xs text-slate-500">InstaPay / PESONet bank deposit</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.bankTransferEnabled}
                onToggle={handleToggleBank}
                label="Toggle Bank Transfer"
              />
            </div>

            <QrCodeUploader
              label="Bank Transfer QR Code"
              qrImageUrl={settings.bankDetails.qrImageUrl}
              hasWarning={qrWarningMethod === 'bank'}
              shake={shakeMethod === 'bank'}
              onUpload={(dataUrl) => {
                setQrWarningMethod((curr) => (curr === 'bank' ? null : curr));
                onChange({
                  bankTransferEnabled: true,
                  bankDetails: { ...settings.bankDetails, qrImageUrl: dataUrl },
                });
                pushToast({
                  type: 'success',
                  title: 'Bank QR uploaded',
                  description: 'Bank Transfer online payment is now enabled.',
                });
              }}
              onRemove={() => {
                onChange({
                  bankTransferEnabled: false,
                  bankDetails: { ...settings.bankDetails, qrImageUrl: undefined },
                });
                pushToast({
                  type: 'info',
                  title: 'Bank QR removed',
                  description: 'Bank Transfer was disabled until a new QR code is uploaded.',
                });
              }}
              onError={(msg) =>
                pushToast({ type: 'error', title: 'Invalid QR File', description: msg })
              }
            />

            {settings.bankTransferEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Bank Name</label>
                  <input
                    type="text"
                    value={settings.bankDetails.bankName}
                    onChange={(e) =>
                      onChange({
                        bankDetails: { ...settings.bankDetails, bankName: e.target.value },
                      })
                    }
                    placeholder="BPI / BDO / UnionBank"
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Account Name</label>
                  <input
                    type="text"
                    value={settings.bankDetails.accountName}
                    onChange={(e) =>
                      onChange({
                        bankDetails: { ...settings.bankDetails, accountName: e.target.value },
                      })
                    }
                    placeholder="Store Enterprise Inc."
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={settings.bankDetails.accountNumber}
                    onChange={(e) =>
                      onChange({
                        bankDetails: { ...settings.bankDetails, accountNumber: e.target.value },
                      })
                    }
                    placeholder="0012-3456-7890"
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm font-mono bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cash on Delivery */}
          <div className="border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Cash on Delivery (COD)</p>
                  <p className="text-xs text-slate-500">Pay cash to courier upon delivery</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.codEnabled}
                onToggle={() => onChange({ codEnabled: !settings.codEnabled })}
                label="Toggle Cash on Delivery (COD)"
              />
            </div>

            {settings.codEnabled && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  COD Instructions
                </label>
                <input
                  type="text"
                  value={settings.codInstructions ?? ''}
                  onChange={(e) => onChange({ codInstructions: e.target.value })}
                  placeholder="Prepare exact cash upon rider arrival."
                  className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Order Calculation Rules & Live Simulator */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Order Calculation Rules</h2>
              <p className="text-xs text-slate-500">
                Delivery fees, free shipping threshold, VAT &amp; service charge.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Store Currency</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CURRENCIES.map((cur) => (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => onChange({ currency: cur.code })}
                    className={`min-h-[38px] px-2 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                      settings.currency === cur.code
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cur.code}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="shipping-fee" className="block text-xs font-semibold text-slate-700">
                  Flat Delivery Fee ({symbol})
                </label>
                <NumericRuleInput
                  id="shipping-fee"
                  value={settings.shippingFee}
                  onChangeValue={(val) => onChange({ shippingFee: val })}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="free-shipping-threshold"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Free Shipping Above ({symbol})
                </label>
                <NumericRuleInput
                  id="free-shipping-threshold"
                  value={settings.freeShippingThreshold}
                  onChangeValue={(val) => onChange({ freeShippingThreshold: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="tax-percent" className="block text-xs font-semibold text-slate-700">
                  Tax / VAT (%)
                </label>
                <NumericRuleInput
                  id="tax-percent"
                  value={settings.taxPercent}
                  max={50}
                  onChangeValue={(val) => onChange({ taxPercent: val })}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="service-charge" className="block text-xs font-semibold text-slate-700">
                  Service Charge (%)
                </label>
                <NumericRuleInput
                  id="service-charge"
                  value={settings.serviceChargePercent ?? 0}
                  max={30}
                  onChangeValue={(val) => onChange({ serviceChargePercent: val })}
                />
              </div>
            </div>
          </div>

          {/* Sample Checkout Calculation Preview */}
          <div className="pt-4 border-t border-slate-200/80 space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">
              Sample Order Breakdown ({formatCurrency(sampleSubtotal, settings.currency)} Basket)
            </p>
            <dl className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Items Subtotal</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">
                  {formatCurrency(sampleSubtotal, settings.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Delivery Fee</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">
                  {freeShippingUnlocked ? (
                    <span className="text-emerald-700 font-semibold">
                      Free (Above {formatCurrency(settings.freeShippingThreshold, settings.currency)})
                    </span>
                  ) : (
                    formatCurrency(shippingApplied, settings.currency)
                  )}
                </dd>
              </div>
              {settings.taxPercent > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">Tax / VAT ({settings.taxPercent}%)</dt>
                  <dd className="font-mono tabular-nums font-medium text-slate-900">
                    {formatCurrency(taxApplied, settings.currency)}
                  </dd>
                </div>
              )}
              {(settings.serviceChargePercent ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-600">
                    Service Charge ({settings.serviceChargePercent}%)
                  </dt>
                  <dd className="font-mono tabular-nums font-medium text-slate-900">
                    {formatCurrency(serviceApplied, settings.currency)}
                  </dd>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
                <dt>Estimated Checkout Total</dt>
                <dd className="font-mono tabular-nums">
                  {formatCurrency(simulatedTotal, settings.currency)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
