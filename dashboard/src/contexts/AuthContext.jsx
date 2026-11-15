// Configuration context for Clarity (100% free & self-hosted mode).
// Reads /api/config to learn local LLM and job retention settings.
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../config';

const AuthContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [config, setConfig] = useState({ billingEnabled: false, googleAuthEnabled: false });
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => null, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await (await fetch(getApiUrl('/api/config'))).json();
        setConfig({ ...cfg, billingEnabled: false, googleAuthEnabled: false });
      } catch (_) { /* config fetch failed — stay in free BYOK mode */ }
      setLoading(false);
    })();
  }, []);

  const value = {
    billingEnabled: false,
    localLlm: config.localLlm || null,
    googleAuthEnabled: false,
    jobRetentionSeconds: config.jobRetentionSeconds || null,
    loading,
    signingIn: false,
    user: null,
    me: null,
    plan: null,
    entitled: true,
    minutes: null,
    isSignedIn: false,
    isManaged: false,
    refreshMe,
    requestMagicLink: async () => ({ passwordRequired: false }),
    loginWithPassword: async () => {},
    usesPassword: async () => false,
    loginWithGoogle: async () => {},
    logout: () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
