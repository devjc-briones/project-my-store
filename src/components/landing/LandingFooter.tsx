import { useStore } from '../../context/StoreContext';

export function LandingFooter() {
  const { navigate } = useStore();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="bg-slate-50 border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">mystore</span>
          <p className="text-xs text-slate-500 mt-1">
            Multi-tenant online storefront builder · mystore.com/your-brand
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => scrollTo('features')}
            className="hover:text-slate-900 cursor-pointer"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => scrollTo('templates')}
            className="hover:text-slate-900 cursor-pointer"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => scrollTo('how-it-works')}
            className="hover:text-slate-900 cursor-pointer"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => scrollTo('pricing')}
            className="hover:text-slate-900 cursor-pointer"
          >
            Pricing
          </button>
          <button
            type="button"
            onClick={() => navigate({ name: 'login' })}
            className="hover:text-slate-900 cursor-pointer"
          >
            Merchant Sign In
          </button>
        </div>

        <p className="text-xs text-slate-500">© 2026 mystore. All rights reserved.</p>
      </div>
    </footer>
  );
}
