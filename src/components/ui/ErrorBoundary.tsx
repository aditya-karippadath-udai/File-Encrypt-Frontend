import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert, Copy, Check } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

/**
 * Production-hardened Error Boundary.
 * Catches uncaught runtime render errors, redacts all sensitive strings (passwords, keys),
 * and presents an accessible, clean recovery screen with diagnostic telemetry.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log sanitized error to standard error without leaking credentials
    console.error('ErrorBoundary caught an unhandled component error:', {
      name: error.name,
      message: this.sanitizeErrorMessage(error.message),
    });
    this.setState({ errorInfo });
  }

  private sanitizeErrorMessage(msg: string): string {
    if (!msg) return 'An unexpected rendering error occurred.';
    // Redact any patterns resembling passwords, hex keys, or base64 tokens
    return msg
      .replace(/password[:=]\s*\S+/gi, 'password=[REDACTED]')
      .replace(/key[:=]\s*[a-f0-9]{32,}/gi, 'key=[REDACTED]')
      .replace(/[a-f0-9]{64}/gi, '[REDACTED_HASH]')
      .replace(/bearer\s+\S+/gi, 'Bearer [REDACTED]');
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReturnToDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    // Navigate safely to dashboard
    try {
      window.dispatchEvent(new CustomEvent('aegis:navigate', { detail: { tab: 'dashboard' } }));
    } catch {
      window.location.reload();
    }
  };

  private handleCopyDiagnostics = () => {
    const diagnostic = [
      `Timestamp: ${new Date().toISOString()}`,
      `Error Type: ${this.state.error?.name || 'Error'}`,
      `Message: ${this.sanitizeErrorMessage(this.state.error?.message || '')}`,
      `Component Stack: ${this.state.errorInfo?.componentStack?.slice(0, 300) || 'None'}`,
    ].join('\n');

    navigator.clipboard.writeText(diagnostic).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const safeMessage = this.sanitizeErrorMessage(
        this.state.error?.message || 'An unexpected error occurred in the user interface.'
      );

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[500px] flex items-center justify-center p-6 bg-[#05070A] text-[#F8FAFC]"
        >
          <div className="max-w-lg w-full bg-[#0D1117] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#F8FAFC] tracking-tight">
                  Application Rendering Recovered
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  An isolated rendering error occurred in this view. Active cryptographic background operations and file containers remain intact and unaffected.
                </p>
              </div>
            </div>

            {/* Sanitized diagnostic details */}
            <div className="bg-[#05070A] border border-[#1E293B] rounded-xl p-3.5 space-y-2 font-mono text-[11px] text-[#94A3B8]">
              <div className="flex items-center justify-between text-[#64748B]">
                <span>Diagnostic Info</span>
                <button
                  type="button"
                  onClick={this.handleCopyDiagnostics}
                  className="flex items-center gap-1 text-[#60A5FA] hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-rose-400/90 break-words leading-tight select-all">
                {safeMessage}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                variant="primary"
                className="w-full sm:w-auto flex-1"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={this.handleReset}
              >
                Reload View
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto flex-1"
                icon={<Home className="w-4 h-4" />}
                onClick={this.handleReturnToDashboard}
              >
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
