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
  const { isProUser, customerInfo, loading, restorePurchases, premiumExpiresAt, premiumSource, isAdmin, refreshSubscriptionStatus } = useSubscription();

  // Refresh subscription status when screen loads
  useEffect(() => {
    refreshSubscriptionStatus();
  }, []);

  // Obtener fecha de expiración (prioriza RevenueCat, luego backend)
  const getExpirationDate = (): string | null => {
    // Si es admin, no tiene fecha de vencimiento
    if (isAdmin) return null;
    
    // Primero intentar obtener de RevenueCat (check multiple entitlement names)
    const activeEntitlements = customerInfo?.entitlements?.active;
    if (activeEntitlements) {
      const entitlement = activeEntitlements['pro'] || 
                          activeEntitlements['Pro'] || 
                          activeEntitlements['premium'] ||
                          activeEntitlements['Premium'] ||
                          activeEntitlements['My Horse Manager Pro'] ||
                          Object.values(activeEntitlements)[0];
      if (entitlement?.expirationDate) {
        return new Date(entitlement.expirationDate).toLocaleDateString();
      }
    }
    
    // Si no hay RevenueCat, usar la fecha del backend
    if (premiumExpiresAt) {
      return new Date(premiumExpiresAt).toLocaleDateString();
    }
    
    return null;
  };

  // Obtener fuente del premium
  const getPremiumSourceLabel = (): string => {
    if (isAdmin) return t('adminPremium');
    if (premiumSource === 'manual') return t('manualPremium');
    
    // Check for any active entitlement
    const activeEntitlements = customerInfo?.entitlements?.active;
    if (activeEntitlements && Object.keys(activeEntitlements).length > 0) {
      return t('subscriptionPremium');
    }
    return '';
  };

  // Abrir gestión de suscripción
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
    // Always refresh status after restore attempt
    await refreshSubscriptionStatus();
    if (success) {
      Alert.alert(t('success'), t('purchasesRestored'));
    } else {
      Alert.alert(t('info'), t('noPurchasesFound'));
    }
  };

  // Ir a pantalla de suscripción
  const handleUpgrade = () => {
    router.push('/subscription');
  };

  const expirationDate = getExpirationDate();
  const premiumSourceLabel = getPremiumSourceLabel();

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
        {/* Status Card */}
        <View style={[styles.statusCard, isProUser ? styles.statusCardPremium : styles.statusCardFree]}>
          <View style={styles.statusIconContainer}>
            <Ionicons 
              name={isProUser ? "star" : "star-outline"} 
              size={40} 
              color={isProUser ? "#FFD700" : "#999"} 
            />
          </View>
          <Text style={[styles.statusTitle, isProUser && styles.statusTitlePremium]}>
            {isProUser ? t('premiumPlan') : t('freePlan')}
          </Text>
          <View style={[styles.statusBadge, isProUser && styles.statusBadgeActive]}>
            <Text style={[styles.statusBadgeText, isProUser && styles.statusBadgeTextActive]}>
              {isProUser ? t('active') : t('inactive')}
            </Text>
          </View>
          
          {isProUser && premiumSourceLabel && (
            <Text style={styles.premiumSourceText}>
              {premiumSourceLabel}
            </Text>
          )}
          
          {isProUser && expirationDate && (
            <Text style={styles.expirationText}>
              {t('expiresOn')}: {expirationDate}
            </Text>
          )}
          
          {isProUser && isAdmin && (
            <Text style={styles.adminText}>
              ∞ {t('noExpiration')}
            </Text>
          )}
        </View>

        {/* Límites actuales */}
        <View style={styles.limitsSection}>
          <Text style={styles.sectionTitle}>{t('yourLimits')}</Text>
          
          <View style={styles.limitItem}>
            <Ionicons name="fitness-outline" size={24} color="#8B4513" />
            <Text style={styles.limitText}>{t('horses')}</Text>
            <Text style={styles.limitValue}>
              {isProUser ? t('unlimited') : `${FREE_LIMITS.horses}`}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="person-outline" size={24} color="#1976D2" />
            <Text style={styles.limitText}>{t('riders')}</Text>
            <Text style={styles.limitValue}>
              {isProUser ? t('unlimited') : `${FREE_LIMITS.riders}`}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="business-outline" size={24} color="#7B1FA2" />
            <Text style={styles.limitText}>{t('suppliers')}</Text>
            <Text style={styles.limitValue}>
              {isProUser ? t('unlimited') : `${FREE_LIMITS.suppliers}`}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="trophy-outline" size={24} color="#FFC107" />
            <Text style={styles.limitText}>{t('competitions')}</Text>
            <Text style={styles.limitValue}>
              {isProUser ? t('unlimited') : `${FREE_LIMITS.competitions}`}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="medal-outline" size={24} color="#FF9800" />
            <Text style={styles.limitText}>{t('palmares')}</Text>
            <Text style={styles.limitValue}>
              {isProUser ? t('unlimited') : `${FREE_LIMITS.palmares}`}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="cash-outline" size={24} color="#4CAF50" />
            <Text style={styles.limitText}>{t('expenses')}</Text>
            <Text style={styles.limitValue}>
              {isProUser ? t('unlimited') : `${FREE_LIMITS.expenses}`}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="notifications-outline" size={24} color="#F44336" />
            <Text style={styles.limitText}>{t('reminders')}</Text>
            <Text style={styles.limitValue}>
              {isProUser ? t('unlimited') : `${FREE_LIMITS.reminders}`}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="download-outline" size={24} color="#607D8B" />
            <Text style={styles.limitText}>{t('exportCSV')}</Text>
            <Text style={[styles.limitValue, !isProUser && styles.limitValueRestricted]}>
              {isProUser ? '✓' : '✗'}
            </Text>
          </View>

          <View style={styles.limitItem}>
            <Ionicons name="stats-chart-outline" size={24} color="#9C27B0" />
            <Text style={styles.limitText}>{t('advancedReports')}</Text>
            <Text style={[styles.limitValue, !isProUser && styles.limitValueRestricted]}>
              {isProUser ? '✓' : '✗'}
            </Text>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionsSection}>
          {!isProUser ? (
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
              <Ionicons name="star" size={24} color="#fff" />
              <Text style={styles.upgradeButtonText}>{t('upgradeToPremium')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
              <Ionicons name="settings-outline" size={24} color="#2E7D32" />
              <Text style={styles.manageButtonText}>{t('manageSubscription')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={loading}>
            <Text style={styles.restoreButtonText}>{t('restorePurchases')}</Text>
          </TouchableOpacity>
        </View>
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
  statusCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusTitlePremium: {
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  statusBadgeActive: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusBadgeTextActive: {
    color: '#fff',
  },
  premiumSourceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    fontStyle: 'italic',
  },
  expirationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  adminText: {
    fontSize: 14,
    color: '#FFD700',
    marginTop: 8,
    fontWeight: 'bold',
  },
  limitsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  limitText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  limitValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  limitValueRestricted: {
    color: '#F44336',
  },
  actionsSection: {
    marginBottom: 40,
  },
  upgradeButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2E7D32',
    gap: 8,
  },
  manageButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 12,
  },
  restoreButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
