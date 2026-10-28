import { Component, type ReactNode } from 'react';
import { TOKEN_KEY } from '../lib';

/** Kutilmagan xatoda oq sahifa o'rniga xabar va qayta kirish tugmasini ko'rsatadi */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  reset = () => {
    localStorage.removeItem(TOKEN_KEY);
    location.href = '/login';
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm space-y-3 p-6 text-center">
          <h1 className="text-lg font-semibold">Nimadir xato ketdi</h1>
          <p className="text-sm text-slate-500">{this.state.error.message}</p>
          <button className="btn-primary w-full" onClick={this.reset}>
            Qayta kirish
          </button>
        </div>
      </div>
    );
  }
}
