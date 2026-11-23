/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function MystoreAnimatedLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 select-none focus:outline-none group">
      {/* Custom Storefront SVG Icon with Gentle Lift Animation */}
      <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow-xs mystore-icon-motion">
        <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="navAwningGrad" x1="4" y1="6" x2="28" y2="15" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient id="navShopBodyGrad" x1="6" y1="15" x2="26" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
          </defs>
          {/* Storefront Awning */}
          <path d="M5.5 8.5C5.5 7.39543 6.39543 6.5 7.5 6.5H24.5C25.6046 6.5 26.5 7.39543 26.5 8.5L27.8 12.8C27.8 14.015 26.815 15 25.6 15C24.55 15 23.67 14.23 23.48 13.2C23.29 14.23 22.41 15 21.36 15C20.31 15 19.43 14.23 19.24 13.2C19.05 14.23 18.17 15 17.12 15H14.88C13.83 15 12.95 14.23 12.76 13.2C12.57 14.23 11.69 15 10.64 15C9.59 15 8.71 14.23 8.52 13.2C8.33 14.23 7.45 15 6.4 15C5.18497 15 4.2 14.015 4.2 12.8L5.5 8.5Z" fill="url(#navAwningGrad)" />
          {/* Storefront Base / Counter */}
          <path d="M7 16.5H25V24.5C25 25.3284 24.3284 26 23.5 26H8.5C7.67157 26 7 25.3284 7 24.5V16.5Z" fill="url(#navShopBodyGrad)" />
          {/* Door & Display Window Accent */}
          <rect x="10" y="19" width="5.5" height="4.5" rx="1" fill="#0F172A" fillOpacity="0.75" />
          <rect x="18" y="19" width="4" height="7" rx="0.8" fill="#2563EB" />
        </svg>
      </div>

      {/* Auto-Repeating Revealing "mystore" Wordmark */}
      <div className="relative overflow-hidden pr-1.5 py-1 flex items-center">
        <span className="mystore-reveal-text inline-block py-0.5 text-[19px] sm:text-[20px] font-extrabold tracking-tight leading-snug">
          <span className="text-slate-900">my</span><span className="text-[#1E3A8A]">store</span>
        </span>
        <span className="mystore-sweep-line" aria-hidden="true" />
      </div>
    </span>
  );
}
