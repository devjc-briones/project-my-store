import { useEffect, useState } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { resolveThemeTokens } from '../../templates/templateTypes';
import { CurrencyCode, Product, Store } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';

interface ProductDetailModalProps {
  product: Product | null;
  initialVariant?: string;
  store: Store;
  currency: CurrencyCode;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    variantLabel: string | undefined,
    quantity: number,
    unitPrice: number
  ) => void;
}

export function ProductDetailModal({
  product,
  initialVariant,
  store,
  currency,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  useBodyScrollLock(Boolean(product));

  const theme = resolveThemeTokens(store.branding, store.templateId);
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA[store.templateId].imageUrl;

  const [selectedVariantLabel, setSelectedVariantLabel] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    const defaultVariant =
      initialVariant && product.variants.some((v) => v.label === initialVariant)
        ? initialVariant
        : product.variants[0]?.label ?? '';
    setSelectedVariantLabel(defaultVariant);
    setQuantity(1);
  }, [product, initialVariant]);

  useEffect(() => {
    if (!product) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const activeVariant = product.variants.find((v) => v.label === selectedVariantLabel);
  const unitPrice = Math.max(0, product.finalPrice + (activeVariant?.priceDelta ?? 0));
  const originalUnitPrice = Math.max(0, product.basePrice + (activeVariant?.priceDelta ?? 0));
  const lineTotal = unitPrice * quantity;
  const maxStock = Math.max(1, activeVariant?.stock ?? product.stock ?? 20);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/65"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border shadow-2xl grid grid-cols-1 md:grid-cols-12"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.textPrimary,
          fontFamily: theme.bodyFontFamily,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full flex items-center justify-center border shadow-sm cursor-pointer"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.borderColor,
            color: theme.textPrimary,
          }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Image */}
        <div
          className="md:col-span-6 aspect-[4/3] md:aspect-auto md:min-h-[360px] overflow-hidden border-b md:border-b-0 md:border-r"
          style={{
            backgroundColor: theme.subtleBg,
            borderColor: theme.borderColor,
          }}
        >
          <img
            src={product.imageUrl || fallbackImg}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right Purchase Module */}
        <div className="md:col-span-6 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5 pr-8">
              <div
                className="flex items-center gap-2 text-xs font-medium"
                style={{ color: theme.textMuted }}
              >
                <span>{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{product.sku}</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-bold leading-snug"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                {product.name}
              </h2>
            </div>

            <div className="flex items-baseline gap-2.5 flex-wrap tabular-nums">
              <span className="text-2xl font-bold">{formatCurrency(unitPrice, currency)}</span>
              {product.discountPercent > 0 && (
                <>
                  <span className="text-sm line-through" style={{ color: theme.textMuted }}>
                    {formatCurrency(originalUnitPrice, currency)}
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: theme.primaryColor }}
                  >
                    Save {product.discountPercent}%
                  </span>
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.textMuted }}>
              {product.description}
            </p>

            {/* Variant Selector */}
            {product.variants.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold" style={{ color: theme.textPrimary }}>
                  Select {product.variants[0]?.attributeName || 'Option'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => {
                    const active = selectedVariantLabel === variant.label;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantLabel(variant.label)}
                        className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold border cursor-pointer transition-colors ${theme.chipRadiusClass}`}
                        style={
                          active
                            ? {
                                borderColor: theme.primaryColor,
                                backgroundColor: theme.primaryColor,
                                color: theme.onPrimaryText,
                              }
                            : {
                                borderColor: theme.borderColor,
                                backgroundColor: theme.subtleBg,
                                color: theme.textPrimary,
                              }
                        }
                      >
                        {variant.label}
                        {variant.priceDelta > 0 && (
                          <span className="ml-1 opacity-85 tabular-nums">
                            +{formatCurrency(variant.priceDelta, currency)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Stepper */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color: theme.textPrimary }}>
                  Quantity
                </span>
                <span className="tabular-nums" style={{ color: theme.textMuted }}>
                  {maxStock} available
                </span>
              </div>
              <div
                className={`inline-flex items-center border ${theme.chipRadiusClass}`}
                style={{ borderColor: theme.borderColor, backgroundColor: theme.subtleBg }}
              >
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-bold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                  className="w-10 h-10 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onAddToCart(
                product,
                selectedVariantLabel || undefined,
                quantity,
                unitPrice
              );
              onClose();
            }}
            className={`w-full min-h-[46px] px-5 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
            style={{
              backgroundColor: theme.primaryColor,
              color: theme.onPrimaryText,
            }}
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="tabular-nums">
              Add to Cart — {formatCurrency(lineTotal, currency)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
