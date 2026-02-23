import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../src/context/SubscriptionContext';
import { FREE_LIMITS } from '../src/utils/subscriptionLimits';

export default function MyPlanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  
  // Lee directamente del estado global (fuente de verdad)
  const { 
    isPremium,
    activeProductId,
    renewalDate,
    planType,
    willRenew,
    loading, 
    restorePurchases, 
    isAdmin, 
    premiumSource,
    refreshSubscriptionStatus,
    currentAppUserId,
  } = useSubscription();

  // Refresh al cargar la pantalla
  useEffect(() => {
    refreshSubscriptionStatus();
  }, []);

  // Formatear fecha de renovación
  const formatRenewalDate = (date: Date | null): string | null => {
    if (!date) return null;
    try {
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return date.toISOString();
    }
  };

  // Obtener etiqueta del tipo de plan (FIX 3: igualdad estricta)
  const getPlanLabel = (): string => {
    if (isAdmin) return 'Admin Premium';
    if (premiumSource === 'backend') return 'Premium Manual';
    
    // FIX 3: Igualdad estricta
    if (activeProductId === 'mhm_monthly') return 'Premium Mensual';
    if (activeProductId === 'mhm_annual') return 'Premium Anual';
    
    return isPremium ? 'Premium' : 'Gratuito';
  };

  // Abrir gestión de suscripción (Apple/Google)
  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  // Restaurar compras
  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      Alert.alert('Éxito', 'Compras restauradas correctamente');
    } else {
      Alert.alert('Info', 'No se encontraron compras anteriores');
    }
  };

  // Ir a pantalla de suscripción
  const handleUpgrade = () => {
    router.push('/subscription');
  };

  const formattedRenewalDate = formatRenewalDate(renewalDate);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myPlan')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        ) : (
          <>
            {/* TARJETA DE ESTADO */}
            <View style={[styles.statusCard, isPremium ? styles.statusCardPremium : styles.statusCardFree]}>
              
              {/* Icono */}
              <View style={styles.statusIconContainer}>
                <Ionicons 
                  name={isPremium ? "star" : "star-outline"} 
                  size={48} 
                  color={isPremium ? "#FFD700" : "#999"} 
                />
              </View>
              
              {/* Estado: Premium Activo / Free */}
              <Text style={[styles.statusTitle, isPremium && styles.statusTitlePremium]}>
                {isPremium ? 'Premium Activo' : 'Plan Gratuito'}
              </Text>
              
              {/* Badge Activo/Inactivo */}
              <View style={[styles.statusBadge, isPremium && styles.statusBadgeActive]}>
                <Text style={[styles.statusBadgeText, isPremium && styles.statusBadgeTextActive]}>
                  {isPremium ? 'ACTIVO' : 'INACTIVO'}
                </Text>
              </View>
              
              {/* Plan: Mensual / Anual */}
              {isPremium && !isAdmin && (
                <View style={styles.planTypeContainer}>
                  <Ionicons 
                    name={planType === 'annual' ? 'calendar' : 'calendar-outline'} 
                    size={18} 
                    color={isPremium ? '#fff' : '#666'} 
                  />
                  <Text style={[styles.planTypeText, isPremium && styles.planTypeTextPremium]}>
                    Plan: {planType === 'monthly' ? 'Mensual' : planType === 'annual' ? 'Anual' : 'N/A'}
                  </Text>
                </View>
              )}
              
              {/* Renueva el: fecha */}
              {isPremium && formattedRenewalDate && !isAdmin && (
                <View style={styles.renewalContainer}>
                  <Ionicons name="refresh-circle" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.renewalText}>
                    {willRenew ? 'Renueva el:' : 'Expira el:'} {formattedRenewalDate}
                  </Text>
                </View>
              )}
              
              {/* Estado de auto-renovación */}
              {isPremium && !isAdmin && premiumSource === 'revenuecat' && (
                <Text style={styles.autoRenewText}>
                  {willRenew 
                    ? '✓ Renovación automática activa' 
                    : '✗ Renovación automática desactivada'}
                </Text>
              )}
              
              {/* Admin: acceso ilimitado */}
              {isPremium && isAdmin && (
                <View style={styles.adminContainer}>
                  <Ionicons name="infinite" size={24} color="#FFD700" />
                  <Text style={styles.adminText}>Acceso ilimitado como Admin</Text>
                </View>
              )}
              
              {/* Fuente del premium */}
              {isPremium && premiumSource && (
                <Text style={styles.sourceText}>
                  {premiumSource === 'revenuecat' ? 'Suscripción App Store' : 
                   premiumSource === 'admin' ? 'Acceso de administrador' : 
                   premiumSource === 'backend' ? 'Asignado manualmente' : ''}
                </Text>
              )}
            </View>

            {/* LÍMITES */}
            <View style={styles.limitsSection}>
              <Text style={styles.sectionTitle}>{t('yourLimits')}</Text>
              
              <View style={styles.limitItem}>
                <Ionicons name="fitness-outline" size={24} color="#8B4513" />
                <Text style={styles.limitText}>{t('horses')}</Text>
                <Text style={styles.limitValue}>
                  {isPremium ? '∞' : FREE_LIMITS.horses}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Ionicons name="person-outline" size={24} color="#1976D2" />
                <Text style={styles.limitText}>{t('riders')}</Text>
                <Text style={styles.limitValue}>
                  {isPremium ? '∞' : FREE_LIMITS.riders}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Ionicons name="business-outline" size={24} color="#7B1FA2" />
                <Text style={styles.limitText}>{t('suppliers')}</Text>
                <Text style={styles.limitValue}>
                  {isPremium ? '∞' : FREE_LIMITS.suppliers}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Ionicons name="trophy-outline" size={24} color="#FFC107" />
                <Text style={styles.limitText}>{t('competitions')}</Text>
                <Text style={styles.limitValue}>
                  {isPremium ? '∞' : FREE_LIMITS.competitions}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Ionicons name="medal-outline" size={24} color="#FF9800" />
                <Text style={styles.limitText}>{t('palmares')}</Text>
                <Text style={styles.limitValue}>
                  {isPremium ? '∞' : FREE_LIMITS.palmares}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Ionicons name="cash-outline" size={24} color="#4CAF50" />
                <Text style={styles.limitText}>{t('expenses')}</Text>
                <Text style={styles.limitValue}>
                  {isPremium ? '∞' : FREE_LIMITS.expenses}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Ionicons name="notifications-outline" size={24} color="#F44336" />
                <Text style={styles.limitText}>{t('reminders')}</Text>
                <Text style={styles.limitValue}>
                  {isPremium ? '∞' : FREE_LIMITS.reminders}
                </Text>
              </View>

              <View style={styles.limitItem}>
                <Ionicons name="download-outline" size={24} color="#607D8B" />
                <Text style={styles.limitText}>Exportar CSV</Text>
                <Text style={[styles.limitValue, !isPremium && styles.limitValueRestricted]}>
                  {isPremium ? '✓' : '✗'}
                </Text>
              </View>
            </View>

            {/* BOTONES */}
            <View style={styles.actionsSection}>
              {!isPremium ? (
                <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
                  <Ionicons name="star" size={24} color="#fff" />
                  <Text style={styles.upgradeButtonText}>Actualizar a Premium</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
                  <Ionicons name="settings-outline" size={24} color="#2E7D32" />
                  <Text style={styles.manageButtonText}>Gestionar suscripción</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={loading}>
                <Text style={styles.restoreButtonText}>Restaurar compras</Text>
              </TouchableOpacity>
            </View>

            {/* DEBUG (solo en desarrollo) */}
            {__DEV__ && (
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>🔧 Debug Info</Text>
                <Text style={styles.debugText}>App User ID: {currentAppUserId || 'N/A'}</Text>
                <Text style={styles.debugText}>isPremium: {isPremium ? 'true' : 'false'}</Text>
                <Text style={styles.debugText}>planType: {planType || 'N/A'}</Text>
                <Text style={styles.debugText}>productId: {activeProductId || 'N/A'}</Text>
                <Text style={styles.debugText}>willRenew: {willRenew ? 'true' : 'false'}</Text>
                <Text style={styles.debugText}>premiumSource: {premiumSource || 'N/A'}</Text>
                <Text style={styles.debugText}>renewalDate: {renewalDate?.toISOString() || 'N/A'}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  statusCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  statusCardFree: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusCardPremium: {
    backgroundColor: '#2E7D32',
  },
  statusIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusTitlePremium: {
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
  },
  statusBadgeActive: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: 1,
  },
  statusBadgeTextActive: {
    color: '#fff',
  },
  planTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    marginBottom: 12,
  },
  planTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  planTypeTextPremium: {
    color: '#fff',
  },
  renewalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  renewalText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
  },
  autoRenewText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  adminContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  adminText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  sourceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    fontStyle: 'italic',
  },
  limitsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  limitText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 14,
  },
  limitValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  limitValueRestricted: {
    color: '#F44336',
  },
  actionsSection: {
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  manageButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#2E7D32',
    gap: 10,
  },
  manageButtonText: {
    color: '#2E7D32',
    fontSize: 17,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 12,
  },
  restoreButtonText: {
    color: '#666',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  debugSection: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 11,
    color: '#bf360c',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
