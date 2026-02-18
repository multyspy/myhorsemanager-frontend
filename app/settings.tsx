import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { api } from '../src/utils/api';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version || '1.2.3';

export default function SettingsScreen() {
  const { user, logout, changeLanguage } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  
  // Feedback modal state
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);

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

  const handleSendFeedback = () => {
    setFeedbackModalVisible(true);
  };

  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert(t('error'), t('feedbackRequired'));
      return;
    }

    setSendingFeedback(true);
    try {
      const response = await api.post('/api/feedback', {
        message: feedbackMessage,
        app_version: APP_VERSION,
        platform: Platform.OS,
      });

      if (response.ok) {
        Alert.alert(t('success'), t('feedbackSent'));
        setFeedbackMessage('');
        setFeedbackModalVisible(false);
      } else {
        // Si el endpoint no existe, abrir email como fallback
        const subject = encodeURIComponent(`My Horse Manager v${APP_VERSION} - Feedback`);
        const body = encodeURIComponent(`${feedbackMessage}\n\n---\nApp: My Horse Manager\nVersion: ${APP_VERSION}\nUser: ${user?.email || 'N/A'}\nPlatform: ${Platform.OS}\n`);
        const email = 'multyspy@gmail.com';
        const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
        
        Linking.openURL(mailtoUrl).catch(() => {
          Alert.alert(t('error'), t('cannotOpenEmail'));
        });
        setFeedbackModalVisible(false);
      }
    } catch (error) {
      // Fallback to email
      const subject = encodeURIComponent(`My Horse Manager v${APP_VERSION} - Feedback`);
      const body = encodeURIComponent(`${feedbackMessage}\n\n---\nApp: My Horse Manager\nVersion: ${APP_VERSION}\nUser: ${user?.email || 'N/A'}\nPlatform: ${Platform.OS}\n`);
      const email = 'jr.ascaso@eximbo.com';
      const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
      
      Linking.openURL(mailtoUrl).catch(() => {
        Alert.alert(t('error'), t('cannotOpenEmail'));
      });
      setFeedbackModalVisible(false);
    } finally {
      setSendingFeedback(false);
    }
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

        {/* Feedback Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('feedback')}</Text>
          <TouchableOpacity 
            style={styles.feedbackButton} 
            onPress={handleSendFeedback}
          >
            <View style={styles.feedbackIconContainer}>
              <Ionicons name="mail-outline" size={24} color="#2196F3" />
            </View>
            <View style={styles.feedbackTextContainer}>
              <Text style={styles.feedbackButtonText}>{t('sendFeedback')}</Text>
              <Text style={styles.feedbackSubtext}>{t('sendFeedbackDescription')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Subscription Section - Tu Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('subscription')}</Text>
          <TouchableOpacity 
            style={styles.premiumButton} 
            onPress={() => router.push('/myplan')}
          >
            <View style={styles.premiumIconContainer}>
              <Ionicons name="star" size={24} color="#FFD700" />
            </View>
            <View style={styles.premiumTextContainer}>
              <Text style={styles.premiumButtonText}>{t('myPlan')}</Text>
              <Text style={styles.premiumSubtext}>{t('viewYourPlan')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
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

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>My Horse Manager v{APP_VERSION}</Text>
        </View>
      </ScrollView>

      {/* Feedback Modal */}
      <Modal
        visible={feedbackModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
              <Text style={styles.modalCancel}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('sendFeedback')}</Text>
            <TouchableOpacity onPress={submitFeedback} disabled={sendingFeedback}>
              <Text style={[styles.modalSend, sendingFeedback && styles.modalSendDisabled]}>
                {sendingFeedback ? t('sending') : t('send')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.feedbackLabel}>{t('feedbackLabel')}</Text>
            <TextInput
              style={styles.feedbackInput}
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              placeholder={t('feedbackPlaceholder')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />

            <View style={styles.feedbackInfoContainer}>
              <Ionicons name="information-circle-outline" size={20} color="#666" />
              <Text style={styles.feedbackInfoText}>
                {t('feedbackInfo')}
              </Text>
            </View>

            <View style={styles.appInfoContainer}>
              <Text style={styles.appInfoLabel}>{t('appInfo')}:</Text>
              <Text style={styles.appInfoValue}>My Horse Manager v{APP_VERSION}</Text>
              <Text style={styles.appInfoValue}>{user?.email}</Text>
              <Text style={styles.appInfoValue}>{Platform.OS}</Text>
            </View>
          </ScrollView>

          {sendingFeedback && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2E7D32" />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
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
  premiumButton: {
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
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  premiumIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  premiumButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  premiumSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
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
  feedbackButton: {
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
  feedbackIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  feedbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  feedbackSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
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
  // Feedback Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCancel: {
    fontSize: 16,
    color: '#666',
  },
  modalSend: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  modalSendDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  feedbackInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlignVertical: 'top',
  },
  feedbackInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  feedbackInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
  appInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  appInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  appInfoValue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
});
