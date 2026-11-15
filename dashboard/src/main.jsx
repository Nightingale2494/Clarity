import { StrictMode, useState, useEffect, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Landing from './Landing.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { capture as captureAttribution } from './lib/attribution'
import { applyConsent } from './lib/consent'
import CookieBanner from './components/CookieBanner'

const App = lazy(() => import('./App.jsx'))
const Legal = lazy(() => import('./Legal.jsx'))

function Root() {
  const resolveView = () => {
    const hash = window.location.hash || '';
    if (hash === '#legal') return 'legal';
    if (hash === '#app' || hash.startsWith('#app?') || hash === '#/app') return 'app';
    return 'landing';
  };

  const [view, setView] = useState(resolveView);

  useEffect(() => {
    const handleHashChange = () => setView(resolveView());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLaunchApp = () => {
    window.location.hash = '#app';
    setView('app');
  };

  if (view === 'legal') return <Legal />;
  if (view === 'app') return <App />;
  return <Landing onLaunchApp={handleLaunchApp} />;
}

captureAttribution();
applyConsent();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-muted text-sm lowercase">loading…</div>}>
        <Root />
      </Suspense>
      <CookieBanner />
    </AuthProvider>
  </StrictMode>,
)
