import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useAuth } from './AuthContext';

// RevenueCat API Keys
const REVENUECAT_API_KEYS = {
  apple: 'appl_CkKBisxijTBwQrwlWelUwTGjuEp',
  google: 'goog_SFalMPsWHncznFlnQHiHZYQabDO',
};

// Product IDs exactos - COMPARACIÓN ESTRICTA
const PRODUCT_ID_MONTHLY = 'mhm_monthly';
const PRODUCT_ID_ANNUAL = 'mhm_annual';

// Admin emails (hardcoded para override)
const ADMIN_EMAILS = ['prueba@prueba.com'];

// ============================================
// TIPOS - EXPORTADOS
// ============================================
export type SubscriptionStatus = 'loading' | 'free' | 'premium';

interface SubscriptionContextType {
  // ESTADO PRINCIPAL - Fuente de verdad
  subscriptionStatus: SubscriptionStatus;
  
  // Alias para compatibilidad
  isPremium: boolean;
  isProUser: boolean;
  
  // Detalles de la suscripción
  activeProductId: string | null;
  renewalDate: Date | null;
  planType: 'monthly' | 'annual' | null;
  willRenew: boolean;
  
  // Otros estados
  offerings: any | null;
  loading: boolean;
  isConfigured: boolean;
  currentAppUserId: string | null;
  originalAppUserId: string | null;
  isAdmin: boolean;
  premiumSource: 'revenuecat' | 'admin' | 'backend' | null;
  
  // Funciones
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
  
  // ============================================
  // ESTADO PRINCIPAL: loading | free | premium
  // ============================================
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('loading');
  
  // Detalles de suscripción
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<Date | null>(null);
  const [planType, setPlanType] = useState<'monthly' | 'annual' | null>(null);
  const [willRenew, setWillRenew] = useState(false);
  
  // Otros estados
  const [offerings, setOfferings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentAppUserId, setCurrentAppUserId] = useState<string | null>(null);
  const [originalAppUserId, setOriginalAppUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [premiumSource, setPremiumSource] = useState<'revenuecat' | 'admin' | 'backend' | null>(null);
  
  const configuredRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);
  const listenerAddedRef = useRef(false);

  // ============================================
  // HELPERS
  // ============================================
  
  // Obtener user.id estable (NO email) - NUNCA usar email
  const getStableUserId = useCallback((): string | null => {
    return user?.id || null;
  }, [user]);

  // Verificar si es admin por email
  const checkIsAdmin = useCallback((): boolean => {
    if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return true;
    }
    return false;
  }, [user]);

  // Detectar tipo de plan - COMPARACIÓN ESTRICTA (sin includes)
  // Función pura, no necesita useCallback
  const detectPlanType = useCallback((productId: string): 'monthly' | 'annual' | null => {
    if (productId === PRODUCT_ID_MONTHLY) return 'monthly';
    if (productId === PRODUCT_ID_ANNUAL) return 'annual';
    return null;
  }, []);

  // Seleccionar el mejor entitlement (el de expiración más lejana)
  // Función pura, no necesita dependencias
  const selectBestEntitlement = useCallback((activeEntitlements: Record<string, any>): any | null => {
    const keys = Object.keys(activeEntitlements);
    if (keys.length === 0) return null;
    if (keys.length === 1) return activeEntitlements[keys[0]];
    
    let best: any = null;
    let latestExp: Date | null = null;
    
    for (const key of keys) {
      const ent = activeEntitlements[key];
      if (ent.expirationDate) {
        const exp = new Date(ent.expirationDate);
        if (!latestExp || exp > latestExp) {
          latestExp = exp;
          best = ent;
        }
      } else if (!best) {
        best = ent;
      }
    }
    
    return best || activeEntitlements[keys[0]];
  }, []);

  // Procesar customerInfo y actualizar estado
  const processCustomerInfo = useCallback((customerInfo: any): SubscriptionStatus => {
    // Guardar IDs para depuración
    const appId = customerInfo.appUserId || null;
    const origId = customerInfo.originalAppUserId || null;
    
    console.log('RC: appUserId:', appId);
    console.log('RC: originalAppUserId:', origId);
    
    setCurrentAppUserId(appId);
    setOriginalAppUserId(origId);
    
    // Evaluar entitlements
    const activeEntitlements = customerInfo.entitlements?.active || {};
    console.log('RC: Active entitlements:', Object.keys(activeEntitlements));
    
    const entitlement = selectBestEntitlement(activeEntitlements);
    
    if (entitlement) {
      const productId = entitlement.productIdentifier || '';
      const type = detectPlanType(productId);
      const renewal = entitlement.expirationDate ? new Date(entitlement.expirationDate) : null;
      
      console.log('RC: PREMIUM - Product:', productId, 'Type:', type);
      
      setActiveProductId(productId);
      setPlanType(type);
      setRenewalDate(renewal);
      setWillRenew(entitlement.willRenew !== false);
      setPremiumSource('revenuecat');
      setSubscriptionStatus('premium');
      
      return 'premium';
    } else {
      console.log('RC: No entitlements -> Free');
      setActiveProductId(null);
      setPlanType(null);
      setRenewalDate(null);
      setWillRenew(false);
      setPremiumSource(null);
      setSubscriptionStatus('free');
      
      return 'free';
    }
  }, [selectBestEntitlement, detectPlanType]);

  // ============================================
  // CONFIGURACIÓN DE REVENUECAT
  // ============================================
  const configureRevenueCat = useCallback(async (): Promise<boolean> => {
    if (configuredRef.current) {
      console.log('RC: Already configured');
      return true;
    }

    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEYS.apple 
      : REVENUECAT_API_KEYS.google;

    if (apiKey.includes('xxxxxxxxx')) {
      console.log('RC: API keys not configured');
      return false;
    }

    try {
      const Purchases = require('react-native-purchases').default;
      
      console.log('RC: Configuring...');
      await Purchases.configure({ apiKey });
      
      configuredRef.current = true;
      setIsConfigured(true);
      console.log('RC: Configured OK');
      
      // ============================================
      // LISTENER GLOBAL DE ACTUALIZACIÓN
      // ============================================
      if (!listenerAddedRef.current) {
        Purchases.addCustomerInfoUpdateListener((customerInfo: any) => {
          console.log('=== RC LISTENER: Customer Info Updated ===');
          // Recalcular estado sin hacer logIn
          processCustomerInfo(customerInfo);
        });
        listenerAddedRef.current = true;
        console.log('RC: CustomerInfo listener added');
      }
      
      return true;
    } catch (error) {
      console.log('RC: Configure error:', error);
      return false;
    }
  }, [processCustomerInfo]);

  // ============================================
  // FLUJO PRINCIPAL: RESOLVER ESTADO DE SUSCRIPCIÓN
  // Retorna Promise<SubscriptionStatus> - NUNCA void
  // manageLoading: si true, maneja setLoading(false) en finally
  // ============================================
  const resolveSubscriptionStatus = useCallback(async (
    userId: string | null, 
    manageLoading: boolean = true
  ): Promise<SubscriptionStatus> => {
    console.log('=== RESOLVING SUBSCRIPTION STATUS ===');
    console.log('User ID:', userId, '| manageLoading:', manageLoading);
    
    try {
      // 1. Si es admin, siempre es premium (prioridad máxima)
      const userIsAdmin = checkIsAdmin();
      if (userIsAdmin) {
        console.log('User is ADMIN -> Premium');
        setIsAdmin(true);
        setPremiumSource('admin');
        setSubscriptionStatus('premium');
        return 'premium';
      }
      
      // 2. Si no hay usuario logueado o no hay RC configurado -> free
      if (!userId) {
        console.log('No user ID -> Free');
        setSubscriptionStatus('free');
        return 'free';
      }
      
      if (!configuredRef.current) {
        console.log('RC not configured -> Free');
        setSubscriptionStatus('free');
        return 'free';
      }
      
      const Purchases = require('react-native-purchases').default;
      
      // 3. FORZAR Login a RevenueCat con user.id
      console.log('RC: Forcing logIn as:', userId);
      const { customerInfo } = await Purchases.logIn(userId);
      
      // 4. Procesar customerInfo y retornar estado
      const status = processCustomerInfo(customerInfo);
      return status;
      
    } catch (error) {
      console.log('RC: Error resolving status:', error);
      setSubscriptionStatus('free');
      return 'free';
    } finally {
      // Solo manejar loading si se solicita (evita doble setLoading)
      if (manageLoading) {
        setLoading(false);
      }
    }
  }, [checkIsAdmin, processCustomerInfo]);

  // ============================================
  // OBTENER OFFERINGS
  // ============================================
  const fetchOfferings = useCallback(async () => {
    if (!configuredRef.current) return;

    try {
      const Purchases = require('react-native-purchases').default;
      const fetchedOfferings = await Purchases.getOfferings();
      
      if (fetchedOfferings.current) {
        console.log('RC: Offerings loaded');
        setOfferings(fetchedOfferings.current);
      }
    } catch (error) {
      console.log('RC: Error fetching offerings:', error);
    }
  }, []);

  // ============================================
  // LOGOUT DE REVENUECAT
  // ============================================
  const logoutFromRevenueCat = useCallback(async () => {
    if (!configuredRef.current) return;

    try {
      const Purchases = require('react-native-purchases').default;
      console.log('RC: Logging out...');
      await Purchases.logOut();
      
      // Limpiar estado
      setSubscriptionStatus('free');
      setActiveProductId(null);
      setPlanType(null);
      setRenewalDate(null);
      setWillRenew(false);
      setPremiumSource(null);
      setCurrentAppUserId(null);
      setOriginalAppUserId(null);
      setIsAdmin(false);
      
      console.log('RC: Logged out, status reset to free');
    } catch (error) {
      console.log('RC: Logout error:', error);
    }
  }, []);

  // ============================================
  // INICIALIZACIÓN AL MONTAR
  // ============================================
  useEffect(() => {
    const initialize = async () => {
      console.log('=== APP INIT ===');
      setLoading(true);
      setSubscriptionStatus('loading');
      
      // 1. Configurar RevenueCat
      const configured = await configureRevenueCat();
      if (!configured) {
        setSubscriptionStatus('free');
        setLoading(false);
        return;
      }
      
      // 2. Obtener offerings
      await fetchOfferings();
      
      // 3. Resolver estado de suscripción
      const userId = getStableUserId();
      await resolveSubscriptionStatus(userId);
      previousUserIdRef.current = userId;
    };

    initialize();
  }, []); // Solo al montar

  // ============================================
  // MANEJAR CAMBIOS DE AUTH (LOGIN/LOGOUT)
  // ============================================
  useEffect(() => {
    const handleAuthChange = async () => {
      if (!configuredRef.current) return;

      const newUserId = getStableUserId();
      const previousUserId = previousUserIdRef.current;

      // Usuario cerró sesión
      if (previousUserId && !newUserId) {
        console.log('=== USER LOGGED OUT ===');
        await logoutFromRevenueCat();
        previousUserIdRef.current = null;
      }
      // Usuario inició sesión o cambió
      else if (newUserId && newUserId !== previousUserId) {
        console.log('=== USER LOGGED IN/CHANGED ===');
        
        // Si había usuario anterior, logout primero
        if (previousUserId) {
          await logoutFromRevenueCat();
        }
        
        // Resolver estado para nuevo usuario
        setSubscriptionStatus('loading');
        setLoading(true);
        await resolveSubscriptionStatus(newUserId);
        previousUserIdRef.current = newUserId;
      }
    };

    handleAuthChange();
  }, [user, getStableUserId, logoutFromRevenueCat, resolveSubscriptionStatus]);

  // ============================================
  // COMPRAR - Requiere usuario logueado
  // NUNCA permitir compra si userId es null
  // ============================================
  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    const userId = getStableUserId();
    
    // BLOQUEO: Nunca permitir compra sin usuario
    if (!userId) {
      Alert.alert('Inicia sesión', 'Debes iniciar sesión para suscribirte');
      return false;
    }

    if (!configuredRef.current) {
      Alert.alert('Error', 'Servicio no disponible');
      return false;
    }

    try {
      setLoading(true);
      const Purchases = require('react-native-purchases').default;

      console.log('=== PURCHASE ===');
      console.log('Package:', pkg.identifier);
      console.log('Product ID:', pkg.product?.productIdentifier);
      console.log('User ID:', userId);
      
      // OBLIGATORIO: logIn ANTES de purchasePackage
      console.log('RC: Forcing logIn before purchase...');
      await Purchases.logIn(userId);
      
      // Realizar compra
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      
      console.log('Purchase completed!');
      console.log('RC: Post-purchase appUserId:', customerInfo.appUserId);
      console.log('RC: Post-purchase originalAppUserId:', customerInfo.originalAppUserId);
      
      // manageLoading: false para evitar doble setLoading(false)
      const status = await resolveSubscriptionStatus(userId, false);
      return status === 'premium';

    } catch (error: any) {
      console.log('Purchase error:', error.code, error.message);
      
      if (error.userCancelled) {
        return false;
      }
      
      Alert.alert('Error', error.message || 'No se pudo completar la compra');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getStableUserId, resolveSubscriptionStatus]);

  // ============================================
  // RESTAURAR - Requiere usuario logueado
  // ============================================
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    const userId = getStableUserId();
    
    // BLOQUEO: Nunca restaurar sin usuario
    if (!userId) {
      Alert.alert('Inicia sesión', 'Debes iniciar sesión para restaurar compras');
      return false;
    }

    if (!configuredRef.current) {
      return false;
    }

    try {
      setLoading(true);
      const Purchases = require('react-native-purchases').default;

      console.log('=== RESTORE ===');
      console.log('User ID:', userId);
      
      // OBLIGATORIO: logIn ANTES de restore
      console.log('RC: Forcing logIn before restore...');
      await Purchases.logIn(userId);
      
      // Restaurar
      const customerInfo = await Purchases.restorePurchases();
      
      console.log('Restore completed!');
      console.log('RC: Post-restore appUserId:', customerInfo.appUserId);
      console.log('RC: Post-restore originalAppUserId:', customerInfo.originalAppUserId);
      
      // manageLoading: false para evitar doble setLoading(false)
      const status = await resolveSubscriptionStatus(userId, false);
      return status === 'premium';

    } catch (error: any) {
      console.log('Restore error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getStableUserId, resolveSubscriptionStatus]);

  // ============================================
  // REFRESH MANUAL
  // ============================================
  const refreshSubscriptionStatus = useCallback(async () => {
    const userId = getStableUserId();
    setLoading(true);
    setSubscriptionStatus('loading');
    await resolveSubscriptionStatus(userId);
  }, [getStableUserId, resolveSubscriptionStatus]);

  // ============================================
  // VALORES DERIVADOS
  // ============================================
  const isPremium = subscriptionStatus === 'premium';
  const isProUser = isPremium; // Alias para compatibilidad

  return (
    <SubscriptionContext.Provider
      value={{
        // Estado principal
        subscriptionStatus,
        
        // Alias
        isPremium,
        isProUser,
        
        // Detalles
        activeProductId,
        renewalDate,
        planType,
        willRenew,
        
        // Otros
        offerings,
        loading,
        isConfigured,
        currentAppUserId,
        originalAppUserId,
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
