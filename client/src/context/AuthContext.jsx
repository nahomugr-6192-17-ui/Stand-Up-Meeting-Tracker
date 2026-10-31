import React, { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '../lib/auth-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const res = await authClient.getSession();
      if (res && res.data && res.data.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (username, password) => {
    const { data, error } = await authClient.signIn.username({
      username: username.trim(),
      password
    });

    if (error) {
      throw new Error(error.message || 'Invalid username or password.');
    }

    if (data?.user) {
      setUser(data.user);
      return data.user;
    }

    // Refresh and fetch active session
    const sessionRes = await authClient.getSession();
    if (sessionRes?.data?.user) {
      setUser(sessionRes.data.user);
      return sessionRes.data.user;
    }

    throw new Error('Authentication succeeded but session could not be established.');
  };

  const logout = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
