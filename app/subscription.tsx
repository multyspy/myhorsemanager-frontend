import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../src/context/SubscriptionContext';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { offerings, isProUser, loading, purchasePackage, restorePurchases, isConfigured, refreshSubscriptionStatus } = useSubscription();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // URLs de las tiendas
  const APP_STORE_URL = 'https://apps.apple.com/app/my-horse-manager/id6450661480';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.myhorse.manager';

  const openStore = async () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(t('error'), t('cannotOpenStore'));
    }
  };

  const openSubscriptionManagement = async () => {
    const url = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(t('error'), t('cannotOpenStore'));
    }
  };

  const handlePurchase = async (pkg: any) => {
    setPurchasing(true);
    setSelectedPackage(pkg.identifier);
    
    const success = await purchasePackage(pkg);
    
    if (success) {
      // Refresh subscription status to update UI immediately
      await refreshSubscriptionStatus();
      Alert.alert(
        t('success'),
        t('purchaseSuccessful'),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
    
    setPurchasing(false);
    setSelectedPackage(null);
  };

  const handleRestore = async () => {
    setPurchasing(true);
    await restorePurchases();
    setPurchasing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isProUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('subscription')}</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.proContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#2E7D32" />
          <Text style={styles.proTitle}>{t('youArePremium')}</Text>
          <Text style={styles.proSubtitle}>{t('premiumDescription')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('goPremium')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Ionicons name="star" size={60} color="#FFD700" />
          <Text style={styles.heroTitle}>My Horse Manager</Text>
          <Text style={styles.heroSubtitle}>Premium</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>{t('premiumFeatures')}</Text>
          
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            <Text style={styles.featureText}>{t('feature1')}</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            <Text style={styles.featureText}>{t('feature2')}</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            <Text style={styles.featureText}>{t('feature3')}</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            <Text style={styles.featureText}>{t('feature4')}</Text>
          </View>
        </View>

        {/* Packages */}
        <View style={styles.packagesSection}>
          {offerings?.availablePackages.map((pkg: any) => {
            // COMPARACIÓN ESTRICTA - Sin includes()
            const productId = pkg.product?.productIdentifier || '';
            const isMonthly = productId === 'mhm_monthly';
            const isAnnual = productId === 'mhm_annual';
            const isSelected = selectedPackage === pkg.identifier;
            
            // Debug: log package info
            console.log('Package:', pkg.identifier, 'ProductID:', productId, 'isMonthly:', isMonthly, 'isAnnual:', isAnnual);
            
            return (
              <TouchableOpacity
                key={pkg.identifier}
                style={[
                  styles.packageCard,
                  isAnnual && styles.packageCardHighlighted,
                  isSelected && styles.packageCardSelected,
                ]}
                onPress={() => handlePurchase(pkg)}
                disabled={purchasing}
              >
                {isAnnual && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>{t('bestValue')}</Text>
                  </View>
                )}
                
                <View style={styles.packageHeader}>
                  <Text style={[styles.packageTitle, isAnnual && styles.packageTitleHighlighted]}>
                    {isMonthly ? t('monthly') : isAnnual ? t('annual') : pkg.identifier}
                  </Text>
                  <Text style={[styles.packagePrice, isAnnual && styles.packagePriceHighlighted]}>
                    {pkg.product.priceString}
                  </Text>
                  <Text style={[styles.packagePeriod, isAnnual && styles.packagePeriodHighlighted]}>
                    {isMonthly ? t('perMonth') : isAnnual ? t('perYear') : ''}
                  </Text>
                </View>

                {isAnnual && (
                  <Text style={styles.savingsText}>{t('save30')}</Text>
                )}

                {purchasing && isSelected ? (
                  <ActivityIndicator color={isAnnual ? '#fff' : '#2E7D32'} />
                ) : (
                  <View style={[styles.selectButton, isAnnual && styles.selectButtonHighlighted]}>
                    <Text style={[styles.selectButtonText, isAnnual && styles.selectButtonTextHighlighted]}>
                      {t('subscribe')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* No offerings fallback - Show store links */}
        {(!offerings || offerings.availablePackages.length === 0) && (
          <View style={styles.noOfferings}>
            <Ionicons name="storefront-outline" size={48} color="#999" />
            <Text style={styles.noOfferingsTitle}>{t('subscribeInStore')}</Text>
            <Text style={styles.noOfferingsText}>{t('subscribeInStoreDescription')}</Text>
            
            <TouchableOpacity 
              style={styles.storeButton} 
              onPress={openStore}
            >
              <Ionicons 
                name={Platform.OS === 'ios' ? 'logo-apple-appstore' : 'logo-google-playstore'} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.storeButtonText}>
                {Platform.OS === 'ios' ? t('openAppStore') : t('openPlayStore')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Restore Purchases */}
        <TouchableOpacity 
          style={styles.restoreButton} 
          onPress={handleRestore}
          disabled={purchasing}
        >
          <Text style={styles.restoreText}>{t('restorePurchases')}</Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.termsText}>
          {t('subscriptionTerms')}
        </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  proContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  proTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 16,
  },
  proSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 20,
    color: '#2E7D32',
    fontWeight: '600',
  },
  featuresSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  packagesSection: {
    padding: 16,
    gap: 12,
  },
  packageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  packageCardHighlighted: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  packageCardSelected: {
    borderColor: '#2E7D32',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  packageHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  packagePrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  packagePeriod: {
    fontSize: 14,
    color: '#666',
  },
  packageTitleHighlighted: {
    color: '#fff',
  },
  packagePriceHighlighted: {
    color: '#fff',
  },
  packagePeriodHighlighted: {
    color: 'rgba(255,255,255,0.8)',
  },
  savingsText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
    marginBottom: 12,
  },
  selectButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectButtonHighlighted: {
    backgroundColor: '#fff',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  selectButtonTextHighlighted: {
    color: '#2E7D32',
  },
  noOfferings: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
  },
  noOfferingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noOfferingsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  storeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 14,
    color: '#2E7D32',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    lineHeight: 18,
  },
});
