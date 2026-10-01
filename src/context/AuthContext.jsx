import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getStoredToken, setStoredToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCurrentUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.getMe();
      if (res.token) {
        setStoredToken(res.token);
      }
      setUser(res.user);
      setError(null);
    } catch (err) {
      console.warn('Session expired or invalid token:', err.message);
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();

    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener('fsae:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('fsae:auth_expired', handleAuthExpired);
  }, [loadCurrentUser]);

  const login = async (email, password) => {
    setError(null);
    try {
      const data = await apiClient.login(email, password);
      setStoredToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (nameOrData, email, password, role, extra) => {
    setError(null);
    try {
      const data = await apiClient.register(nameOrData, email, password, role, extra);
      setStoredToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
    setError(null);
  };

  const isAdmin = !!(user && user.role === 'Admin');
  const isLead = !!(user && (user.role === 'Lead' || user.role === 'Purchaser'));
  const isMember = !!(user && user.role === 'Member');
  const isPurchaser = !!(user && user.role === 'Purchaser');
  const isPurchaserOrAdmin = isAdmin || isLead;

  const canOrder = isAdmin || isLead;
  const canViewBudget = isAdmin || isLead;
  const dept = (user?.department || '').trim().toUpperCase();
  const sub = (user?.subsystem || '').trim().toUpperCase();
  const canEditBudget = isAdmin || (isLead && (
    dept === 'TEAM ADMINISTRATION' ||
    dept === 'ADM' ||
    sub === 'TEAM ADMINISTRATION' ||
    sub === 'ADM'
  ));
  const canManageUsers = isAdmin;

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshUser: loadCurrentUser,
    isAdmin,
    isLead,
    isMember,
    isPurchaser,
    isPurchaserOrAdmin,
    canOrder,
    canViewBudget,
    canEditBudget,
    canManageUsers
  };

  return (
    <AuthContext.Provider value={value}>
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
