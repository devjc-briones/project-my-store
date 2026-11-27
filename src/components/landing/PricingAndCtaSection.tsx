import { ArrowRight, Check } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { getPlatformPlans } from '../../data/plans';

export function PricingAndCtaSection() {
  const { navigate, proMonthlyPrice } = useStore();
  const plans = getPlatformPlans(proMonthlyPrice);

  return (
    <>
      <section id="pricing" className="bg-slate-50 border-b border-slate-200/80 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold tracking-wide text-slate-500 mb-2">Pricing</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Start free with your first storefront, scale as your brands grow.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl p-6 sm:p-8 flex flex-col justify-between border ${
                  plan.featured
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                    : 'bg-white text-slate-900 border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
                }`}
              >
                <div>
                  <div className="mb-6">
                    <p
                      className={`text-xs font-medium ${
                        plan.featured ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {plan.audience}
                    </p>
                    <h3 className="text-xl font-bold mt-1">{plan.name}</h3>
                  </div>

                  <div className="flex items-baseline gap-2 pb-6 border-b border-current/15">
                    <span className="text-3xl font-extrabold tabular-nums">{plan.priceLabel}</span>
                    <span
                      className={`text-xs ${
                        plan.featured ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {plan.cadence}
                    </span>
                  </div>

                  <ul className="space-y-3 py-6 text-sm">
                    {plan.highlights.map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            plan.featured ? 'text-emerald-400' : 'text-slate-700'
                          }`}
                        />
                        <span className={plan.featured ? 'text-slate-200' : 'text-slate-600'}>
                          {line}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => navigate({ name: 'login', mode: 'signup' })}
                  className={`w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    plan.featured
                      ? 'bg-white text-slate-900 hover:bg-slate-100'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {plan.landingCta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Conversion Banner */}
      <section className="bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl shadow-slate-900/10">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight [text-wrap:balance]">
                Claim your store link and publish today.
              </h2>
              <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
                Reserve <span className="font-mono text-white">mystore.com/your-brand</span>, pick
                an industry layout, and launch your catalog with zero code.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigate({ name: 'login', mode: 'signup' })}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Create Your Free Store
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
