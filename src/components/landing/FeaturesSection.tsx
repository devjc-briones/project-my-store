import { useState } from 'react';
import { Calculator, CreditCard, Link2, Smartphone, Sliders } from 'lucide-react';
import { buildStoreDomainUrl, slugifyStoreName } from '../../utils/domain';
import { calculateFinalPrice, formatCurrency } from '../../utils/pricing';

export function FeaturesSection() {
  const [brandInput, setBrandInput] = useState('Brew Cafe');
  const [samplePrice, setSamplePrice] = useState(1250);
  const [sampleDiscount, setSampleDiscount] = useState(15);

  const generatedSlug = slugifyStoreName(brandInput) || 'your-brand';
  const generatedDomain = buildStoreDomainUrl(generatedSlug);
  const discountedPrice = calculateFinalPrice(samplePrice, sampleDiscount);

  return (
    <section id="features" className="bg-slate-50 border-b border-slate-200/80 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold tracking-wide text-slate-500 mb-2">
            Platform Capabilities
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Everything required to run an online storefront, built into one workspace.
          </h2>
        </div>

        {/* Asymmetric Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 (2-col span): Instant Link Sharing */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1.5">
                  Instant Subpath Link Sharing
                </h3>
                <p className="text-sm text-slate-600 max-w-lg leading-relaxed">
                  Every store receives a clean, collision-checked URL ready for Instagram bios,
                  WhatsApp messages, and QR standees the moment you hit publish.
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <label htmlFor="demo-brand-input" className="sr-only">
                Test your store name
              </label>
              <input
                id="demo-brand-input"
                type="text"
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                placeholder="Type your store name..."
                className="flex-1 min-w-0 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200/80 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <div className="px-3.5 py-2 bg-slate-900 text-white rounded-md text-xs sm:text-sm font-mono truncate">
                {generatedDomain}
              </div>
            </div>
          </div>

          {/* Feature 2: Mobile-Ready Storefronts */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1.5">
                Mobile-First Storefronts
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Over 80% of social-commerce buyers shop on phones. Every template adapts cleanly
                from thumb-friendly mobile menus to widescreen desktop grids.
              </p>
            </div>
          </div>

          {/* Feature 3: Auto-Calculated Pricing & Promos */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Auto-Calculated Promos
              </h3>
              <div className="w-8 h-8 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                <Calculator className="w-4 h-4" />
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Enter a base price and discount percentage—final selling prices and strike-through
              savings update across your catalog automatically.
            </p>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="promo-price" className="text-slate-600">
                  Base Price (₱)
                </label>
                <input
                  id="promo-price"
                  type="number"
                  min={0}
                  value={samplePrice}
                  onChange={(e) => setSamplePrice(Math.max(0, Number(e.target.value)))}
                  className="w-24 px-2 py-1 text-right font-mono tabular-nums bg-white border border-slate-200/80 rounded"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="promo-discount" className="text-slate-600">
                  Discount (%)
                </label>
                <input
                  id="promo-discount"
                  type="number"
                  min={0}
                  max={90}
                  value={sampleDiscount}
                  onChange={(e) => setSampleDiscount(Math.min(90, Math.max(0, Number(e.target.value))))}
                  className="w-24 px-2 py-1 text-right font-mono tabular-nums bg-white border border-slate-200/80 rounded"
                />
              </div>
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between font-semibold text-slate-900 tabular-nums">
                <span>Live Final Price</span>
                <span>{formatCurrency(discountedPrice, 'PHP')}</span>
              </div>
            </div>
          </div>

          {/* Feature 4: Easy Payment Setup */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1.5">
                Flexible Payment Setup
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Toggle Cash on Delivery, GCash, Maya, Bank Transfer, and Card checkout per store,
                complete with shipping fees and free-delivery thresholds.
              </p>
            </div>
          </div>

          {/* Feature 5: Zero Coding Required */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1.5">
                Zero Coding, Multi-Store Ready
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Manage multiple brands from a single merchant dashboard. Switch stores, preview live
                changes, and toggle draft or published visibility anytime.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
