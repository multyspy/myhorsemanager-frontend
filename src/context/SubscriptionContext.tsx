import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

// RevenueCat API Keys
const REVENUECAT_API_KEYS = {
  apple: 'appl_CkKBisxijTBwQrwlWelUwTGjuEp',
  google: 'goog_SFalMPsWHncznFlnQHiHZYQabDO',
};

// Entitlement identifier en RevenueCat
const ENTITLEMENT_ID = 'My Horse Manager Pro';

// Product IDs exactos (igualdad estricta)
const PRODUCT_ID_MONTHLY = 'mhm_monthly';
const PRODUCT_ID_ANNUAL = 'mhm_annual';

interface SubscriptionState {
  isPremium: boolean;
  activeProductId: string | null;
  renewalDate: Date | null;
  planType: 'monthly' | 'annual' | null;
  willRenew: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  offerings: any | null;
  loading: boolean;
  isConfigured: boolean;
  currentAppUserId: string | null;
  isAdmin: boolean;
  premiumSource: 'revenuecat' | 'admin' | 'backend' | null;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  
  // Estado central de suscripción
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>({
    isPremium: false,
    activeProductId: null,
    renewalDate: null,
    planType: null,
    willRenew: false,
  });
  
  const [offerings, setOfferings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentAppUserId, setCurrentAppUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [premiumSource, setPremiumSource] = useState<'revenuecat' | 'admin' | 'backend' | null>(null);
  
  const configuredRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  // ============================================
  // FIX 1: Usar user.id interno (NO email)
  // ============================================
  const getStableUserId = useCallback((): string | null => {
    // IMPORTANTE: Usar el ID de la base de datos, NO el email
    if (user && user.id) {
      console.log('RevenueCat: Using stable user ID:', user.id);
      return user.id;
    }
    return null;
  }, [user]);

  // ============================================
  // FIX 3 y 4: Detección de plan con igualdad estricta
  // y selección del entitlement correcto
  // ============================================
  const detectPlanType = (productId: string): 'monthly' | 'annual' | null => {
    // FIX 3: Igualdad estricta, no includes
    if (productId === PRODUCT_ID_MONTHLY) return 'monthly';
    if (productId === PRODUCT_ID_ANNUAL) return 'annual';
    return null;
  };

  // FIX 4: Seleccionar el entitlement activo correcto (el de expiración más lejana)
  const selectBestEntitlement = (activeEntitlements: Record<string, any>): any | null => {
    const entitlementKeys = Object.keys(activeEntitlements);
    
    if (entitlementKeys.length === 0) return null;
    if (entitlementKeys.length === 1) return activeEntitlements[entitlementKeys[0]];
    
    // Si hay varios, elegir el de expirationDate más lejana
    let bestEntitlement: any = null;
    let latestExpiration: Date | null = null;
    
    for (const key of entitlementKeys) {
      const ent = activeEntitlements[key];
      if (ent.expirationDate) {
        const expDate = new Date(ent.expirationDate);
        if (!latestExpiration || expDate > latestExpiration) {
          latestExpiration = expDate;
          bestEntitlement = ent;
        }
      } else if (!bestEntitlement) {
        // Si no tiene fecha, tomarlo solo si no hay otro mejor
        bestEntitlement = ent;
      }
    }
    
    return bestEntitlement || activeEntitlements[entitlementKeys[0]];
  };

  // FUNCIÓN PRINCIPAL: Obtiene CustomerInfo y actualiza el estado global
  const fetchCustomerInfo = useCallback(async () => {
    if (!configuredRef.current) {
      console.log('RevenueCat: Not configured, cannot fetch customer info');
      return null;
    }

    try {
      const Purchases = require('react-native-purchases').default;
      const customerInfo = await Purchases.getCustomerInfo();
      
      console.log('RevenueCat: CustomerInfo fetched');
      console.log('RevenueCat: App User ID:', customerInfo.originalAppUserId);
      setCurrentAppUserId(customerInfo.originalAppUserId);
      
      // Verificar entitlements activos
      const activeEntitlements = customerInfo.entitlements?.active || {};
      console.log('RevenueCat: Active entitlements:', Object.keys(activeEntitlements));
      
      // FIX 4: Seleccionar el mejor entitlement
      const entitlement = selectBestEntitlement(activeEntitlements);
      
      if (entitlement) {
        const productId = entitlement.productIdentifier || '';
        
        // FIX 3: Usar igualdad estricta para detectar plan
        const planType = detectPlanType(productId);
        
        // La fecha de expiración es la fecha de renovación (viene de RevenueCat)
        let renewalDate: Date | null = null;
        if (entitlement.expirationDate) {
          renewalDate = new Date(entitlement.expirationDate);
        }
        
        console.log('RevenueCat: Premium ACTIVE');
        console.log('RevenueCat: Product ID:', productId);
        console.log('RevenueCat: Plan Type:', planType);
        console.log('RevenueCat: Renewal Date:', renewalDate);
        console.log('RevenueCat: Will Renew:', entitlement.willRenew);
        
        setSubscriptionState({
          isPremium: true,
          activeProductId: productId,
          renewalDate: renewalDate,
          planType: planType,
          willRenew: entitlement.willRenew !== false,
        });
        setPremiumSource('revenuecat');
        
      } else {
        // Usuario sin suscripción activa
        console.log('RevenueCat: No active entitlements - FREE user');
        
        setSubscriptionState({
          isPremium: false,
          activeProductId: null,
          renewalDate: null,
          planType: null,
          willRenew: false,
        });
        setPremiumSource(null);
      }
      
      return customerInfo;
      
    } catch (error) {
      console.log('RevenueCat: Error fetching customer info:', error);
      return null;
    }
  }, []);

  // Configurar RevenueCat (solo una vez al iniciar)
  const configureRevenueCat = useCallback(async () => {
    if (configuredRef.current) {
      console.log('RevenueCat: Already configured');
      return true;
    }

    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEYS.apple 
      : REVENUECAT_API_KEYS.google;

    if (apiKey.includes('xxxxxxxxx')) {
      console.log('RevenueCat: API keys not configured');
      return false;
    }

    try {
      const Purchases = require('react-native-purchases').default;
      
      console.log('RevenueCat: Configuring...');
      await Purchases.configure({ apiKey });
      
      configuredRef.current = true;
      setIsConfigured(true);
      console.log('RevenueCat: Configured successfully');
      
      // Listener para cambios en CustomerInfo
      Purchases.addCustomerInfoUpdateListener((info: any) => {
        console.log('RevenueCat: CustomerInfo updated via listener');
        fetchCustomerInfo();
      });
      
      return true;
    } catch (error) {
      console.log('RevenueCat: Configuration error:', error);
      return false;
    }
  }, [fetchCustomerInfo]);

  // FIX 1: Login a RevenueCat con user.id (NO email)
  const loginToRevenueCat = useCallback(async (userId: string) => {
    if (!configuredRef.current) return null;

    try {
      const Purchases = require('react-native-purchases').default;
      
      // FIX 1: Usar ID interno, no email
      console.log('RevenueCat: Logging in with stable user ID:', userId);
      const { customerInfo } = await Purchases.logIn(userId);
      
      console.log('RevenueCat: Login successful, App User ID now:', customerInfo.originalAppUserId);
      setCurrentAppUserId(customerInfo.originalAppUserId);
      
      // Después de login, actualizar estado
      await fetchCustomerInfo();
      
      return customerInfo;
    } catch (error) {
      console.log('RevenueCat: Login error:', error);
      return null;
    }
  }, [fetchCustomerInfo]);

  // Logout de RevenueCat
  const logoutFromRevenueCat = useCallback(async () => {
    if (!configuredRef.current) return;

    try {
      const Purchases = require('react-native-purchases').default;
      
      console.log('RevenueCat: Logging out...');
      await Purchases.logOut();
      
      // Limpiar estado completamente
      setSubscriptionState({
        isPremium: false,
        activeProductId: null,
        renewalDate: null,
        planType: null,
        willRenew: false,
      });
      setPremiumSource(null);
      setCurrentAppUserId(null);
      setIsAdmin(false);
      
      console.log('RevenueCat: Logged out, state cleared');
    } catch (error) {
      console.log('RevenueCat: Logout error:', error);
    }
  }, []);

  // Obtener offerings
  const fetchOfferings = useCallback(async () => {
    if (!configuredRef.current) return null;

    try {
      const Purchases = require('react-native-purchases').default;
      const fetchedOfferings = await Purchases.getOfferings();
      
      if (fetchedOfferings.current) {
        console.log('RevenueCat: Offerings loaded');
        setOfferings(fetchedOfferings.current);
      }
      
      return fetchedOfferings;
    } catch (error) {
      console.log('RevenueCat: Error fetching offerings:', error);
      return null;
    }
  }, []);

  // Verificar estado premium del backend (para admin)
  const checkBackendStatus = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user/subscription-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Backend: Subscription status:', data);
        
        setIsAdmin(data.is_admin || false);
        
        // Si es admin, es premium automáticamente
        if (data.is_admin) {
          setSubscriptionState(prev => ({
            ...prev,
            isPremium: true,
          }));
          setPremiumSource('admin');
        }
        // Si tiene premium manual del backend y no tiene de RevenueCat
        else if (data.is_premium && !subscriptionState.isPremium) {
          setSubscriptionState(prev => ({
            ...prev,
            isPremium: true,
            renewalDate: data.premium_expires_at ? new Date(data.premium_expires_at) : null,
          }));
          setPremiumSource('backend');
        }
      }
    } catch (error) {
      console.log('Backend: Error checking status:', error);
    }
  }, [token, subscriptionState.isPremium]);

  // INICIALIZACIÓN - App Start
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      
      // 1. Configurar RevenueCat
      const configured = await configureRevenueCat();
      if (!configured) {
        setLoading(false);
        return;
      }

      // 2. Si hay usuario logueado, hacer login en RevenueCat con user.id
      const userId = getStableUserId();
      if (userId) {
        console.log('Init: User found, logging in to RevenueCat with ID:', userId);
        await loginToRevenueCat(userId);
        previousUserIdRef.current = userId;
      } else {
        // Usuario anónimo - solo obtener CustomerInfo (no puede comprar)
        console.log('Init: No user logged in, getting anonymous info');
        await fetchCustomerInfo();
      }

      // 3. Obtener offerings
      await fetchOfferings();

      // 4. Verificar backend (para admin)
      await checkBackendStatus();

      setLoading(false);
    };

    initialize();
  }, []); // Solo al montar

  // MANEJO DE LOGIN/LOGOUT
  useEffect(() => {
    const handleAuthChange = async () => {
      if (!configuredRef.current) return;

      const newUserId = getStableUserId();
      const previousUserId = previousUserIdRef.current;

      // Usuario cerró sesión
      if (previousUserId && !newUserId) {
        console.log('Auth: User logged out, calling RevenueCat logOut');
        await logoutFromRevenueCat();
        previousUserIdRef.current = null;
      }
      // Usuario inició sesión o cambió
      else if (newUserId && newUserId !== previousUserId) {
        if (previousUserId) {
          console.log('Auth: User changed, logging out previous user first');
          await logoutFromRevenueCat();
        }
        
        console.log('Auth: New user logged in, calling RevenueCat logIn with ID:', newUserId);
        await loginToRevenueCat(newUserId);
        await checkBackendStatus();
        previousUserIdRef.current = newUserId;
      }
    };

    handleAuthChange();
  }, [user, getStableUserId, loginToRevenueCat, logoutFromRevenueCat, checkBackendStatus]);

  // ============================================
  // FIX 2: COMPRA - Bloquear si no hay sesión
  // ============================================
  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    // FIX 2: BLOQUEAR si no hay usuario logueado
    const userId = getStableUserId();
    
    if (!userId) {
      console.log('RevenueCat: BLOCKED - Cannot purchase without logged in user');
      Alert.alert(
        'Inicia sesión',
        'Debes iniciar sesión para activar Premium',
        [{ text: 'OK' }]
      );
      return false;
    }

    if (!configuredRef.current) {
      Alert.alert('Error', 'Servicio de suscripciones no disponible');
      return false;
    }

    // Verificar que el App User ID actual coincide con nuestro userId
    const Purchases = require('react-native-purchases').default;
    const currentInfo = await Purchases.getCustomerInfo();
    
    if (currentInfo.originalAppUserId !== userId) {
      console.log('RevenueCat: App User ID mismatch, re-logging in');
      console.log('  Current:', currentInfo.originalAppUserId);
      console.log('  Expected:', userId);
      await loginToRevenueCat(userId);
    }

    try {
      setLoading(true);

      console.log('Purchase: Starting for package:', pkg.identifier);
      console.log('Purchase: Product:', pkg.product?.identifier);
      console.log('Purchase: User ID:', userId);
      
      // Realizar compra (esto abre el sheet de Apple)
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      
      console.log('Purchase: Completed successfully!');
      console.log('Purchase: New App User ID:', customerInfo.originalAppUserId);
      
      // IMPORTANTE: Actualizar estado inmediatamente después de compra
      await fetchCustomerInfo();
      
      return true;

    } catch (error: any) {
      console.log('Purchase: Error:', error.code, error.message);
      
      if (error.userCancelled) {
        console.log('Purchase: User cancelled');
        return false;
      }
      
      Alert.alert('Error', error.message || 'No se pudo completar la compra');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getStableUserId, fetchCustomerInfo, loginToRevenueCat]);

  // ============================================
  // FIX 2: RESTAURAR - Bloquear si no hay sesión
  // ============================================
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    // FIX 2: BLOQUEAR si no hay usuario logueado
    const userId = getStableUserId();
    
    if (!userId) {
      console.log('RevenueCat: BLOCKED - Cannot restore without logged in user');
      Alert.alert(
        'Inicia sesión',
        'Debes iniciar sesión para restaurar compras',
        [{ text: 'OK' }]
      );
      return false;
    }

    if (!configuredRef.current) {
      return false;
    }

    try {
      setLoading(true);
      const Purchases = require('react-native-purchases').default;

      console.log('Restore: Starting for user ID:', userId);
      await Purchases.restorePurchases();
      
      console.log('Restore: Completed');
      
      // IMPORTANTE: Actualizar estado inmediatamente después de restaurar
      await fetchCustomerInfo();
      
      return subscriptionState.isPremium;

    } catch (error: any) {
      console.log('Restore: Error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getStableUserId, fetchCustomerInfo, subscriptionState.isPremium]);

  // Refresh manual del estado
  const refreshSubscriptionStatus = useCallback(async () => {
    setLoading(true);
    await fetchCustomerInfo();
    await checkBackendStatus();
    setLoading(false);
  }, [fetchCustomerInfo, checkBackendStatus]);

  return (
    <SubscriptionContext.Provider
      value={{
        // Estado de suscripción
        isPremium: subscriptionState.isPremium,
        activeProductId: subscriptionState.activeProductId,
        renewalDate: subscriptionState.renewalDate,
        planType: subscriptionState.planType,
        willRenew: subscriptionState.willRenew,
        // Otros
        offerings,
        loading,
        isConfigured,
        currentAppUserId,
        isAdmin,
        premiumSource,
        // Funciones
        purchasePackage,
        restorePurchases,
        refreshSubscriptionStatus,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
