// Importar tipo desde el contexto
import type { SubscriptionStatus } from '../context/SubscriptionContext';

// Re-exportar para uso en otros archivos
export type { SubscriptionStatus };

// Límites para usuarios gratuitos
export const FREE_LIMITS = {
  horses: 1,
  riders: 1,
  suppliers: 1,
  competitions: 1,
  palmares: 1,
  expenses: 3,
  reminders: 1,
  photos: 1, // Límite de fotos por item
};

// Funciones premium (bloqueadas para usuarios gratuitos)
export const PREMIUM_FEATURES = {
  exportCSV: true,
  advancedReports: true,
  unlimitedItems: true,
  unlimitedPhotos: true,
};

// Verificar si el usuario puede añadir más items
// Ahora acepta tanto boolean (compatibilidad) como SubscriptionStatus
export const canAddMore = (
  isProUserOrStatus: boolean | SubscriptionStatus,
  itemType: keyof typeof FREE_LIMITS,
  currentCount: number
): boolean => {
  // Si es un string (SubscriptionStatus), verificar si es premium
  if (typeof isProUserOrStatus === 'string') {
    if (isProUserOrStatus === 'premium') return true;
    if (isProUserOrStatus === 'loading') return true; // Permitir mientras carga para no bloquear
    return currentCount < FREE_LIMITS[itemType];
  }
  // Compatibilidad con boolean
  if (isProUserOrStatus) return true;
  return currentCount < FREE_LIMITS[itemType];
};

// Verificar si se debe mostrar el popup de límite
// IMPORTANTE: Esta función retorna false si está cargando (no mostrar popup)
export const shouldShowLimitPopup = (
  subscriptionStatus: SubscriptionStatus,
  itemType: keyof typeof FREE_LIMITS,
  currentCount: number
): boolean => {
  // NUNCA mostrar popup mientras carga
  if (subscriptionStatus === 'loading') return false;
  // Si es premium, no mostrar popup
  if (subscriptionStatus === 'premium') return false;
  // Solo mostrar si es free y ha alcanzado el límite
  return currentCount >= FREE_LIMITS[itemType];
};

// Obtener el límite para un tipo de item
export const getLimit = (
  isProUser: boolean,
  itemType: keyof typeof FREE_LIMITS
): number | 'unlimited' => {
  if (isProUser) return 'unlimited';
  return FREE_LIMITS[itemType];
};

// Verificar si una función premium está disponible
export const canUseFeature = (
  isProUser: boolean,
  feature: keyof typeof PREMIUM_FEATURES
): boolean => {
  if (isProUser) return true;
  return false;
};

// Mensaje de límite alcanzado
export const getLimitMessage = (
  itemType: keyof typeof FREE_LIMITS,
  t: (key: string) => string
): string => {
  const limit = FREE_LIMITS[itemType];
  return t('limitReached').replace('{limit}', String(limit));
};
