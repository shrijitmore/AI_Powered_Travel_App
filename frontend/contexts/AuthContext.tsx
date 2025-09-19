import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

interface User {
  id?: string;
  name: string;
  email: string;
  total_points: number;
  level: number;
  badges: string[];
  routes_completed: number;
  achievements: string[];
  rewards_owned: string[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  // Admin credentials
  const ADMIN_EMAIL = 'admin@travelquest.com';
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadOrCreateAppUser(firebaseUser);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadOrCreateAppUser = async (firebaseUser: FirebaseUser) => {
    try {
      // Try to get user from AsyncStorage first
      const storedUser = await AsyncStorage.getItem(`user_${firebaseUser.uid}`);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setAppUser(parsedUser);
        return;
      }

      // Create new app user in backend
      const newUser: User = {
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Travel Explorer',
        email: firebaseUser.email || '',
        total_points: 0,
        level: 1,
        badges: [],
        routes_completed: 0,
        achievements: [],
        rewards_owned: [],
      };

      const response = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        const createdUser = await response.json();
        setAppUser(createdUser);
        await AsyncStorage.setItem(`user_${firebaseUser.uid}`, JSON.stringify(createdUser));
      }
    } catch (error) {
      console.error('Error loading/creating app user:', error);
    }
  };

  const refreshAppUser = async () => {
    if (!user?.uid || !appUser?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/users/${appUser.id}`);
      if (response.ok) {
        const updatedUser = await response.json();
        setAppUser(updatedUser);
        await AsyncStorage.setItem(`user_${user.uid}`, JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error refreshing app user:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // User profile will be created automatically in the onAuthStateChanged listener
  };

  const logout = async () => {
    if (user?.uid) {
      await AsyncStorage.removeItem(`user_${user.uid}`);
    }
    await signOut(auth);
  };

  const value: AuthContextType = {
    user,
    appUser,
    loading,
    signIn,
    signUp,
    logout,
    isAdmin,
    refreshAppUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};