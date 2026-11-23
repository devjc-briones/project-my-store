import { useEffect, useState } from 'react';
import { MystoreAnimatedLogo } from '../common/MystoreAnimatedLogo';
import {
  ArrowRight,
  ChevronRight,
  CreditCard,
  Layers,
  LayoutTemplate,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const NAV_LINKS = [
  { label: 'Features', targetId: 'features', icon: Sparkles },
  { label: 'Templates', targetId: 'templates', icon: LayoutTemplate },
  { label: 'How It Works', targetId: 'how-it-works', icon: Layers },
  { label: 'Pricing', targetId: 'pricing', icon: CreditCard },
] as const;

export function LandingNavbar() {
  const { navigate } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('features');

  useBodyScrollLock(mobileMenuOpen);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleSectionScroll = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  };

  const handleScrollTop = () => {
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  };

  const handleAuthNavigate = (mode: 'signin' | 'signup') => {
    setMobileMenuOpen(false);
    navigate({ name: 'login', mode });
  };

  return (
    <>
      {/* Single Fixed Top Navbar (z-50) with Morphing Burger-to-X Button */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-6">
          {/* Zone 1: Animated Logo */}
          <button
            type="button"
            onClick={handleScrollTop}
            className="cursor-pointer touch-manipulation py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg"
            aria-label="mystore home"
          >
            <MystoreAnimatedLogo />
          </button>

          {/* Zone 2: Clean single-line text links (Desktop) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            {NAV_LINKS.map((item) => (
              <button
                key={item.targetId}
                type="button"
                onClick={() => handleSectionScroll(item.targetId)}
                className="hover:text-slate-900 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer py-1 border-b border-transparent hover:border-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-sm"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Sign In + Get Started + Morphing Burger-to-X Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleAuthNavigate('signin')}
              className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleAuthNavigate('signup')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              Get Started
            </button>

            {/* Animated 3-Line Burger -> X Button (stays on top at z-50, never duplicated) */}
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className={`md:hidden relative z-50 w-11 h-11 rounded-xl flex flex-col items-center justify-center bg-slate-100/90 hover:bg-slate-200/80 active:scale-95 transition-all duration-200 cursor-pointer touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                mobileMenuOpen ? 'menu-open bg-slate-200/80' : ''
              }`}
            >
              <span className="sr-only">{mobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
              <div className="w-5 h-4 flex flex-col justify-between items-center pointer-events-none">
                <span className="burger-line line-1 block w-5 h-[2px] rounded-full bg-slate-800" />
                <span className="burger-line line-2 block w-5 h-[2px] rounded-full bg-slate-800" />
                <span className="burger-line line-3 block w-5 h-[2px] rounded-full bg-slate-800" />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Spacer matching fixed header height */}
      <div className="h-16 shrink-0" aria-hidden="true" />

      {/* Dimmed Backdrop Overlay */}
      <div
        aria-hidden="true"
        onClick={() => setMobileMenuOpen(false)}
        className={`md:hidden fixed inset-0 z-40 bg-slate-950/40 touch-none transition-opacity duration-300 ease-out ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Floating Rounded Mobile Menu Card (matches reference slide/scale + staggered reveal) */}
      <aside
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileMenuOpen}
        aria-label="Mobile Navigation"
        className={`md:hidden fixed top-[4.5rem] left-3 right-3 sm:mx-auto sm:max-w-md z-[45] rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl shadow-slate-900/15 p-5 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileMenuOpen
            ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto drawer-active'
            : '-translate-y-4 scale-[0.97] opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b border-slate-100">
          <span className="text-xs font-semibold tracking-wider text-slate-400">Navigation</span>
          <span className="text-xs font-medium text-slate-500">mystore</span>
        </div>

        <nav className="flex flex-col gap-1.5">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.targetId;
            return (
              <button
                key={item.targetId}
                type="button"
                onClick={() => handleSectionScroll(item.targetId)}
                className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-base transition-colors cursor-pointer touch-manipulation ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                  {item.label}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            );
          })}

          <div className="nav-item-stagger mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleAuthNavigate('signin')}
              className="w-full min-h-[46px] py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 font-semibold text-sm transition-all cursor-pointer touch-manipulation"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleAuthNavigate('signup')}
              className="w-full min-h-[46px] py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-sm shadow-lg shadow-slate-900/15 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
