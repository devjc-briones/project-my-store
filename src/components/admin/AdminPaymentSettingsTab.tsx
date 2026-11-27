import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Landmark,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import { AdminModalWrapper } from './AdminModalWrapper';
import { useStore } from '../../context/StoreContext';
import { createDefaultPlatformPaymentSettings } from '../../data/platformPayments';
import {
  PlatformPaymentChannel,
  PlatformPaymentChannelType,
  PlatformPaymentSettings,
} from '../../types/schema';
import {
  AdminGatewayActivity,
  fetchAdminGatewayActivity,
  fetchPaymentGatewayConfig,
  PaymentGatewayPublicConfig,
  sendAdminTestWebhookAlert,
} from '../../utils/paymentGateway';
import { readImageFileAsDataUrl } from '../../utils/paymentQr';

interface AdminPaymentSettingsTabProps {
  settings: PlatformPaymentSettings;
  onUpdateSettings: (channels: PlatformPaymentChannel[]) => void;
}

const CORE_CHANNEL_IDS = new Set(['gcash', 'maya', 'bank']);

function getChannelIcon(type: PlatformPaymentChannelType) {
  switch (type) {
    case 'ewallet':
      return Smartphone;
    case 'bank':
      return Landmark;
    default:
      return QrCode;
  }
}

function getChannelTypeLabel(type: PlatformPaymentChannelType): string {
  switch (type) {
    case 'ewallet':
      return 'E-Wallet';
    case 'bank':
      return 'Bank Transfer';
    default:
      return 'Custom Method';
  }
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Just now';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AdminPaymentSettingsTab({
  settings,
  onUpdateSettings,
}: AdminPaymentSettingsTabProps) {
  const { pushToast } = useStore();
  const channels = settings.channels;

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    channels.forEach((c) => {
      initial[c.id] = c.enabled;
    });
    return initial;
  });

  const enabledChannels = useMemo(
    () => channels.filter((c) => c.enabled),
    [channels]
  );

  const [previewChannelId, setPreviewChannelId] = useState<string>(
    () => enabledChannels[0]?.id ?? channels[0]?.id ?? ''
  );

  useEffect(() => {
    if (enabledChannels.length === 0) {
      setPreviewChannelId('');
      return;
    }
    if (!enabledChannels.some((c) => c.id === previewChannelId)) {
      setPreviewChannelId(enabledChannels[0].id);
    }
  }, [enabledChannels, previewChannelId]);

  const activePreviewChannel = useMemo(
    () => enabledChannels.find((c) => c.id === previewChannelId) ?? enabledChannels[0] ?? null,
    [enabledChannels, previewChannelId]
  );

  // Add Custom Method modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newType, setNewType] = useState<PlatformPaymentChannelType>('ewallet');
  const [newLabel, setNewLabel] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newNumberLabel, setNewNumberLabel] = useState('Account Number');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newQrUrl, setNewQrUrl] = useState<string | undefined>(undefined);
  const [newRequiresReceipt, setNewRequiresReceipt] = useState(false);
  const newQrInputRef = useRef<HTMLInputElement | null>(null);

  // Zero-Receipt Gateway Engine & Live Webhook Simulator state
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayPublicConfig | null>(null);
  const [gatewayActivity, setGatewayActivity] = useState<AdminGatewayActivity | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [gatewayExpanded, setGatewayExpanded] = useState(false);
  const [simChannel, setSimChannel] = useState<'gcash' | 'maya' | 'bank'>('gcash');
  const [simText, setSimText] = useState(
    'You have received PHP 369.01 of GCash from JUAN DELA CRUZ with Ref. No. 901234567890.'
  );
  const [simSending, setSimSending] = useState(false);

  const loadGatewayState = useCallback(async () => {
    setGatewayLoading(true);
    setGatewayError(null);
    try {
      const [cfg, act] = await Promise.all([
        fetchPaymentGatewayConfig(),
        fetchAdminGatewayActivity().catch(() => null),
      ]);
      setGatewayConfig(cfg);
      if (act) setGatewayActivity(act);
    } catch (err) {
      setGatewayConfig(null);
      setGatewayError(
        err instanceof Error ? err.message : 'Unable to reach /api/payments/config.'
      );
    } finally {
      setGatewayLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGatewayState();
  }, [loadGatewayState]);

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast({
        type: 'success',
        title: `${label} copied`,
        description: 'Ready to paste into your forwarder or webhook settings.',
      });
    } catch {
      pushToast({
        type: 'error',
        title: 'Copy Failed',
        description: 'Unable to copy to clipboard.',
      });
    }
  };

  const handleFillExactAmount = (amount: number, channel: string) => {
    const normalized = channel.toLowerCase().includes('maya')
      ? 'maya'
      : channel.toLowerCase().includes('bank')
        ? 'bank'
        : 'gcash';
    setSimChannel(normalized);
    const formatted = amount.toFixed(2);
    const ref = `TEST${Date.now().toString().slice(-6)}`;
    if (normalized === 'maya') {
      setSimText(
        `You received PHP ${formatted} via Maya from MARIA SANTOS. Ref No: ${ref}`
      );
    } else if (normalized === 'bank') {
      setSimText(
        `InstaPay credit of PHP ${formatted} received in your account. Reference: ${ref}`
      );
    } else {
      setSimText(
        `You have received PHP ${formatted} of GCash from JUAN DELA CRUZ with Ref. No. ${ref}.`
      );
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim() || simSending) return;
    setSimSending(true);
    try {
      const res = await sendAdminTestWebhookAlert({
        text: simText.trim(),
        channel: simChannel,
      });
      await loadGatewayState();
      if (res.matched && res.session) {
        pushToast({
          type: 'success',
          title: 'Payment Auto-Matched!',
          description: `Session ${res.session.referenceCode} (₱${res.session.uniquePayableAmount.toFixed(
            2
          )}) marked PAID without receipt upload.`,
        });
      } else if (res.duplicate) {
        pushToast({
          type: 'info',
          title: 'Duplicate Alert Ignored',
          description: 'Idempotency guard prevented duplicate processing.',
        });
      } else {
        pushToast({
          type: 'info',
          title: 'Alert Recorded (No Open Match)',
          description: `Parsed ₱${Number(res.amount ?? 0).toFixed(
            2
          )}, but no awaiting session had that exact centavo total.`,
        });
      }
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Simulation Failed',
        description: err instanceof Error ? err.message : 'Unable to send simulated alert.',
      });
    } finally {
      setSimSending(false);
    }
  };

  const updateChannel = (
    channelId: string,
    patch: Partial<PlatformPaymentChannel>
  ) => {
    const next = channels.map((c) =>
      c.id === channelId ? { ...c, ...patch } : c
    );
    onUpdateSettings(next);
  };

  const handleToggleChannel = (channel: PlatformPaymentChannel) => {
    const nextEnabled = !channel.enabled;
    updateChannel(channel.id, { enabled: nextEnabled });
    if (nextEnabled) {
      setExpandedIds((prev) => ({ ...prev, [channel.id]: true }));
      setPreviewChannelId(channel.id);
    }
    pushToast({
      type: nextEnabled ? 'success' : 'info',
      title: `${channel.label} ${nextEnabled ? 'enabled' : 'hidden'}`,
      description: nextEnabled
        ? `${channel.label} is now visible in the user plan payment modal.`
        : `${channel.label} will no longer appear to users during plan payment.`,
    });
  };

  const handleUploadChannelQr = async (
    channelId: string,
    label: string,
    file?: File
  ) => {
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      updateChannel(channelId, { qrImageUrl: dataUrl });
      pushToast({
        type: 'success',
        title: `${label} QR updated`,
        description: 'Users will see the new QR code immediately when paying for a plan.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'QR Upload Failed',
        description: err instanceof Error ? err.message : 'Unable to read QR image.',
      });
    }
  };

  const handleRemoveChannelQr = (channelId: string, label: string) => {
    updateChannel(channelId, { qrImageUrl: undefined });
    pushToast({
      type: 'info',
      title: `${label} QR removed`,
      description: 'Only account name and number will be shown unless you upload a new QR.',
    });
  };

  const handleDeleteCustomChannel = (channel: PlatformPaymentChannel) => {
    const next = channels.filter((c) => c.id !== channel.id);
    onUpdateSettings(next);
    pushToast({
      type: 'info',
      title: `${channel.label} removed`,
      description: 'Payment method deleted from platform billing options.',
    });
  };

  const handleResetDefaults = () => {
    const defaults = createDefaultPlatformPaymentSettings();
    onUpdateSettings(defaults.channels);
    setExpandedIds({});
    pushToast({
      type: 'info',
      title: 'Payment methods cleared',
      description: 'All platform payment methods have been removed.',
    });
  };

  const handleSaveSettings = () => {
    if (enabledChannels.length === 0) {
      pushToast({
        type: 'error',
        title: 'No active payment methods',
        description: 'Enable at least one payment method so users can pay for their plan.',
      });
      return;
    }
    onUpdateSettings(channels);
    pushToast({
      type: 'success',
      title: 'Payment settings saved',
      description: `${enabledChannels.length} payment method${
        enabledChannels.length === 1 ? '' : 's'
      } synced live to the user billing modal.`,
    });
  };

  const handleNewQrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setNewQrUrl(dataUrl);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Invalid QR Image',
        description: err instanceof Error ? err.message : 'Unable to upload QR image.',
      });
    }
  };

  const handleAddCustomMethod = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = newLabel.trim();
    if (!cleanLabel) {
      pushToast({
        type: 'error',
        title: 'Method name required',
        description: 'Enter a payment method name (e.g., GoTyme, BPI, SeaBank).',
      });
      return;
    }
    const id = `custom_${Date.now().toString(36)}`;
    const created: PlatformPaymentChannel = {
      id,
      type: newType,
      label: cleanLabel,
      subtitle:
        newSubtitle.trim() ||
        (newType === 'bank' ? 'Bank / InstaPay transfer' : 'Scan QR or send payment'),
      enabled: true,
      requiresReceipt: newRequiresReceipt,
      accountName: newAccountName.trim(),
      numberLabel: newNumberLabel.trim() || 'Account Number',
      accountNumber: newAccountNumber.trim(),
      note: newNote.trim() || undefined,
      qrImageUrl: newQrUrl,
    };

    onUpdateSettings([...channels, created]);
    setExpandedIds((prev) => ({ ...prev, [id]: true }));
    setPreviewChannelId(id);
    setAddModalOpen(false);
    setNewLabel('');
    setNewSubtitle('');
    setNewAccountName('');
    setNewAccountNumber('');
    setNewNote('');
    setNewQrUrl(undefined);
    pushToast({
      type: 'success',
      title: `${created.label} added`,
      description: 'New payment method is live in the user subscription modal.',
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Summary Bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-bold text-sm text-[#0f172a] tabular-nums">
              {enabledChannels.length} of {channels.length} methods active
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="tabular-nums text-slate-500">
              Updated {formatUpdatedAt(settings.updatedAt)}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Only active methods appear to sellers when upgrading or settling a due plan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#e2e8f0] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Method</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={channels.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 border border-[#e2e8f0] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-[#0f172a] hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {enabledChannels.length === 0 && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 space-y-1">
            <p className="font-bold">No payment methods are visible to users</p>
            <p>
              Turn on GCash, Maya, or Bank Transfer below, enter your Account Name, Number, and QR code, then tap <span className="font-semibold">Save Settings</span>.
            </p>
          </div>
        </div>
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Channel Configuration Cards */}
        <div className="lg:col-span-7 space-y-3.5">
          {channels.length === 0 && (
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#0f172a]">
                  No subscription payment methods configured
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Add GCash, Maya, Bank Transfer, or another payment channel so sellers can pay for Pro upgrades.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-[#0f172a] hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Method</span>
              </button>
            </div>
          )}

          {channels.map((channel) => {
            const Icon = getChannelIcon(channel.type);
            const isExpanded = expandedIds[channel.id] ?? channel.enabled;
            const isCore = CORE_CHANNEL_IDS.has(channel.id);

            return (
              <div
                key={channel.id}
                className={`bg-white border rounded-2xl overflow-hidden transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
                  channel.enabled ? 'border-[#e2e8f0]' : 'border-slate-200/70 opacity-90'
                }`}
              >
                {/* Channel Card Header */}
                <div className="p-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => ({ ...prev, [channel.id]: !isExpanded }))
                    }
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                        channel.enabled
                          ? 'bg-[#0f172a] text-white border-[#0f172a]'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="text-sm font-bold text-[#0f172a] truncate">
                          {channel.label || 'Untitled Method'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap">
                          {getChannelTypeLabel(channel.type)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {channel.accountNumber
                          ? `${channel.accountNumber}${
                              channel.qrImageUrl ? ' · QR ready' : ' · No QR'
                            }`
                          : channel.qrImageUrl
                            ? 'QR code uploaded'
                            : 'Configure account & QR details'}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isCore && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomChannel(channel)}
                        aria-label={`Delete ${channel.label}`}
                        className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      role="switch"
                      aria-checked={channel.enabled}
                      aria-label={`Toggle ${channel.label}`}
                      onClick={() => handleToggleChannel(channel)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                        channel.enabled ? 'bg-[#0f172a]' : 'bg-slate-200 hover:bg-slate-300'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          channel.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                      onClick={() =>
                        setExpandedIds((prev) => ({ ...prev, [channel.id]: !isExpanded }))
                      }
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Configuration Body */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={channel.label}
                          onChange={(e) =>
                            updateChannel(channel.id, { label: e.target.value })
                          }
                          placeholder="e.g., GCash"
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={channel.subtitle}
                          onChange={(e) =>
                            updateChannel(channel.id, { subtitle: e.target.value })
                          }
                          placeholder="e.g., Scan QR or send via e-wallet"
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Account Name
                        </label>
                        <input
                          type="text"
                          value={channel.accountName}
                          onChange={(e) =>
                            updateChannel(channel.id, { accountName: e.target.value })
                          }
                          placeholder="Account holder name"
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Number Label
                        </label>
                        <input
                          type="text"
                          value={channel.numberLabel}
                          onChange={(e) =>
                            updateChannel(channel.id, { numberLabel: e.target.value })
                          }
                          placeholder="Account Number"
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={channel.accountNumber}
                          onChange={(e) =>
                            updateChannel(channel.id, { accountNumber: e.target.value })
                          }
                          placeholder="09XX XXX XXXX"
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    {/* QR Uploader */}
                    <ChannelQrUploader
                      label={`${channel.label} Payment QR Code`}
                      qrImageUrl={channel.qrImageUrl}
                      onUpload={(file) =>
                        handleUploadChannelQr(channel.id, channel.label, file)
                      }
                      onRemove={() =>
                        handleRemoveChannelQr(channel.id, channel.label)
                      }
                    />

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Instructions / Note for Users
                      </label>
                      <input
                        type="text"
                        value={channel.note ?? ''}
                        onChange={(e) =>
                          updateChannel(channel.id, { note: e.target.value })
                        }
                        placeholder="Scan the QR code and send the exact centavo amount shown for instant auto-match."
                        className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none pt-1">
                      <input
                        type="checkbox"
                        checked={channel.requiresReceipt}
                        onChange={(e) =>
                          updateChannel(channel.id, {
                            requiresReceipt: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span>
                        Legacy receipt upload flag (keep unchecked for Zero-Receipt Auto-Match mode)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Live User Plan Checkout Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 bg-white border border-[#e2e8f0] rounded-2xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-[#0f172a]">User Checkout Preview</h2>
              <p className="text-[11px] text-slate-500">
                Exact view shown to sellers in Subscription Plans &amp; Billing
              </p>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-500 tabular-nums">
              {enabledChannels.length} visible
            </span>
          </div>

          {enabledChannels.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <QrCode className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No active methods</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Enable at least one payment channel on the left to preview the user checkout.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Simulated Channel Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {enabledChannels.map((channel) => {
                  const Icon = getChannelIcon(channel.type);
                  const active = activePreviewChannel?.id === channel.id;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setPreviewChannelId(channel.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                        active
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {channel.label}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {channel.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Channel Preview Box */}
              {activePreviewChannel && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3.5">
                    {activePreviewChannel.qrImageUrl && (
                      <div className="p-2 bg-white rounded-xl border border-slate-200 shrink-0">
                        <img
                          src={activePreviewChannel.qrImageUrl}
                          alt={`${activePreviewChannel.label} QR Preview`}
                          className="w-24 h-24 object-contain rounded"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
                      <p className="text-xs font-bold text-slate-900">
                        {activePreviewChannel.label} Payment Details
                      </p>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Account Name
                        </p>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {activePreviewChannel.accountName || '—'}
                        </p>
                      </div>
                      {activePreviewChannel.accountNumber && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {activePreviewChannel.numberLabel || 'Account Number'}
                          </p>
                          <p className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                            {activePreviewChannel.accountNumber}
                          </p>
                        </div>
                      )}
                      {activePreviewChannel.note && (
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {activePreviewChannel.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zero-Receipt Auto-Confirm Webhook & Live Simulator (Placed below channels for mobile clarity) */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0f172a] text-white flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-[#0f172a]">
                  Auto-Match Alert Webhook &amp; Simulator
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  No BIR / No DTI Required
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Optional automation: auto-confirms exact-centavo GCash, Maya, and PH Bank transfers
                without receipt uploads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadGatewayState()}
              disabled={gatewayLoading}
              className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#e2e8f0] rounded-xl cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gatewayLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setGatewayExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#e2e8f0] rounded-xl cursor-pointer"
            >
              <span>{gatewayExpanded ? 'Hide' : 'Open Webhook & Test'}</span>
              {gatewayExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {gatewayExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Active Mode Summary + Server Readiness */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 min-w-0 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Auto-Match QR Ph + Alert Webhook
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white shrink-0">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  2-step local setup: (1) Turn on your GCash, Maya, or Bank cards above with your
                  Account Name, Number, and QR image, then Save Settings. (2) Optionally point an
                  Android SMS/email forwarder to the webhook URL below for instant auto-approval.
                </p>
              </div>

              <div className="lg:col-span-5 min-w-0 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between gap-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Server Readiness
                </p>
                {gatewayError ? (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-[11px] text-rose-800 space-y-1">
                    <p className="font-bold">Gateway API Unreachable</p>
                    <p className="break-words">{gatewayError}</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Local Webhook Secret</span>
                      <span
                        className={`font-semibold ${
                          gatewayConfig?.localWebhookConfigured
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {gatewayLoading && !gatewayConfig
                          ? 'Checking...'
                          : gatewayConfig?.localWebhookConfigured
                            ? 'Configured'
                            : 'Missing in Server Env'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Supabase Service Sync</span>
                      <span
                        className={`font-semibold ${
                          gatewayConfig?.supabaseServiceConfigured
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {gatewayLoading && !gatewayConfig
                          ? 'Checking...'
                          : gatewayConfig?.supabaseServiceConfigured
                            ? 'Connected'
                            : gatewayConfig?.supabaseKeyWarning
                              ? 'Wrong Key Type'
                              : 'Memory Fallback'}
                      </span>
                    </div>
                    {gatewayConfig?.supabaseKeyWarning && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-snug">
                        {gatewayConfig.supabaseKeyWarning}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Webhook Forwarder Endpoint & Live Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-6 min-w-0 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 min-w-0">
                    <Webhook className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Android SMS / Email Alert Webhook</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyText(
                        gatewayConfig?.localWebhookUrl ||
                          `${window.location.origin}/api/payments/local-webhook`,
                        'Webhook URL'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy URL</span>
                  </button>
                </div>

                <p className="text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 break-all">
                  POST{' '}
                  {gatewayConfig?.localWebhookUrl ||
                    `${window.location.origin}/api/payments/local-webhook`}
                </p>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <p className="break-words">
                    Forward GCash, Maya, or Bank credit SMS/emails with header{' '}
                    <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 break-all">
                      Authorization: Bearer &lt;LOCAL_PAYMENT_WEBHOOK_SECRET&gt;
                    </code>{' '}
                    and JSON body:
                  </p>
                  <pre className="font-mono text-[10px] bg-white border border-slate-200 rounded-lg p-2 text-slate-800 overflow-x-auto max-w-full">
                    {`{ "text": "{{sms_body}}" }`}
                  </pre>
                </div>
              </div>

              {/* Admin Live Webhook Simulator */}
              <div className="lg:col-span-6 min-w-0 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 min-w-0">
                    <Activity className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Live Webhook Simulator</span>
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                    {(gatewayActivity?.intents ?? []).filter((i) => i.status === 'awaiting_payment')
                      .length}{' '}
                    awaiting
                  </span>
                </div>

                {gatewayActivity &&
                  gatewayActivity.intents.some((i) => i.status === 'awaiting_payment') && (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {gatewayActivity.intents
                        .filter((i) => i.status === 'awaiting_payment')
                        .slice(0, 4)
                        .map((intent) => (
                          <div
                            key={intent.id}
                            className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px]"
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-bold text-slate-900">
                                ₱{intent.uniquePayableAmount.toFixed(2)}
                              </span>
                              <span className="text-slate-500 ml-2 truncate">
                                {intent.channelLabel} · {intent.referenceCode}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleFillExactAmount(
                                  intent.uniquePayableAmount,
                                  intent.channel
                                )
                              }
                              className="px-2 py-1 text-[10px] font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 shrink-0 cursor-pointer"
                            >
                              Fill Exact ₱
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                <form onSubmit={handleSimulateWebhook} className="space-y-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                    <select
                      value={simChannel}
                      onChange={(e) =>
                        setSimChannel(e.target.value as 'gcash' | 'maya' | 'bank')
                      }
                      aria-label="Simulated payment channel"
                      className="w-full sm:w-auto min-h-[36px] px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 shrink-0"
                    >
                      <option value="gcash">GCash SMS</option>
                      <option value="maya">Maya Alert</option>
                      <option value="bank">Bank InstaPay</option>
                    </select>
                    <input
                      type="text"
                      value={simText}
                      onChange={(e) => setSimText(e.target.value)}
                      placeholder="Paste sample credit SMS text..."
                      className="w-full min-w-0 flex-1 min-h-[36px] px-2.5 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={simSending || !simText.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-white bg-[#0f172a] hover:bg-slate-800 disabled:opacity-60 rounded-lg cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {simSending ? 'Simulating Alert...' : 'Simulate Deposit Alert'}
                    </span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Custom Payment Method Modal */}
      <AdminModalWrapper
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        ariaLabelledBy="add-platform-method-title"
      >
        <form
          onSubmit={handleAddCustomMethod}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-5 shadow-2xl space-y-4 my-auto"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="add-platform-method-title" className="text-base font-bold text-[#0f172a]">
                Add Subscription Payment Method
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add another e-wallet, bank, or QR channel for seller plan payments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              aria-label="Close add method modal"
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Channel Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => {
                    const nextType = e.target.value as PlatformPaymentChannelType;
                    setNewType(nextType);
                    setNewRequiresReceipt(false);
                  }}
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="ewallet">E-Wallet</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="custom">Custom QR / Manual</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Method Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., GoTyme Bank"
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600">
                Subtitle
              </label>
              <input
                type="text"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="e.g., Scan GoTyme QR or InstaPay transfer"
                className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Account holder name"
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Number Label
                    </label>
                    <input
                      type="text"
                      value={newNumberLabel}
                      onChange={(e) => setNewNumberLabel(e.target.value)}
                      placeholder="Account Number"
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Account / Mobile Number
                  </label>
                  <input
                    type="text"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    QR Code Image (Optional)
                  </label>
                  <input
                    ref={newQrInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleNewQrFile}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-[#e2e8f0] rounded-xl">
                    {newQrUrl ? (
                      <img
                        src={newQrUrl}
                        alt="New method QR preview"
                        className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                        <QrCode className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        type="button"
                        onClick={() => newQrInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{newQrUrl ? 'Change QR' : 'Upload QR'}</span>
                      </button>
                      {newQrUrl && (
                        <button
                          type="button"
                          onClick={() => setNewQrUrl(undefined)}
                          className="min-h-[34px] px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-white border border-slate-200 hover:bg-rose-50 rounded-lg cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600">
                Payment Instructions / Note
              </label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Scan QR and send the exact centavo amount shown for automatic confirmation."
                className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="flex-1 min-h-[40px] py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              Add Method
            </button>
          </div>
        </form>
      </AdminModalWrapper>
    </div>
  );
}

function ChannelQrUploader({
  label,
  qrImageUrl,
  onUpload,
  onRemove,
}: {
  label: string;
  qrImageUrl?: string;
  onUpload: (file?: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          onUpload(file);
        }}
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
            <div className="w-14 h-14 rounded-lg border border-dashed border-slate-300 bg-white text-slate-400 flex items-center justify-center shrink-0">
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
                <span className="text-[11px] font-medium text-slate-500">
                  No QR uploaded
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {qrImageUrl
                ? 'Shown directly to users when paying for their plan.'
                : 'Upload your QR code image so users can scan to pay.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
