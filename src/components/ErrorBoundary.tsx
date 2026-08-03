import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  onReturnToDashboard?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('PayGuard ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReturnToDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReturnToDashboard) {
      this.props.onReturnToDashboard();
    }
  };

  private sanitizeText = (text: string): string => {
    if (!text) return '';
    let sanitized = text;
    sanitized = sanitized.replace(/482615/g, '******');
    sanitized = sanitized.replace(/(password|pin|secret)\s*[:=]\s*\S+/gi, '$1: ******');
    sanitized = sanitized.replace(/\b\d{8,17}\b/g, (match) => '••••' + match.slice(-4));
    return sanitized;
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center justify-start p-4">
          <div className="max-w-4xl w-full my-4 p-4 bg-rose-950/90 border border-rose-500 rounded-xl text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <strong className="text-white font-bold block text-sm">Authorisation could not be completed. No changes were made.</strong>
                <span className="text-rose-200">The application encountered a display condition. Your imported records are preserved.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-lg transition-colors cursor-pointer shrink-0 shadow-md"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
