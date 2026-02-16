import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { api } from '../src/utils/api';

export default function SettingsScreen() {
  const { user, logout, changeLanguage } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const handleLogout = () => {
    Alert.alert(
      t('logout'),
      t('logoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    const confirmDelete = async () => {
      try {
        const response = await api.delete('/api/auth/delete-account');
        if (response.ok) {
          Alert.alert(
            t('accountDeleted'),
            t('accountDeletedMessage'),
            [{ text: 'OK', onPress: () => {
              logout();
              router.replace('/login');
            }}]
          );
        } else {
          Alert.alert(t('error'), t('deleteAccountError'));
        }
      } catch (error) {
        console.error('Delete account error:', error);
        Alert.alert(t('error'), t('connectionError'));
      }
    };

    if (Platform.OS === 'web') {
      try {
        const confirmed = window.confirm(t('deleteAccountConfirm'));
        if (confirmed) {
          confirmDelete();
        }
      } catch (e) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        t('deleteAccount'),
        t('deleteAccountConfirm'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: confirmDelete,
          },
        ]
      );
    }
  };

  const handleChangeLanguage = (lang: string) => {
    changeLanguage(lang);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('account')}</Text>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <View style={styles.languageContainer}>
            <TouchableOpacity
              style={[
                styles.languageOption,
                i18n.language === 'es' && styles.languageOptionActive,
              ]}
              onPress={() => handleChangeLanguage('es')}
            >
              <Text style={styles.languageFlag}>🇪🇸</Text>
              <Text
                style={[
                  styles.languageText,
                  i18n.language === 'es' && styles.languageTextActive,
                ]}
              >
                {t('spanish')}
              </Text>
              {i18n.language === 'es' && (
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                i18n.language === 'en' && styles.languageOptionActive,
              ]}
              onPress={() => handleChangeLanguage('en')}
            >
              <Text style={styles.languageFlag}>🇬🇧</Text>
              <Text
                style={[
                  styles.languageText,
                  i18n.language === 'en' && styles.languageTextActive,
                ]}
              >
                {t('english')}
              </Text>
              {i18n.language === 'en' && (
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                i18n.language === 'fr' && styles.languageOptionActive,
              ]}
              onPress={() => handleChangeLanguage('fr')}
            >
              <Text style={styles.languageFlag}>🇫🇷</Text>
              <Text
                style={[
                  styles.languageText,
                  i18n.language === 'fr' && styles.languageTextActive,
                ]}
              >
                {t('french')}
              </Text>
              {i18n.language === 'fr' && (
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('adminPanel')}</Text>
          <TouchableOpacity 
            style={styles.adminButton} 
            onPress={() => router.push('/admin')}
          >
            <View style={styles.adminIconContainer}>
              <Ionicons name="shield-checkmark" size={24} color="#9C27B0" />
            </View>
            <View style={styles.adminTextContainer}>
              <Text style={styles.adminButtonText}>{t('adminPanel')}</Text>
              <Text style={styles.adminSubtext}>{t('adminOnlyAccess')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#F44336" />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Delete Account Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={24} color="#fff" />
            <Text style={styles.deleteAccountText}>{t('deleteAccount')}</Text>
          </TouchableOpacity>
          <Text style={styles.deleteAccountWarning}>{t('deleteAccountWarning')}</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  languageContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageOptionActive: {
    backgroundColor: '#E8F5E9',
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  languageTextActive: {
    fontWeight: '600',
    color: '#2E7D32',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  deleteAccountButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteAccountWarning: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  adminButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adminIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  adminButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  adminSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
