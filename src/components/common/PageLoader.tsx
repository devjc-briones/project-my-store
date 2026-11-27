import { Loader2 } from 'lucide-react';
import { MystoreAnimatedLogo } from './MystoreAnimatedLogo';

interface PageLoaderProps {
  label?: string;
}

export function PageLoader({ label = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-5">
        <MystoreAnimatedLogo />
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200/80 shadow-xs text-xs font-medium text-slate-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}
