import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface AdminModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
}

export function AdminModalWrapper({
  isOpen,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  className,
}: AdminModalWrapperProps) {
  useBodyScrollLock(isOpen);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Close on Escape key press
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Prevent background scrolling gestures on mobile touch devices
    const el = overlayRef.current;
    if (!el) {
      return () => {
        window.removeEventListener('keydown', onKeyDown);
      };
    }

    const handleTouchMove = (e: TouchEvent) => {
      let target = e.target as HTMLElement | null;
      let isInsideScrollable = false;

      while (target && target !== el) {
        const style = window.getComputedStyle(target);
        const isScrollable =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          target.scrollHeight > target.clientHeight;
        if (isScrollable) {
          isInsideScrollable = true;
          break;
        }
        target = target.parentElement;
      }

      if (!isInsideScrollable && e.cancelable) {
        e.preventDefault();
      }
    };

    el.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onClick={onClose}
      className={
        className ??
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/35 backdrop-blur-[2px] overflow-y-auto overscroll-none touch-pan-y'
      }
    >
      {children}
    </div>,
    document.body
  );
}
