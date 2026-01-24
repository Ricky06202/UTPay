import { API_URL } from '@/constants/api';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type User = {
  id: number;
  email: string;
  name: string;
  balance: number;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      let storedToken = null;
      let storedUser = null;

      if (Platform.OS === 'web') {
        storedToken = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        storedUser = userStr ? JSON.parse(userStr) : null;
      } else {
        storedToken = await SecureStore.getItemAsync('token');
        const userStr = await SecureStore.getItemAsync('user');
        storedUser = userStr ? JSON.parse(userStr) : null;
      }

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      }
    } catch (e) {
      console.error('Error loading auth data', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(newToken: string, newUser: User) {
    setToken(newToken);
    setUser(newUser);

    if (Platform.OS === 'web') {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
    } else {
      await SecureStore.setItemAsync('token', newToken);
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
    }
  }

  async function updateUser(newUser: User) {
    setUser(newUser);
    if (Platform.OS === 'web') {
      localStorage.setItem('user', JSON.stringify(newUser));
    } else {
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
    }
  }

  async function refreshUser() {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/auth/me/${user.id}`);
      const data = await response.json();
      if (data.success) {
        await updateUser(data.user);
      }
    } catch (e) {
      console.error('Error refreshing user data', e);
    }
  }

  async function signOut() {
    setToken(null);
    setUser(null);

    if (Platform.OS === 'web') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } else {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut, updateUser, refreshUser, isLoading }}>
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
