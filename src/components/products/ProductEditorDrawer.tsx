import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { INDUSTRY_TEMPLATES, INDUSTRY_TEMPLATE_LIST } from '../../data/templates';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  CurrencyCode,
  DiscountType,
  IndustryTemplateId,
  Product,
  ProductVariant,
} from '../../types/schema';
import {
  calculateSmartPricing,
  formatCurrency,
  getCurrencySymbol,
} from '../../utils/pricing';

interface ProductEditorDrawerProps {
  isOpen: boolean;
  storeId: string;
  templateId: IndustryTemplateId;
  currency: CurrencyCode;
  editingProduct: Product | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description: string;
    category: string;
    basePrice: number;
    discountType: DiscountType;
    discountValue: number;
    costPrice?: number;
    sku: string;
    stock: number;
    imageUrl?: string;
    variants: ProductVariant[];
    isFeatured: boolean;
    isAvailable: boolean;
  }) => void;
}

const VARIANT_PRESETS_BY_TEMPLATE: Record<
  IndustryTemplateId,
  Array<{ label: string; attribute: string; values: string[] }>
> = {
  'food-restaurant': [
    { label: 'Spice Level', attribute: 'Spice', values: ['Mild', 'Medium', 'Spicy'] },
    { label: 'Portion Size', attribute: 'Portion', values: ['Solo', 'Sharing'] },
  ],
  'cafe-drinks': [
    { label: 'Cup Sizes', attribute: 'Size', values: ['12oz', '16oz', '22oz'] },
    { label: 'Temperature', attribute: 'Temp', values: ['Iced', 'Hot'] },
  ],
  'clothing-apparel': [
    { label: 'Apparel Sizes', attribute: 'Size', values: ['S', 'M', 'L', 'XL'] },
    { label: 'Colorways', attribute: 'Color', values: ['Ivory', 'Charcoal'] },
  ],
  'footwear-shoes': [
    { label: 'US Footwear Sizes', attribute: 'Size', values: ['US 8', 'US 9', 'US 10', 'US 11'] },
  ],
  'gadgets-accessories': [
    { label: 'Switch / Edition', attribute: 'Edition', values: ['Standard', 'Pro Edition'] },
    { label: 'Color Finish', attribute: 'Finish', values: ['Matte Black', 'Silver'] },
  ],
  'food-bistro-pro': [
    { label: 'Tasting Portion', attribute: 'Portion', values: ['Solo Course', 'Table Share'] },
    { label: 'Cooking Prep', attribute: 'Doneness', values: ['Medium Rare', 'Medium', 'Well'] },
  ],
  'cafe-atelier-pro': [
    { label: 'Preparation', attribute: 'Style', values: ['Iced 12oz', 'Hot Carafe'] },
    { label: 'Milk Base', attribute: 'Milk', values: ['Oat Milk', 'Whole Dairy'] },
  ],
  'clothing-editorial-pro': [
    { label: 'Maison Sizing', attribute: 'Size', values: ['XS', 'S', 'M', 'L'] },
    { label: 'Fabric Tone', attribute: 'Tone', values: ['Ecru', 'Obsidian'] },
  ],
  'footwear-studio-pro': [
    { label: 'US Footwear Sizes', attribute: 'Size', values: ['US 8', 'US 9', 'US 10', 'US 11'] },
  ],
  'gadgets-flagship-pro': [
    { label: 'Switch Profile', attribute: 'Edition', values: ['Linear Obsidian', 'Tactile'] },
    { label: 'Chassis Finish', attribute: 'Finish', values: ['Anodized Slate', 'Silver'] },
  ],
};

function generateSku(name: string): string {
  const clean = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
  const rand = Math.floor(100 + Math.random() * 899);
  return `${clean || 'PRD'}-${rand}`;
}

export function ProductEditorDrawer({
  isOpen,
  templateId,
  currency,
  editingProduct,
  onClose,
  onSave,
}: ProductEditorDrawerProps) {
  useBodyScrollLock(isOpen);

  const templateMeta = INDUSTRY_TEMPLATES[templateId];
  const recommendedCategories = templateMeta.recommendedCategories;
  const currencySymbol = getCurrencySymbol(currency);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nameFieldRef = useRef<HTMLDivElement | null>(null);
  const basePriceFieldRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const basePriceInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(recommendedCategories[0] ?? 'Featured');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState('20');
  const [imageUrl, setImageUrl] = useState('');

  // Smart Pricing state
  const [basePrice, setBasePrice] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [costPrice, setCostPrice] = useState('');

  // Variants & toggles
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; basePrice?: string }>({});
  const [shakeFields, setShakeFields] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFieldErrors({});
    setShakeFields(false);

    if (editingProduct) {
      setName(editingProduct.name);
      setDescription(editingProduct.description);
      setCategory(editingProduct.category);
      setSku(editingProduct.sku);
      setStock(String(editingProduct.stock));
      setImageUrl(editingProduct.imageUrl ?? '');
      setBasePrice(String(editingProduct.basePrice));

      const resolvedDiscountType: DiscountType =
        editingProduct.discountType ??
        (editingProduct.discountPercent > 0 ? 'percentage' : 'none');
      const resolvedDiscountValue =
        editingProduct.discountValue ??
        (resolvedDiscountType === 'percentage' ? editingProduct.discountPercent : 0);

      setDiscountType(resolvedDiscountType);
      setDiscountValue(String(resolvedDiscountValue));
      setCostPrice(
        editingProduct.costPrice !== undefined ? String(editingProduct.costPrice) : ''
      );
      setVariants(editingProduct.variants ?? []);
      setIsAvailable(editingProduct.isAvailable);
      setIsFeatured(editingProduct.isFeatured);
    } else {
      setName('');
      setDescription('');
      setCategory(recommendedCategories[0] ?? 'General');
      setSku('');
      setStock('25');
      setImageUrl(TEMPLATE_SHOWCASE_MEDIA[templateId].imageUrl);
      setBasePrice('');
      setDiscountType('none');
      setDiscountValue('0');
      setCostPrice('');
      setVariants([]);
      setIsAvailable(true);
      setIsFeatured(false);
    }
  }, [isOpen, editingProduct, templateId, recommendedCategories]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const numericBase = parseFloat(basePrice) || 0;
  const numericDiscount = parseFloat(discountValue) || 0;
  const parsedCost = costPrice.trim() !== '' ? parseFloat(costPrice) : undefined;
  const validCost =
    parsedCost !== undefined && Number.isFinite(parsedCost) && parsedCost >= 0
      ? parsedCost
      : undefined;

  const pricingPreview = useMemo(
    () =>
      calculateSmartPricing({
        basePrice: numericBase,
        discountType,
        discountValue: discountType === 'none' ? 0 : numericDiscount,
        costPrice: validCost,
      }),
    [numericBase, discountType, numericDiscount, validCost]
  );

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyVariantPreset = (attribute: string, values: string[]) => {
    const nextRows: ProductVariant[] = values.map((val, idx) => ({
      id: `var_${Date.now()}_${idx}`,
      label: val,
      attributeName: attribute,
      value: val,
      priceDelta: 0,
      stock: Math.max(5, Math.floor((parseInt(stock, 10) || 20) / values.length)),
    }));
    setVariants(nextRows);
  };

  const handleAddVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `var_${Date.now()}_${prev.length}`,
        label: '',
        attributeName: 'Option',
        value: '',
        priceDelta: 0,
        stock: 10,
      },
    ]);
  };

  const handleUpdateVariant = (
    id: string,
    patch: Partial<ProductVariant>
  ) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              ...patch,
              value: patch.label !== undefined ? patch.label : v.value,
            }
          : v
      )
    );
  };

  const handleRemoveVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const triggerShake = () => {
    setShakeFields(false);
    window.requestAnimationFrame(() => {
      setShakeFields(true);
      window.setTimeout(() => setShakeFields(false), 420);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { name?: string; basePrice?: string } = {};

    if (name.trim().length < 2) {
      nextErrors.name = 'Please enter a product name (at least 2 characters).';
    }
    if (!Number.isFinite(numericBase) || numericBase <= 0) {
      nextErrors.basePrice = 'Please enter a regular selling price greater than 0.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      triggerShake();
      const firstContainer = nextErrors.name ? nameFieldRef.current : basePriceFieldRef.current;
      const firstInput = nextErrors.name ? nameInputRef.current : basePriceInputRef.current;
      firstContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        firstInput?.focus({ preventScroll: true });
      }, 220);
      return;
    }

    const cleanedVariants = variants
      .filter((v) => v.label.trim().length > 0)
      .map((v) => ({
        ...v,
        label: v.label.trim(),
        value: v.label.trim(),
        attributeName: v.attributeName.trim() || 'Option',
      }));

    onSave({
      name: name.trim(),
      description: description.trim() || `${name.trim()} — ${category.trim()}`,
      category: category.trim() || recommendedCategories[0] || 'General',
      basePrice: numericBase,
      discountType,
      discountValue: discountType === 'none' ? 0 : numericDiscount,
      costPrice: validCost,
      sku: sku.trim() || generateSku(name),
      stock: Math.max(0, parseInt(stock, 10) || 0),
      imageUrl: imageUrl || undefined,
      variants: cleanedVariants,
      isFeatured,
      isAvailable,
    });
  };

  const templateVariantPresets = VARIANT_PRESETS_BY_TEMPLATE[templateId] ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editingProduct ? `Edit ${editingProduct.name}` : 'Add New Product'}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl border-l border-slate-200/80">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <p className="text-xs text-slate-500">
              {templateMeta.name} catalog item · Auto-calculated pricing &amp; margins
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="w-9 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Product Image Uploader + Presets */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Product Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-28 h-24 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-[11px] font-medium text-slate-500">
                  Quick preset images by category:
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {INDUSTRY_TEMPLATE_LIST.map((tpl) => {
                    const presetSrc = TEMPLATE_SHOWCASE_MEDIA[tpl.id].imageUrl;
                    const active = imageUrl === presetSrc;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setImageUrl(presetSrc)}
                        title={tpl.name}
                        className={`relative aspect-square rounded-lg overflow-hidden border cursor-pointer ${
                          active ? 'border-slate-900 ring-2 ring-slate-900' : 'border-slate-200'
                        }`}
                      >
                        <img
                          src={presetSrc}
                          alt={tpl.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Basic Product Info */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <div
              ref={nameFieldRef}
              className={`space-y-1.5 ${fieldErrors.name && shakeFields ? 'auth-shake' : ''}`}
            >
              <label htmlFor="prd-name" className="block text-xs font-semibold text-slate-700">
                Product Name
              </label>
              <input
                ref={nameInputRef}
                id="prd-name"
                type="text"
                value={name}
                aria-invalid={Boolean(fieldErrors.name)}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="e.g. Spanish Oat Cortado"
                className={`w-full min-h-[42px] px-3.5 py-2 text-sm bg-white border rounded-xl outline-none focus:ring-4 transition-all ${
                  fieldErrors.name
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                }`}
              />
              {fieldErrors.name && (
                <p className="text-xs text-rose-600 font-medium mt-1 ml-0.5">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prd-desc" className="block text-xs font-semibold text-slate-700">
                Description
              </label>
              <textarea
                id="prd-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief details about ingredients, fit, or specs..."
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="prd-category" className="block text-xs font-semibold text-slate-700">
                  Category Tag
                </label>
                <input
                  id="prd-category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Espresso Bar"
                  className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prd-stock" className="block text-xs font-semibold text-slate-700">
                  Stock Qty
                </label>
                <input
                  id="prd-stock"
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full min-h-[40px] px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {recommendedCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                    category === cat
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Smart Auto-Calculated Pricing Engine */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Smart Auto-Calculated Pricing</h3>
              <span className="text-xs font-mono text-slate-500">Live math</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                ref={basePriceFieldRef}
                className={`space-y-1.5 ${fieldErrors.basePrice && shakeFields ? 'auth-shake' : ''}`}
              >
                <label htmlFor="prd-base-price" className="block text-xs font-semibold text-slate-700">
                  Base / Regular Price ({currencySymbol})
                </label>
                <input
                  ref={basePriceInputRef}
                  id="prd-base-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basePrice}
                  aria-invalid={Boolean(fieldErrors.basePrice)}
                  onChange={(e) => {
                    setBasePrice(e.target.value);
                    if (fieldErrors.basePrice) {
                      setFieldErrors((prev) => ({ ...prev, basePrice: undefined }));
                    }
                  }}
                  placeholder="0.00"
                  className={`w-full min-h-[42px] px-3.5 py-2 text-sm font-mono tabular-nums bg-white border rounded-xl outline-none focus:ring-4 transition-all ${
                    fieldErrors.basePrice
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900/10'
                  }`}
                />
                {fieldErrors.basePrice && (
                  <p className="text-xs text-rose-600 font-medium mt-1 ml-0.5">
                    {fieldErrors.basePrice}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prd-cost-price" className="block text-xs font-semibold text-slate-700">
                  Cost Price ({currencySymbol}) <span className="font-normal text-slate-400">Optional</span>
                </label>
                <input
                  id="prd-cost-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="e.g. 95.00"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700">Discount Type</span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                  {(
                    [
                      { id: 'none', label: 'None' },
                      { id: 'percentage', label: '% Off' },
                      { id: 'fixed', label: `${currencySymbol} Fixed` },
                    ] as const
                  ).map((dt) => (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={() => setDiscountType(dt.id)}
                      className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        discountType === dt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prd-discount-val" className="block text-xs font-semibold text-slate-700">
                  {discountType === 'percentage'
                    ? 'Discount Percentage (%)'
                    : discountType === 'fixed'
                      ? `Discount Amount (${currencySymbol})`
                      : 'Discount Value'}
                </label>
                <input
                  id="prd-discount-val"
                  type="number"
                  min={0}
                  max={discountType === 'percentage' ? 95 : undefined}
                  step="0.01"
                  disabled={discountType === 'none'}
                  value={discountType === 'none' ? '0' : discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Live Auto-Calculated Readout Strip */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] text-slate-300">Final Selling Price</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  {formatCurrency(pricingPreview.finalPrice, currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-300">Customer Savings</p>
                <p className="text-base font-bold tabular-nums mt-1 text-emerald-400">
                  {pricingPreview.customerSavings > 0
                    ? `${formatCurrency(pricingPreview.customerSavings, currency)} (${pricingPreview.effectiveDiscountPercent}%)`
                    : 'No discount'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-300">Est. Profit Margin</p>
                <p
                  className={`text-base font-bold tabular-nums mt-1 ${
                    pricingPreview.profitAmount === null
                      ? 'text-slate-400'
                      : pricingPreview.profitAmount >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                  }`}
                >
                  {pricingPreview.profitAmount !== null
                    ? `${formatCurrency(pricingPreview.profitAmount, currency)} (${pricingPreview.profitMarginPercent}%)`
                    : 'Enter cost price'}
                </p>
              </div>
            </div>
          </section>

          {/* Variants / Options Builder */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Variants &amp; Add-ons</h3>
                <p className="text-xs text-slate-500">
                  Add sizes, cup options, or upgrades with optional price adjustments.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVariantRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Option
              </button>
            </div>

            {templateVariantPresets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-500">Quick presets:</span>
                {templateVariantPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleApplyVariantPreset(preset.attribute, preset.values)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    + {preset.label} ({preset.values.join(', ')})
                  </button>
                ))}
              </div>
            )}

            {variants.length > 0 && (
              <div className="space-y-2">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 p-2.5 rounded-xl"
                  >
                    <input
                      type="text"
                      aria-label="Option Label"
                      value={variant.label}
                      onChange={(e) =>
                        handleUpdateVariant(variant.id, { label: e.target.value })
                      }
                      placeholder="e.g. 16oz / Large"
                      className="col-span-5 min-h-[36px] px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <div className="col-span-3 relative">
                      <input
                        type="number"
                        aria-label="Price Adjustment"
                        value={variant.priceDelta}
                        onChange={(e) =>
                          handleUpdateVariant(variant.id, {
                            priceDelta: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="+0"
                        className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <input
                      type="number"
                      min={0}
                      aria-label="Variant Stock"
                      value={variant.stock}
                      onChange={(e) =>
                        handleUpdateVariant(variant.id, {
                          stock: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      placeholder="Qty"
                      className="col-span-3 min-h-[36px] px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(variant.id)}
                      aria-label="Remove variant"
                      className="col-span-1 h-9 flex items-center justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SKU & Availability Toggles */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <div className="space-y-1.5">
              <label htmlFor="prd-sku" className="block text-xs font-semibold text-slate-700">
                SKU Code <span className="font-normal text-slate-400">Auto-generated if blank</span>
              </label>
              <input
                id="prd-sku"
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. BC-ESP-001"
                className="w-full min-h-[40px] px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isAvailable}
                onClick={() => setIsAvailable((prev) => !prev)}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  isAvailable
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {isAvailable ? 'In Stock' : 'Sold Out'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {isAvailable ? 'Visible for customers to buy' : 'Marked sold out on storefront'}
                  </p>
                </div>
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    isAvailable ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={isFeatured}
                onClick={() => setIsFeatured((prev) => !prev)}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  isFeatured
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Featured / Bestseller</p>
                  <p className="text-[11px] text-slate-600">
                    Highlight in top storefront slots
                  </p>
                </div>
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    isFeatured ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          </section>

          {/* Drawer Footer */}
          <div className="pt-4 border-t border-slate-200/80 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              {editingProduct ? 'Save Product' : 'Add Product to Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
