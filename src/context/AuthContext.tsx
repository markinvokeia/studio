
'use client';

import { API_ROUTES } from '@/constants/routes';
import api from '@/services/api';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
};

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  activeCashSession: any | null;
  checkActiveSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCashSession, setActiveCashSession] = useState<any | null>(null);

  const checkActiveSession = async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const currentUser = JSON.parse(storedUser);
      const token = localStorage.getItem('token');
      if (currentUser && token) {
        try {
          const data = await api.get(API_ROUTES.CASHIER.SESSIONS_ACTIVE, { user_id: currentUser.id });
          if (data.code === 200) {
            setActiveCashSession(data);
          } else if (data.code === 404) {
            setActiveCashSession(null);
          } else {
            setActiveCashSession(null);
          }
        } catch (error: any) {
          if (error.response && error.response.status === 404) {
            setActiveCashSession(null);
          } else {
            console.error("Failed to check active session:", error);
            setActiveCashSession(null);
          }
        }
      }
    } else {
      setActiveCashSession(null);
    }
  };


  useEffect(() => {
    // Check for user session on initial load
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    checkActiveSession();
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await api.post(API_ROUTES.LOGIN, { email, password });
      const { user: loggedInUser, token } = data;
      setUser(loggedInUser);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      localStorage.setItem('token', token); // Store token
      await checkActiveSession();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to login');
    }
  };

  const logout = async () => {
    try {
      await api.post(API_ROUTES.LOGOUT, {});
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setUser(null);
      setActiveCashSession(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, activeCashSession, checkActiveSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


