import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases, { 
  PurchasesOffering, 
  CustomerInfo, 
  PurchasesPackage,
  LOG_LEVEL 
} from 'react-native-purchases';

// RevenueCat API Keys (reemplaza con tus keys reales)
const REVENUECAT_API_KEYS = {
  apple: 'appl_xxxxxxxxxxxxxxxxx', // Tu Apple API Key de RevenueCat
  google: 'goog_xxxxxxxxxxxxxxxxx', // Tu Google API Key de RevenueCat
  test: 'test_xxxxxxxxxxxxxxxxx', // Test API Key para desarrollo
};

interface SubscriptionContextType {
  isProUser: boolean;
  offerings: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  loading: boolean;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [isProUser, setIsProUser] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializePurchases();
  }, []);

  const initializePurchases = async () => {
    try {
      // Configurar nivel de log para debug
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      // Seleccionar API key según plataforma
      let apiKey = REVENUECAT_API_KEYS.test; // Usar test key por defecto en desarrollo
      
      if (!__DEV__) {
        // En producción, usar keys reales
        if (Platform.OS === 'ios') {
          apiKey = REVENUECAT_API_KEYS.apple;
        } else if (Platform.OS === 'android') {
          apiKey = REVENUECAT_API_KEYS.google;
        }
      }

      // Configurar RevenueCat
      await Purchases.configure({ apiKey });

      // Obtener offerings (productos disponibles)
      const fetchedOfferings = await Purchases.getOfferings();
      if (fetchedOfferings.current) {
        setOfferings(fetchedOfferings.current);
      }

      // Verificar estado de suscripción
      await checkSubscriptionStatus();

      // Escuchar cambios en la información del cliente
      Purchases.addCustomerInfoUpdateListener((info) => {
        updateCustomerInfo(info);
      });

    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCustomerInfo = (info: CustomerInfo) => {
    setCustomerInfo(info);
    // Verificar si tiene el entitlement "pro"
    const hasProAccess = typeof info.entitlements.active['pro'] !== 'undefined';
    setIsProUser(hasProAccess);
  };

  const checkSubscriptionStatus = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      updateCustomerInfo(info);
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setLoading(true);
      const { customerInfo: newInfo } = await Purchases.purchasePackage(pkg);
      updateCustomerInfo(newInfo);
      
      if (typeof newInfo.entitlements.active['pro'] !== 'undefined') {
        Alert.alert('¡Éxito!', '¡Bienvenido a Premium! Ya tienes acceso a todas las funciones.');
        return true;
      }
      return false;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('Error purchasing package:', error);
        Alert.alert('Error', 'No se pudo completar la compra. Inténtalo de nuevo.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      setLoading(true);
      const restoredInfo = await Purchases.restorePurchases();
      updateCustomerInfo(restoredInfo);
      
      if (typeof restoredInfo.entitlements.active['pro'] !== 'undefined') {
        Alert.alert('¡Éxito!', 'Tus compras han sido restauradas.');
        return true;
      } else {
        Alert.alert('Info', 'No se encontraron compras anteriores.');
        return false;
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert('Error', 'No se pudieron restaurar las compras.');
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
