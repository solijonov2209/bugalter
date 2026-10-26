import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, connectSocket, disconnectSocket, TOKEN_KEY } from './lib';

export interface Me {
  user: { id: number; email: string; role: 'admin' | 'accountant' | 'employee' };
  org: { id: number; name: string; type: 'company' | 'center'; tax_rate: number };
  employee: { id: number; full_name: string; position: string } | null;
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return setLoading(false);
    try {
      setMe(await api<Me>('/auth/me'));
      connectSocket();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    return disconnectSocket;
  }, []);

  const login = async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    await refresh();
  };
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    disconnectSocket();
    setMe(null);
  };

  return <Ctx.Provider value={{ me, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
