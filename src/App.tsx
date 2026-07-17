/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, Component } from 'react';
import { AppStateProvider } from './contexts/AppStateContext';

// Lazy-load the main shell so the initial bundle stays small.
// The splash/loader below is shown while the chunk downloads.
const AppShell = lazy(() =>
  import('./components/AppShell').then((m) => ({ default: m.AppShell }))
);

// ─── Error Boundary ──────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Nota: `useDefineForClassFields: false` no tsconfig impede TypeScript de
// inferir membros herdados de Component em alguns cenários. As declarações
// `declare` abaixo resolvem sem alterar o comportamento em runtime.
class AppErrorBoundary extends Component<React.PropsWithChildren, ErrorBoundaryState> {
  declare state: ErrorBoundaryState;
  declare setState: Component<React.PropsWithChildren, ErrorBoundaryState>['setState'];
  declare props: Readonly<React.PropsWithChildren>;

  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[App] Erro não tratado:', error, info.componentStack);
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            backgroundColor: '#121214',
            color: '#fff',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 40 }}>⚠️</span>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Algo deu errado</p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, maxWidth: 320 }}>
            {this.state.error?.message ?? 'Erro inesperado. Tente recarregar o app.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#f59e0b',
              color: '#000',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Loader ──────────────────────────────────────────────────────

function AppLoader() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121214',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#f59e0b',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── App root ────────────────────────────────────────────────────

export default function App() {
  return (
    <AppErrorBoundary>
      <AppStateProvider>
        <Suspense fallback={<AppLoader />}>
          <AppShell />
        </Suspense>
      </AppStateProvider>
    </AppErrorBoundary>
  );
}
