import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-2xl font-bold">Ceva nu a mers bine</h1>
            <p className="text-gray-400">A apărut o eroare neașteptată.</p>
            <button
              data-testid="error-retry-btn"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = ''; }}
              className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 min-h-[44px]"
            >
              Încearcă din nou
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
