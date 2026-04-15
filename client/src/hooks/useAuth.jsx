import { createContext, useContext, useState, useCallback } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

// DEV MODE: bypass login for quick UI iteration
const DEV_USER = import.meta.env.DEV
  ? { id: 1, name: 'Dev User', email: 'dev@finagent.local' }
  : null;
const DEV_TOKEN = 'dev-bypass-token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (import.meta.env.DEV) return DEV_USER;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const isAuthenticated = import.meta.env.DEV ? true : (!!user && !!localStorage.getItem('token'));

  const login = useCallback(async (email, password) => {
    if (import.meta.env.DEV) return { user: DEV_USER, token: DEV_TOKEN };
    const data = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    if (import.meta.env.DEV) return { user: DEV_USER, token: DEV_TOKEN };
    const data = await apiClient.post('/auth/register', { name, email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    if (import.meta.env.DEV) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
