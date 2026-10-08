import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig } from '../config/env';
import { isCurrentUserAdmin, loadProfile } from '../services/authService';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    const hydrate = async nextSession => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setIsAdmin(false);
        return;
      }
      const [nextProfile, admin] = await Promise.allSettled([loadProfile(), isCurrentUserAdmin()]);
      if (!active) return;
      setProfile(nextProfile.status === 'fulfilled' ? nextProfile.value : null);
      setIsAdmin(admin.status === 'fulfilled' && admin.value);
    };

    supabase.auth.getSession().then(({ data }) => hydrate(data.session)).finally(() => {
      if (active) setReady(true);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setIsAdmin(false);
        return;
      }
      setTimeout(() => { if (active) void hydrate(nextSession); }, 0);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!session) return;
    const [nextProfile, admin] = await Promise.all([loadProfile(), isCurrentUserAdmin()]);
    setProfile(nextProfile);
    setIsAdmin(admin);
  }, [session]);

  const value = useMemo(() => ({ session, profile, isAdmin, ready, configured: hasSupabaseConfig, refreshAccount }), [session, profile, isAdmin, ready, refreshAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}