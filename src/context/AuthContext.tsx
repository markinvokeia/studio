'use client';

import { API_ROUTES } from '@/constants/routes';
import { AuthUser } from '@/lib/types';
import api from '@/services/api';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  activeCashSession: any | null;
  checkActiveSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
  permissionCodes: string[];
  roleNames: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCashSession, setActiveCashSession] = useState<any | null>(null);

  const fetchAuthUser = async (): Promise<AuthUser | null> => {
    try {
      const data = await api.get(API_ROUTES.AUTH_ME);
      return data as AuthUser;
    } catch (error) {
      console.error('Failed to fetch auth user:', error);
      return null;
    }
  };

  const getPermissionCodes = (userData: AuthUser | null): string[] => {
    if (!userData?.roles_and_permissions) return [];
    return userData.roles_and_permissions.flatMap(role =>
      role.permissions.map(p => p.code)
    );
  };

  const getRoleNames = (userData: AuthUser | null): string[] => {
    if (!userData?.roles_and_permissions) return [];
    return userData.roles_and_permissions.map(r => r.role_name);
  };

  const permissionCodes = getPermissionCodes(user);
  const roleNames = getRoleNames(user);

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
          console.error("Failed to check active session:", error);
          setActiveCashSession(null);
        }
      }
    } else {
      setActiveCashSession(null);
    }
  };

  const refreshUser = async () => {
    const authUser = await fetchAuthUser();
    if (authUser) {
      const basicUser = {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
      };
      setUser(authUser);
      localStorage.setItem('user', JSON.stringify(basicUser));
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        const authUser = await fetchAuthUser();
        if (authUser) {
          const basicUser = {
            id: authUser.id,
            name: authUser.name,
            email: authUser.email,
          };
          setUser(authUser);
          localStorage.setItem('user', JSON.stringify(basicUser));
        } else {
          localStorage.removeItem('token');
        }
      }
      await checkActiveSession();
      setIsLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      checkActiveSession();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await api.post(API_ROUTES.LOGIN, { email, password });
      const { user: loggedInUser, token } = data;

      localStorage.setItem('token', token);

      const authUser = await fetchAuthUser();
      if (authUser) {
        const basicUser = {
          id: authUser.id,
          name: authUser.name,
          email: authUser.email,
        };
        setUser(authUser);
        localStorage.setItem('user', JSON.stringify(basicUser));
      } else {
        setUser(loggedInUser);
        localStorage.setItem('user', JSON.stringify(loggedInUser));
      }

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
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading,
      activeCashSession,
      checkActiveSession,
      refreshUser,
      permissionCodes,
      roleNames
    }}>
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
