import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';

// Production URL (Railway)
const PRODUCTION_API_URL = 'https://web-production-2e659.up.railway.app';

// Use production URL for App Store builds, or env variable for development
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || PRODUCTION_API_URL;

interface User {
  id: string;
  email: string;
  name: string;
  language: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, securityQuestion?: string, securityAnswer?: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ security_question?: string; email?: string }>;
  verifySecurityAnswer: (email: string, answer: string) => Promise<boolean>;
  resetPasswordWithSecurity: (email: string, answer: string, newPassword: string) => Promise<void>;
  changeLanguage: (language: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { i18n } = useTranslation();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        api.setToken(storedToken);
        const userData = JSON.parse(storedUser);
        setUser(userData);
        i18n.changeLanguage(userData.language || 'es');
        
        // Verify token is still valid
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${storedToken}` },
          });
          if (!response.ok) {
            await logout();
          }
        } catch (error) {
          // Token verification failed, but keep user logged in for offline use
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    api.setToken(data.access_token);
    i18n.changeLanguage(data.user.language || 'es');
    
    await AsyncStorage.setItem('auth_token', data.access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const register = async (email: string, password: string, name: string, securityQuestion?: string, securityAnswer?: string) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        password, 
        name, 
        language: i18n.language,
        security_question: securityQuestion || "¿Cuál es tu comida favorita?",
        security_answer: securityAnswer || "default"
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    api.setToken(data.access_token);
    
    await AsyncStorage.setItem('auth_token', data.access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    api.setToken(null);
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  };

  const forgotPassword = async (email: string) => {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    return await response.json();
  };

  const verifySecurityAnswer = async (email: string, answer: string): Promise<boolean> => {
    const response = await fetch(`${API_URL}/api/auth/verify-security-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, security_answer: answer }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Verification failed');
    }

    const data = await response.json();
    return data.verified;
  };

  const resetPasswordWithSecurity = async (email: string, answer: string, newPassword: string) => {
    const response = await fetch(`${API_URL}/api/auth/reset-password-with-security`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        security_answer: answer,
        new_password: newPassword 
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Reset failed');
    }
  };

  const changeLanguage = async (language: string) => {
    try {
      // Change language locally first
      i18n.changeLanguage(language);
      
      if (user) {
        const updatedUser = { ...user, language };
        setUser(updatedUser);
        await AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
      }
      
      // Also save language preference independently
      await AsyncStorage.setItem('app_language', language);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
        verifySecurityAnswer,
        resetPasswordWithSecurity,
        changeLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
