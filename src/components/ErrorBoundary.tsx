import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Tianlane UI Error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('tianlane_pm_state_v5');
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F8FA] text-[#121317]">
          <div className="w-full max-w-md bg-white border border-[#E6E8EE] rounded-2xl p-6 shadow-clean-lg text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-[18px] font-semibold text-[#121317]">
              Something went wrong
            </h2>
            <p className="text-[13px] text-[#6E717A]">
              Tianlane encountered an unexpected error while rendering this view.
            </p>
            {this.state.error && (
              <div className="text-[11px] font-mono text-left bg-[#F1F3F7] p-3 rounded-lg text-red-600 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-full bg-[#0A4595] hover:bg-[#1264D4] text-white text-[13px] font-medium transition-colors cursor-pointer"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-full border border-[#E6E8EE] hover:bg-[#F1F3F7] text-[13px] font-medium text-[#45474D] transition-colors cursor-pointer"
              >
                Reset Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
