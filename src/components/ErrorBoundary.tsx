import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors so one broken page doesn't blank the whole app. */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center"
      >
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="max-w-md text-gray-400">
          {this.state.error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-500"
        >
          Try again
        </button>
      </main>
    );
  }
}
