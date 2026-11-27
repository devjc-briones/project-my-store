import React from 'react';
import { AlertTriangle, Home, LogOut, RefreshCw } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'An unexpected rendering error occurred.';
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled application error caught by AppErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private handleResetSession = () => {
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.startsWith('mystore_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // Ignore storage access errors
      }
      window.location.href = '/login';
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              Something went wrong
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              The page ran into an unexpected error while loading your workspace.
            </p>
            {this.state.errorMessage && (
              <p className="text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 break-words">
                {this.state.errorMessage}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                Return Home
              </button>
              <button
                type="button"
                onClick={this.handleResetSession}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign In Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
