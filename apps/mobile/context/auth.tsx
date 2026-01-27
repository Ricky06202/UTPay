import { API_URL } from '@/constants/api';
import { Wallet } from 'ethers';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

type User = {
  id: number;
  email: string;
  name: string;
  walletAddress?: string;
  privateKey?: string;
  seedPhrase?: string;
  balance?: string; // Nuevo: Balance obtenido del contrato vía API
  role?: 'student' | 'admin' | 'cafeteria';
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

// Función auxiliar para enriquecer el usuario con su dirección generada localmente
function enrichUserWithAddress(user: User | null): User | null {
  if (!user) return null;
  
  // Si ya tiene dirección y llaves, no hacemos nada
  if (user.walletAddress && user.privateKey) return user;

  try {
    // Si tiene frase o llave privada, podemos generar la dirección
    if (user.seedPhrase) {
      const wallet = Wallet.fromMnemonic(user.seedPhrase);
      return { ...user, walletAddress: wallet.address, privateKey: wallet.privateKey };
    } else if (user.privateKey) {
      const wallet = new Wallet(user.privateKey);
      return { ...user, walletAddress: wallet.address };
    }
  } catch (e) {
    console.error('Error generating wallet address locally:', e);
  }
  
  return user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  
  // Wrapper para asegurar que siempre que seteamos el usuario, intentamos generar su dirección
  const setUser = (newUser: User | null) => {
    setUserState(enrichUserWithAddress(newUser));
  };
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadStorageData();
    
    // Configurar intervalo de actualización automática (cada 15 segundos)
    const interval = setInterval(() => {
      if (user && appState.current === 'active') {
        refreshUser();
      }
    }, 15000);

    // Escuchar cambios en el estado de la aplicación (segundo plano/primer plano)
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      if (appState.current === 'active' && user) {
        refreshUser();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user?.id]);

  async function loadStorageData() {
    try {
      let storedToken = null;
      let storedUser = null;

      if (Platform.OS === 'web') {
        storedToken = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        storedUser = userStr ? JSON.parse(userStr) : null;

        // REFUERZO PARA WEB: Si el objeto user no tiene las llaves, buscarlas individualmente
        if (storedUser && (!storedUser.privateKey || !storedUser.seedPhrase)) {
          const individualKey = localStorage.getItem('user_private_key');
          const individualSeed = localStorage.getItem('user_seed_phrase');
          if (individualKey) storedUser.privateKey = individualKey;
          if (individualSeed) storedUser.seedPhrase = individualSeed;
        }
      } else {
        storedToken = await SecureStore.getItemAsync('token');
        const userStr = await SecureStore.getItemAsync('user');
        storedUser = userStr ? JSON.parse(userStr) : null;
        
        // REFUERZO PARA EXPO GO: Si el objeto user no tiene las llaves, buscarlas individualmente
        if (storedUser && (!storedUser.privateKey || !storedUser.seedPhrase)) {
          const individualKey = await SecureStore.getItemAsync('user_private_key');
          const individualSeed = await SecureStore.getItemAsync('user_seed_phrase');
          if (individualKey) storedUser.privateKey = individualKey;
          if (individualSeed) storedUser.seedPhrase = individualSeed;
        }
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

      // REFUERZO PARA WEB: Guardar llaves por separado también
      if (newUser.privateKey) {
        localStorage.setItem('user_private_key', newUser.privateKey);
      }
      if (newUser.seedPhrase) {
        localStorage.setItem('user_seed_phrase', newUser.seedPhrase);
      }
    } else {
      await SecureStore.setItemAsync('token', newToken);
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
      
      // REFUERZO PARA EXPO GO: Guardar llaves por separado también
      if (newUser.privateKey) {
        await SecureStore.setItemAsync('user_private_key', newUser.privateKey);
      }
      if (newUser.seedPhrase) {
        await SecureStore.setItemAsync('user_seed_phrase', newUser.seedPhrase);
      }
    }
  }

  async function updateUser(newUser: User) {
    setUser(newUser);
    if (Platform.OS === 'web') {
      localStorage.setItem('user', JSON.stringify(newUser));
      
      // REFUERZO PARA WEB: Guardar llaves por separado también
      if (newUser.privateKey) {
        localStorage.setItem('user_private_key', newUser.privateKey);
      }
      if (newUser.seedPhrase) {
        localStorage.setItem('user_seed_phrase', newUser.seedPhrase);
      }
    } else {
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
      
      // REFUERZO PARA EXPO GO: Guardar llaves por separado también
      if (newUser.privateKey) {
        await SecureStore.setItemAsync('user_private_key', newUser.privateKey);
      }
      if (newUser.seedPhrase) {
        await SecureStore.setItemAsync('user_seed_phrase', newUser.seedPhrase);
      }
    }
  }

  async function refreshUser() {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/auth/me/${user.id}`);
      const data = await response.json();
      if (data.success) {
        // REFUERZO EXTREMO: Buscar las llaves en el almacenamiento local antes de actualizar
        // Esto previene la pérdida si el estado de React 'user' se desincronizó por un momento
        let localKey = user.privateKey;
        let localSeed = user.seedPhrase;

        if (!localKey || !localSeed) {
          if (Platform.OS === 'web') {
            localKey = localStorage.getItem('user_private_key') || undefined;
            localSeed = localStorage.getItem('user_seed_phrase') || undefined;
          } else {
            localKey = (await SecureStore.getItemAsync('user_private_key')) || undefined;
            localSeed = (await SecureStore.getItemAsync('user_seed_phrase')) || undefined;
          }
        }

        // Preservar llaves locales al refrescar desde el servidor
        const updatedUser = {
          ...data.user,
          privateKey: localKey,
          seedPhrase: localSeed
        };
        await updateUser(updatedUser);
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
      localStorage.removeItem('user_private_key');
      localStorage.removeItem('user_seed_phrase');
    } else {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('user_private_key');
      await SecureStore.deleteItemAsync('user_seed_phrase');
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
