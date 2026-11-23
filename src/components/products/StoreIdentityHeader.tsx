import { CheckCircle2, Eye, FileEdit, Globe, Pencil } from 'lucide-react';
import { Store } from '../../types/schema';

interface StoreIdentityHeaderProps {
  store: Store;
  categoryName: string;
  onEditUi: () => void;
  onViewShop: () => void;
}

export function StoreIdentityHeader({
  store,
  categoryName,
  onEditUi,
  onViewShop,
}: StoreIdentityHeaderProps) {
  const isPublished = store.status === 'published';

  return (
    <section
      aria-label="Store identity and quick actions"
      className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate max-w-full">
            {store.name}
          </h2>
          {isPublished ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
              <FileEdit className="w-3.5 h-3.5" />
              Draft
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-mono text-slate-700">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {store.domainUrl}
          </span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="font-medium text-slate-500">{categoryName}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onEditUi}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Edit Store UI</span>
        </button>

        <button
          type="button"
          onClick={onViewShop}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{isPublished ? 'View Live Shop' : 'Preview Store'}</span>
        </button>
      </div>
    </section>
  );
}
