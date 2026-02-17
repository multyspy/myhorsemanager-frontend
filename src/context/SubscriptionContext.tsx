import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';

// RevenueCat API Keys - REEMPLAZA CON TUS KEYS REALES
const REVENUECAT_API_KEYS = {
  apple: 'appb480fd8107', // Tu Apple API Key de RevenueCat
  google: 'app51c7d3dcbe', // Tu Google API Key de RevenueCat
};

interface SubscriptionContextType {
  isProUser: boolean;
  offerings: any | null;
  customerInfo: any | null;
  loading: boolean;
  isConfigured: boolean;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [isProUser, setIsProUser] = useState(false);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    initializePurchases();
  }, []);

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
      setIsProUser(hasProAccess);

      // Listen for changes
      Purchases.addCustomerInfoUpdateListener((info: any) => {
        setCustomerInfo(info);
        const hasProAccess = typeof info.entitlements.active['pro'] !== 'undefined';
        setIsProUser(hasProAccess);
      });

    } catch (error) {
      // Silently fail - subscriptions just won't work
      console.log('RevenueCat not available:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!isConfigured) return;
    try {
      const Purchases = require('react-native-purchases').default;
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const hasProAccess = typeof info.entitlements.active['pro'] !== 'undefined';
      setIsProUser(hasProAccess);
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
        purchasePackage,
        restorePurchases,
        checkSubscriptionStatus,
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
