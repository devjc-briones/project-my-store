import { useState } from 'react';
import { ArrowRight, Crown, Globe } from 'lucide-react';
import {
  FREE_TEMPLATE_LIST,
  INDUSTRY_TEMPLATES,
  PRO_TEMPLATE_LIST,
} from '../../data/templates';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { IndustryTemplateId } from '../../types/schema';
import { calculateFinalPrice, formatCurrency } from '../../utils/pricing';
import { useStore } from '../../context/StoreContext';

export function TemplatesShowcaseSection() {
  const { navigate } = useStore();
  const [tierFilter, setTierFilter] = useState<'free' | 'pro'>('free');
  const [selectedId, setSelectedId] = useState<IndustryTemplateId>('food-restaurant');

  const visibleTemplates = tierFilter === 'pro' ? PRO_TEMPLATE_LIST : FREE_TEMPLATE_LIST;
  const activeTemplate = INDUSTRY_TEMPLATES[selectedId];
  const activeMedia = TEMPLATE_SHOWCASE_MEDIA[selectedId];

  const handleSwitchTier = (nextTier: 'free' | 'pro') => {
    setTierFilter(nextTier);
    const list = nextTier === 'pro' ? PRO_TEMPLATE_LIST : FREE_TEMPLATE_LIST;
    if (list[0]) {
      setSelectedId(list[0].id);
    }
  };

  return (
    <section id="templates" className="bg-slate-50 border-b border-slate-200/80 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-slate-500 mb-2">
              10 Industry Templates · 5 Free + 5 Pro
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Purpose-built storefront designs tailored to what you actually sell.
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 bg-white border border-slate-200/80 rounded-xl w-fit shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <button
              type="button"
              onClick={() => handleSwitchTier('free')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tierFilter === 'free'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Free Layouts (5)
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTier('pro')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tierFilter === 'pro'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Pro Layouts (5)</span>
            </button>
          </div>
        </div>

        {/* Interactive Industry Tabs */}
        <div
          role="tablist"
          aria-label="Store Industry Templates"
          className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200/80 rounded-xl overflow-x-auto mb-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          {visibleTemplates.map((tpl) => {
            const isActive = tpl.id === selectedId;
            return (
              <button
                key={tpl.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setSelectedId(tpl.id)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tpl.name}
              </button>
            );
          })}
        </div>

        {/* Selected Template Interactive Preview */}
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Visual Media Column */}
          <div className="lg:col-span-7 relative bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-600 truncate">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">mystore.com/{activeMedia.sampleSlug}</span>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                {activeTemplate.categoryLabel} · {activeTemplate.tier === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>

            <div className="aspect-[4/3] lg:aspect-auto lg:flex-1 w-full overflow-hidden bg-slate-200 relative">
              <img
                src={activeMedia.imageUrl}
                alt={`${activeTemplate.name} storefront preview`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 sm:p-6">
                <p className="text-xs font-medium text-white/80 mb-1">
                  {activeTemplate.defaultBranding.logoText}
                </p>
                <p className="text-lg sm:text-xl font-bold text-white leading-snug">
                  {activeTemplate.defaultBranding.heroTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Details & Live Item Preview Column */}
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div>
                <p className="text-xs text-slate-500 mb-1">
                  {activeTemplate.categoryLabel}
                  {activeTemplate.tier === 'pro' && (
                    <span className="ml-2 font-semibold text-amber-700">· Pro Exclusive</span>
                  )}
                </p>
                <h3 className="text-xl font-bold text-slate-900">{activeTemplate.name}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {activeTemplate.layoutSummary}
                </p>
              </div>

              <div className="text-xs text-slate-500 border-t border-b border-slate-200 py-3">
                <span className="font-medium text-slate-700">Categories: </span>
                {activeTemplate.recommendedCategories.join(' · ')}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-3">Sample Storefront Items</p>
                <div className="divide-y divide-slate-200/80 border border-slate-200/80 rounded-xl overflow-hidden">
                  {activeMedia.sampleItems.map((item) => {
                    const finalPrice = calculateFinalPrice(item.basePrice, item.discountPercent);
                    return (
                      <div
                        key={item.name}
                        className="px-4 py-3 flex items-center justify-between gap-3 bg-white"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 truncate">{item.variantHint}</p>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(finalPrice, 'PHP')}
                          </p>
                          {item.discountPercent > 0 && (
                            <p className="text-xs text-slate-400 line-through">
                              {formatCurrency(item.basePrice, 'PHP')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Default palette:</span>
                <span
                  className="w-4 h-4 rounded-full border border-slate-300"
                  style={{ backgroundColor: activeTemplate.defaultBranding.primaryColor }}
                  title="Primary color"
                />
                <span
                  className="w-4 h-4 rounded-full border border-slate-300"
                  style={{ backgroundColor: activeTemplate.defaultBranding.accentColor }}
                  title="Accent color"
                />
                <span
                  className="w-4 h-4 rounded-full border border-slate-300"
                  style={{ backgroundColor: activeTemplate.defaultBranding.surfaceColor }}
                  title="Surface color"
                />
              </div>

              <button
                type="button"
                onClick={() => navigate({ name: 'login', mode: 'signup' })}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Use {activeTemplate.name}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
