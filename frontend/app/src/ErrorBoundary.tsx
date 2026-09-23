import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the message concise and avoid serializing application state, tokens,
    // or player data into the browser console.
    console.error('Application render failed', error.name, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error__card">
          <div className="brand__logo" aria-hidden="true">S</div>
          <h1>Something went wrong</h1>
          <p>The client could not render safely. Reload the page to start a fresh session.</p>
          <button className="btn btn--primary" type="button" onClick={() => window.location.reload()}>
            Reload application
          </button>
        </div>
      </main>
    );
  }
}
