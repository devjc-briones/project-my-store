import { useState } from 'react';
import { ArrowRight, ExternalLink, ShoppingBag, Store } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { INDUSTRY_TEMPLATES } from '../../data/templates';
import { calculateFinalPrice, formatCurrency } from '../../utils/pricing';

type PreviewKey = 'cafe-drinks' | 'footwear-shoes';

export function HeroSection() {
  const { navigate } = useStore();
  const [activePreview, setActivePreview] = useState<PreviewKey>('cafe-drinks');
  const [bagCount, setBagCount] = useState(2);

  const previewTemplate = INDUSTRY_TEMPLATES[activePreview];
  const previewMedia = TEMPLATE_SHOWCASE_MEDIA[activePreview];

  const handleExploreTemplates = () => {
    const el = document.getElementById('templates');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="bg-gradient-to-b from-slate-100/70 via-slate-50 to-slate-50 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Copy Column */}
          <div className="lg:col-span-6 space-y-6">
            <p className="text-xs font-medium tracking-wide text-slate-600">
              Multi-tenant storefront builder · Instant subpath links at mystore.com/your-brand
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-slate-900 leading-[1.1] [text-wrap:balance]">
              Launch a ready-to-sell online store in under 5 minutes.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Pick one of five purpose-built industry layouts, apply your brand palette and banner,
              add products with automatic promo math, and publish directly to your own storefront URL.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate({ name: 'login', mode: 'signup' })}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                Create Your Free Store
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleExploreTemplates}
                className="inline-flex items-center justify-center min-h-[46px] px-5 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 hover:text-slate-900 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Explore Templates
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">5</p>
                <p className="text-xs text-slate-500 mt-0.5">Industry layouts</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">&lt; 5 min</p>
                <p className="text-xs text-slate-500 mt-0.5">Setup to publish</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">₱0</p>
                <p className="text-xs text-slate-500 mt-0.5">To launch first store</p>
              </div>
            </div>
          </div>

          {/* Right Visual Mockup: Merchant Dashboard + Live Mobile Storefront */}
          <div className="lg:col-span-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              {/* Mockup Switcher Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-600 truncate">
                  <Store className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="truncate">mystore.com/{previewMedia.sampleSlug}</span>
                </div>

                <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActivePreview('cafe-drinks')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activePreview === 'cafe-drinks'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Brew Cafe
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreview('footwear-shoes')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activePreview === 'footwear-shoes'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Stride Kicks
                  </button>
                </div>
              </div>

              {/* Dual View: Compact Dashboard Table + Mobile Storefront Frame */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-4 items-stretch">
                {/* Merchant Dashboard Side */}
                <div className="sm:col-span-7 flex flex-col justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-xs text-slate-500">Merchant Workspace</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {previewTemplate.defaultBranding.logoText} Catalog
                        </p>
                      </div>
                      <span className="text-xs font-medium text-emerald-700">Published</span>
                    </div>

                    <div className="divide-y divide-slate-200/80 border-t border-b border-slate-200/80 bg-white rounded-lg overflow-hidden">
                      {previewMedia.sampleItems.map((item) => {
                        const finalPrice = calculateFinalPrice(item.basePrice, item.discountPercent);
                        return (
                          <div
                            key={item.name}
                            className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{item.name}</p>
                              <p className="text-slate-500 truncate">{item.category}</p>
                            </div>
                            <div className="text-right shrink-0 tabular-nums">
                              <p className="font-semibold text-slate-900">
                                {formatCurrency(finalPrice, 'PHP')}
                              </p>
                              {item.discountPercent > 0 && (
                                <p className="text-[11px] text-emerald-700">
                                  -{item.discountPercent}% promo
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span>COD, GCash, Maya & Card</span>
                    <button
                      type="button"
                      onClick={() => navigate({ name: 'login' })}
                      className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline cursor-pointer"
                    >
                      Customize
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Mobile Storefront Frame */}
                <div
                  className="sm:col-span-5 border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  style={{ backgroundColor: previewTemplate.defaultBranding.surfaceColor }}
                >
                  <div>
                    <div
                      className="announcement-marquee-track w-full overflow-hidden py-1.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: previewTemplate.defaultBranding.primaryColor }}
                    >
                      <div className="flex w-full overflow-hidden">
                        <div className="announcement-marquee-item shrink-0 min-w-full flex items-center justify-center px-4 whitespace-nowrap">
                          <span>{previewTemplate.defaultBranding.announcementText}</span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="announcement-marquee-item announcement-marquee-duplicate shrink-0 min-w-full flex items-center justify-center px-4 whitespace-nowrap"
                        >
                          <span>{previewTemplate.defaultBranding.announcementText}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 flex items-center justify-between border-b border-black/10">
                      <span
                        className="text-xs font-bold tracking-tight truncate"
                        style={{ color: previewTemplate.defaultBranding.textColor }}
                      >
                        {previewTemplate.defaultBranding.logoText}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBagCount((c) => c + 1)}
                        aria-label="Add sample item to bag"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-white/80 text-slate-900 border border-black/10 cursor-pointer"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span className="tabular-nums">{bagCount}</span>
                      </button>
                    </div>

                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                      <img
                        src={previewMedia.imageUrl}
                        alt={`${previewTemplate.name} mobile storefront preview`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="p-3 space-y-1.5">
                      <p
                        className="text-xs font-bold leading-snug line-clamp-2"
                        style={{ color: previewTemplate.defaultBranding.textColor }}
                      >
                        {previewTemplate.defaultBranding.heroTitle}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-600 tabular-nums">
                          From {formatCurrency(calculateFinalPrice(previewMedia.sampleItems[0].basePrice, previewMedia.sampleItems[0].discountPercent), 'PHP')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setBagCount((c) => c + 1)}
                          className="text-[11px] font-semibold text-white px-2.5 py-1 rounded cursor-pointer"
                          style={{ backgroundColor: previewTemplate.defaultBranding.accentColor }}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
