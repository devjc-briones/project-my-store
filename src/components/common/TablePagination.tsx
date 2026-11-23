import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_TABLE_PAGE_SIZE = 10;

export interface PaginationState<T> {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  paginatedItems: T[];
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
}

export function usePagination<T>(
  items: readonly T[],
  pageSize: number = DEFAULT_TABLE_PAGE_SIZE,
  resetKey?: string | number
): PaginationState<T> {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);
  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return {
    page: safePage,
    setPage,
    totalPages,
    totalItems,
    startItem,
    endItem,
    paginatedItems,
    canPrev,
    canNext,
    goPrev: () => setPage((prev) => Math.max(1, Math.min(prev, totalPages) - 1)),
    goNext: () => setPage((prev) => Math.min(totalPages, Math.max(1, prev) + 1)),
  };
}

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  variant?: 'embedded' | 'card';
  itemLabel?: string;
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  startItem,
  endItem,
  canPrev,
  canNext,
  onPrev,
  onNext,
  variant = 'embedded',
  itemLabel,
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const containerClass =
    variant === 'card'
      ? 'px-3.5 py-2.5 bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3'
      : 'px-4 py-2.5 border-t border-slate-200/80 bg-slate-50/60 flex items-center justify-between gap-3';

  return (
    <div className={containerClass}>
      <p className="text-xs text-slate-600 tabular-nums truncate">
        <span className="font-semibold text-slate-900">
          {startItem}–{endItem}
        </span>{' '}
        of <span className="font-semibold text-slate-900">{totalItems}</span>
        {itemLabel ? ` ${itemLabel}` : ''}
        <span className="text-slate-400 mx-1.5">·</span>
        <span>
          Page {page}/{totalPages}
        </span>
      </p>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 min-h-[30px] px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-[#e2e8f0] rounded-lg hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next page"
          className="inline-flex items-center gap-1 min-h-[30px] px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-[#e2e8f0] rounded-lg hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer transition-colors"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
}
