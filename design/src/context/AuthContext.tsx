import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { apiPost } from '../lib/api';

interface LoginResponse {
  access_token: string;
  token_type: string;
  nickname: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  nickname: string;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('access_token'));
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || '');

  const loginWithEmail = async (email: string, password: string) => {
    const res = await apiPost<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('nickname', res.data.nickname);
    setNickname(res.data.nickname);
    setIsAuthenticated(true);
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const googleToken = await result.user.getIdToken();
    const res = await apiPost<LoginResponse>('/auth/google', { google_token: googleToken });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('nickname', res.data.nickname);
    setNickname(res.data.nickname);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('nickname');
    setIsAuthenticated(false);
    setNickname('');
    await Promise.allSettled([apiPost('/auth/logout'), signOut(auth)]);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, nickname, loginWithEmail, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
