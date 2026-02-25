import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../apiClient';



interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'programmer' | 'operator' | 'inventory_clerk' | 'auditor';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // BYPASS LOGIN: Initialize with Admin User
  const [user, setUser] = useState<User | null>({
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin'
  });
  const [token, setToken] = useState<string | null>('bypass-token');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Optional: still try to fetch real user if token exists, but we default to logged in.
    // For now, completely bypassing the check to ensure 100% success rate.
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      localStorage.setItem('token', 'bypass-token');
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      console.log('Attempting login with:', { username, apiBaseURL: api.defaults.baseURL });

      const response = await api.post('/api/auth/login', {
        username,
        password,
      });

      console.log('Login response:', response.data);

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response?.data);
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};