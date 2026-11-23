import { useLayoutEffect } from 'react';

let activeLockCount = 0;
let savedScrollY = 0;
let prevStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  paddingRight: string;
  htmlOverflow: string;
  htmlOverscroll: string;
  bodyOverscroll: string;
} | null = null;

/**
 * Reusable scroll-lock hook for mobile menus, drawers, and modals.
 * Uses fixed-body anchoring and html/body overscroll locking to preserve exact
 * scroll position and prevent background scrolling reliably across Android Chrome,
 * iOS Safari, and desktop browsers.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useLayoutEffect(() => {
    if (!isLocked || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;

    if (activeLockCount === 0) {
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      const scrollbarWidth = window.innerWidth - html.clientWidth;

      prevStyles = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
        htmlOverflow: html.style.overflow,
        htmlOverscroll: html.style.overscrollBehavior,
        bodyOverscroll: body.style.overscrollBehavior,
      };

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }

      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';

      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
    }

    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount === 0 && prevStyles) {
        body.style.position = prevStyles.position;
        body.style.top = prevStyles.top;
        body.style.left = prevStyles.left;
        body.style.right = prevStyles.right;
        body.style.width = prevStyles.width;
        body.style.overflow = prevStyles.overflow;
        body.style.paddingRight = prevStyles.paddingRight;
        body.style.overscrollBehavior = prevStyles.bodyOverscroll;

        html.style.overflow = prevStyles.htmlOverflow;
        html.style.overscrollBehavior = prevStyles.htmlOverscroll;
        prevStyles = null;

        window.scrollTo({ top: savedScrollY, left: 0, behavior: 'auto' });
      }
    };
  }, [isLocked]);
}
