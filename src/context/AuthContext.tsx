
'use client';

import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  activeCashSession: any | null; // Can be more specific if session structure is known
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
                const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/cash-session/active?user_id=${currentUser.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok && data.code === 200) {
                    setActiveCashSession(data.data);
                } else {
                    setActiveCashSession(null);
                }
            } catch (error) {
                console.error("Failed to check active session:", error);
                setActiveCashSession(null);
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
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const { user: loggedInUser, token } = await response.json();
      setUser(loggedInUser);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      localStorage.setItem('token', token); // Store token
      await checkActiveSession();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to login');
    }
  };

  const logout = async () => {
    const token = localStorage.getItem('token');
    try {
        await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
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

      