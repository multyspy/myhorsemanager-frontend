import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Platform } from 'react-native';
import { api } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// RevenueCat API Keys - PRODUCCIÓN
const REVENUECAT_API_KEYS = {
  apple: 'appl_CkKBisxijTBwQrwlWelUwTGjuEp',
  google: 'goog_SFalMPsWHncznFlnQHiHZYQabDO',
};

interface SubscriptionContextType {
  isProUser: boolean;
  offerings: any | null;
  customerInfo: any | null;
  loading: boolean;
  isConfigured: boolean;
  isAdmin: boolean;
  premiumExpiresAt: string | null;
  premiumSource: string;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [isProUser, setIsProUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [premiumSource, setPremiumSource] = useState<string>('none');
  const [offerings, setOfferings] = useState<any | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Check subscription status from backend (for admin-granted premium)
  const checkBackendSubscriptionStatus = useCallback(async () => {
    try {
      // First check if we have a token
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('SubscriptionContext: No token, user is free');
        setIsProUser(false);
        setIsAdmin(false);
        setPremiumExpiresAt(null);
        setPremiumSource('none');
        setLoading(false);
        return;
      }

      console.log('SubscriptionContext: Checking subscription status...');
      const response = await api.get('/api/user/subscription-status');
      if (response.ok) {
        const data = await response.json();
        console.log('SubscriptionContext: Status received:', data);
        setIsProUser(data.is_premium === true);
        setIsAdmin(data.is_admin === true);
        setPremiumExpiresAt(data.premium_expires_at || null);
        setPremiumSource(data.premium_source || 'none');
      } else {
        console.log('SubscriptionContext: Failed to get status, assuming free user');
        setIsProUser(false);
        setIsAdmin(false);
      }
    } catch (error) {
      console.log('SubscriptionContext: Error checking subscription status:', error);
      setIsProUser(false);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Public method to refresh subscription status (call after login)
  const refreshSubscriptionStatus = useCallback(async () => {
    setLoading(true);
    await checkBackendSubscriptionStatus();
    if (isConfigured) {
      await checkSubscriptionStatus();
    }
  }, [checkBackendSubscriptionStatus, isConfigured]);

  useEffect(() => {
    initializePurchases();
    checkBackendSubscriptionStatus();
    
    // Configurar un intervalo para verificar el token periódicamente
    // Esto detectará cuando el usuario hace login
    const checkInterval = setInterval(async () => {
      const token = await AsyncStorage.getItem('auth_token');
      if (token && !isProUser && premiumSource === 'none') {
        console.log('SubscriptionContext: Token detected, rechecking status...');
        checkBackendSubscriptionStatus();
      }
    }, 2000); // Verificar cada 2 segundos
    
    return () => clearInterval(checkInterval);
  }, [checkBackendSubscriptionStatus]);

  const initializePurchases = async () => {
    // Skip initialization if API keys are not configured
    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEYS.apple 
      : REVENUECAT_API_KEYS.google;
    
    // Check if keys are placeholder values
    if (apiKey.includes('xxxxxxxxx')) {
      console.log('RevenueCat: API keys not configured, skipping initialization');
      setLoading(false);
      return;
    }

    try {
      // Dynamically import RevenueCat only when needed
      const Purchases = require('react-native-purchases').default;
      
      // Configure RevenueCat
      await Purchases.configure({ apiKey });
      setIsConfigured(true);

      // Get offerings
      const fetchedOfferings = await Purchases.getOfferings();
      if (fetchedOfferings.current) {
        setOfferings(fetchedOfferings.current);
      }

      // Check subscription status
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const hasProAccess = typeof info.entitlements.active['pro'] !== 'undefined';
      if (hasProAccess) {
        setIsProUser(true);
      }

      // Listen for changes
      Purchases.addCustomerInfoUpdateListener((info: any) => {
        setCustomerInfo(info);
        const hasProAccess = typeof info.entitlements.active['pro'] !== 'undefined';
        if (hasProAccess) {
          setIsProUser(true);
        }
      });

    } catch (error) {
      // Silently fail - subscriptions just won't work
      console.log('RevenueCat not available:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    // First check backend status
    await checkBackendSubscriptionStatus();
    
    if (!isConfigured) return;
    try {
      const Purchases = require('react-native-purchases').default;
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const hasProAccess = typeof info.entitlements.active['pro'] !== 'undefined';
      if (hasProAccess) {
        setIsProUser(true);
      }
    } catch (error) {
      console.log('Error checking subscription status:', error);
    }
  };

  const purchasePackage = async (pkg: any): Promise<boolean> => {
    if (!isConfigured) {
      console.log('RevenueCat not configured');
      return false;
    }
    try {
      setLoading(true);
      const Purchases = require('react-native-purchases').default;
      const { customerInfo: newInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(newInfo);
      
      if (typeof newInfo.entitlements.active['pro'] !== 'undefined') {
        setIsProUser(true);
        return true;
      }
      return false;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.log('Error purchasing package:', error);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (!isConfigured) {
      console.log('RevenueCat not configured');
      return false;
    }
    try {
      setLoading(true);
      const Purchases = require('react-native-purchases').default;
      const restoredInfo = await Purchases.restorePurchases();
      setCustomerInfo(restoredInfo);
      
      if (typeof restoredInfo.entitlements.active['pro'] !== 'undefined') {
        setIsProUser(true);
        return true;
      }
      return false;
    } catch (error) {
      console.log('Error restoring purchases:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isProUser,
        offerings,
        customerInfo,
        loading,
        isConfigured,
        isAdmin,
        premiumExpiresAt,
        premiumSource,
        purchasePackage,
        restorePurchases,
        checkSubscriptionStatus,
        refreshSubscriptionStatus,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
