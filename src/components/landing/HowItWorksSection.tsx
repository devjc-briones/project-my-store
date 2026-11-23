import { Paintbrush, Share2, LayoutTemplate } from 'lucide-react';

const STEPS = [
  {
    index: '01.',
    title: 'Pick from 5 tailored store templates',
    description:
      'Choose a proven layout engineered for your category—Food & Restaurant, Cafe & Drinks, Clothing, Footwear, or Gadgets. Structure is handled for you.',
    icon: LayoutTemplate,
  },
  {
    index: '02.',
    title: 'Customize your brand, banner, and products',
    description:
      'Apply your colors, font pairing, logo, announcement bar, and product catalog with automatic discount calculations and variant stock.',
    icon: Paintbrush,
  },
  {
    index: '03.',
    title: 'Share your store link and accept orders',
    description:
      'Publish immediately to your dedicated link at mystore.com/your-brand with Cash on Delivery, GCash, Maya, or Card ready at checkout.',
    icon: Share2,
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-slate-50 border-b border-slate-200/80 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold tracking-wide text-slate-500 mb-2">How It Works</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Three structured steps from sign-up to live storefront.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.index}
                className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm font-mono font-semibold text-slate-500 tabular-nums">
                      {step.index}
                    </span>
                    <div className="w-9 h-9 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
