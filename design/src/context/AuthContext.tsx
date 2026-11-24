import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { apiGet, apiPost, type MyProfile } from '../lib/api';

interface LoginResponse {
  access_token: string;
  token_type: string;
  nickname: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  nickname: string;
  avatarUrl: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  // 회원 설정에서 닉네임을 바꾸면 헤더 등에도 바로 반영한다
  updateNickname: (nickname: string) => void;
  updateAvatarUrl: (avatarUrl: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('access_token'));
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem('avatar_url'));

  // 로그인된 상태로 새로고침하면 프로필 사진 경로를 다시 받는다
  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<MyProfile>('/users/me')
      .then(res => {
        setNickname(res.data.nickname);
        localStorage.setItem('nickname', res.data.nickname);
        setAvatarUrl(res.data.avatar_url);
        if (res.data.avatar_url) localStorage.setItem('avatar_url', res.data.avatar_url);
        else localStorage.removeItem('avatar_url');
      })
      .catch(() => {});
  }, [isAuthenticated]);

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
    localStorage.removeItem('avatar_url');
    setIsAuthenticated(false);
    setNickname('');
    setAvatarUrl(null);
    await Promise.allSettled([apiPost('/auth/logout'), signOut(auth)]);
  };

  const updateNickname = (next: string) => {
    localStorage.setItem('nickname', next);
    setNickname(next);
  };

  const updateAvatarUrl = (next: string | null) => {
    setAvatarUrl(next);
    if (next) localStorage.setItem('avatar_url', next);
    else localStorage.removeItem('avatar_url');
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, nickname, avatarUrl,
      loginWithEmail, loginWithGoogle, logout, updateNickname, updateAvatarUrl,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
