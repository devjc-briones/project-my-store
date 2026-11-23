import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 left-4 sm:left-auto z-[70] flex flex-col-reverse gap-2 sm:w-96 pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;
        const iconColor =
          toast.type === 'success'
            ? 'text-emerald-600'
            : toast.type === 'error'
              ? 'text-rose-600'
              : 'text-slate-700';

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 flex items-start gap-3"
          >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
