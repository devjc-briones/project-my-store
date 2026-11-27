import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileEdit,
  Package,
  Pencil,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Store } from '../../types/schema';
import { INDUSTRY_TEMPLATES } from '../../data/templates';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { useStore } from '../../context/StoreContext';
import { buildRoutePath } from '../../router/routes';
import { isStoreTemporarilyClosedByBilling } from '../../utils/billing';

interface StoreCardProps {
  store: Store;
  onDeleteRequest?: (store: Store) => void;
}

export function StoreCard({ store, onDeleteRequest }: StoreCardProps) {
  const { state, getStoreProducts, navigate, pushToast } = useStore();
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const owner =
    (state.users ?? []).find((u) => u.id === store.ownerId) ??
    (state.currentUser?.id === store.ownerId ? state.currentUser : undefined);
  const isTemporarilyClosed = isStoreTemporarilyClosedByBilling(store, owner);

  const products = getStoreProducts(store.id);
  const availableCount = products.filter((p) => p.isAvailable).length;
  const templateMeta =
    INDUSTRY_TEMPLATES[store.templateId] ?? INDUSTRY_TEMPLATES['food-restaurant'];
  const fallbackMedia =
    TEMPLATE_SHOWCASE_MEDIA[store.templateId] ?? TEMPLATE_SHOWCASE_MEDIA['food-restaurant'];
  const previewImageUrl = store.branding?.heroBannerUrl || fallbackMedia.imageUrl;
  const storeInitial = (store.name ?? '').trim().charAt(0).toUpperCase() || 'S';
  const shopPath = buildRoutePath({ name: 'storefront', storeSlug: store.slug });

  const handleCardBodyClick = () => {
    navigate({ name: 'store-products', storeId: store.id });
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardBodyClick();
    }
  };

  const handleEditUi = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate({ name: 'store-customize', storeId: store.id });
  };

  const handleViewShop = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate({ name: 'storefront', storeSlug: store.slug });
  };

  const handleCopyLink = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${shopPath}`
        : `https://${store.domainUrl}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      pushToast({
        type: 'success',
        title: 'Link copied!',
        description: `${store.domainUrl} copied to clipboard.`,
      });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast({
        type: 'error',
        title: 'Could not copy link',
        description: `Copy manually: ${store.domainUrl}`,
      });
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Manage products for ${store.name}`}
      onClick={handleCardBodyClick}
      onKeyDown={handleCardKeyDown}
      className="group bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-150 hover:-translate-y-0.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
    >
      <div>
        {/* Store Visual Thumbnail Header */}
        <div className="relative aspect-[16/9] w-full bg-slate-100 overflow-hidden border-b border-slate-200/80">
          {!imgError && previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt={`${store.name} banner preview`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: store.branding.surfaceColor }}
            >
              <span
                className="text-2xl font-bold tracking-tight"
                style={{ color: store.branding.primaryColor }}
              >
                {store.branding.logoText}
              </span>
            </div>
          )}

          {/* Subtle gradient scrim for logo monogram legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

          {/* Upper-Right Circular Delete Button */}
          {onDeleteRequest && (
            <button
              type="button"
              aria-label={`Delete ${store.name}`}
              title={`Delete ${store.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteRequest(store);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation();
                }
              }}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 shadow-sm backdrop-blur-sm flex items-center justify-center transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Store Logo Monogram / Thumbnail */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {store.branding.logoImageUrl ? (
                <img
                  src={store.branding.logoImageUrl}
                  alt={`${store.name} logo`}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-cover bg-white border border-white/80 shadow-sm shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm border border-white/25 shrink-0"
                  style={{ backgroundColor: store.branding?.primaryColor || '#0f172a' }}
                >
                  {storeInitial}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white truncate leading-tight">
                  {store.name}
                </h2>
                <p className="text-xs font-mono text-white/85 truncate">{store.domainUrl}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Store Metadata & Product Count */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-600 truncate">
              {templateMeta.name}
            </span>

            {isTemporarilyClosed ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 shrink-0">
                <Clock className="w-3.5 h-3.5" />
                Temporarily Closed
              </span>
            ) : store.status === 'published' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Published
              </span>
            ) : store.status === 'restricted' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 shrink-0">
                <ShieldAlert className="w-3.5 h-3.5" />
                Restricted
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 shrink-0">
                <FileEdit className="w-3.5 h-3.5" />
                Draft
              </span>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 tabular-nums">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </span>
            <span className="tabular-nums text-slate-500">{availableCount} available</span>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-slate-500 group-hover:text-slate-900 transition-colors">
            <span>Click card to manage products</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>

      {/* Dedicated 3-Button Action Strip (Stops click propagation) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-3 py-2.5 bg-slate-50 border-t border-slate-200/80 grid grid-cols-3 gap-1.5"
      >
        <button
          type="button"
          onClick={handleEditUi}
          className="min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5 shrink-0" />
          <span>Edit UI</span>
        </button>

        <button
          type="button"
          onClick={handleViewShop}
          className="min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>View Shop</span>
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          className="min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
