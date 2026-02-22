import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

// Production URL (Railway) - ALWAYS use this for production builds
const PRODUCTION_API_URL = 'https://web-production-2e659.up.railway.app';
const isDevelopment = __DEV__;
const API_URL = isDevelopment 
  ? (process.env.EXPO_PUBLIC_BACKEND_URL || PRODUCTION_API_URL)
  : PRODUCTION_API_URL;

interface User {
  id: string;
  email: string;
  name: string;
  language: string;
  is_admin: boolean;
  is_premium: boolean;
  created_at: string | null;
  last_login: string | null;
  stats: {
    horses: number;
    riders: number;
    expenses: number;
  };
}

interface Stats {
  users: { total: number; recent: number };
  horses: number;
  riders: number;
  expenses: { count: number; total_amount: number };
  competitions: number;
  palmares: number;
  suppliers: number;
}

interface Backup {
  id: string;
  created_at: string;
  size_mb: number;
}

interface SystemMetrics {
  timestamp: string;
  database: {
    storage_size_mb: number;
    data_size_mb: number;
    index_size_mb: number;
    total_size_mb: number;
    collections_count: number;
    objects_count: number;
  };
  collections: Record<string, { count: number; size_mb: number; avg_doc_size_kb: number }>;
  storage: {
    total_documents: number;
    backups: { count: number; last_backup: string | null; last_backup_type: string | null };
  };
  limits: Record<string, { name: string; limit_mb?: number; used_mb?: number; usage_percentage?: number; status: string; description?: string; note?: string }>;
  alerts: Array<{ type: string; service: string; message: string }>;
}

export default function AdminScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, logout } = useAuth();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const checkAdmin = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin);
        if (data.is_admin) {
          fetchUsers();
          fetchStats();
        }
      }
    } catch (error) {
      console.error('Error checking admin:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchUsers = async (search?: string) => {
    if (!token) return;

    try {
      const url = search 
        ? `${API_URL}/api/admin/users?search=${encodeURIComponent(search)}`
        : `${API_URL}/api/admin/users`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchStats = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers(searchQuery);
    await fetchStats();
    setRefreshing(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    fetchUsers(query);
  };

  const handleDeleteUser = (userToDelete: User) => {
    if (Platform.OS === 'web') {
      // Use browser confirm on web
      const confirmed = window.confirm(
        `${t('deleteUserConfirm', { name: userToDelete.name, email: userToDelete.email })}`
      );
      if (confirmed) {
        deleteUserAction(userToDelete);
      }
    } else {
      Alert.alert(
        t('deleteUser'),
        t('deleteUserConfirm', { name: userToDelete.name, email: userToDelete.email }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => deleteUserAction(userToDelete),
          },
        ]
      );
    }
  };

  const deleteUserAction = async (userToDelete: User) => {
    try {
      console.log('Deleting user:', userToDelete.id);
      const response = await fetch(`${API_URL}/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Delete response status:', response.status);
      
      if (response.ok) {
        if (Platform.OS === 'web') {
          window.alert(t('userDeleted'));
        } else {
          Alert.alert(t('success'), t('userDeleted'));
        }
        fetchUsers(searchQuery);
        fetchStats();
        setShowUserModal(false);
      } else {
        const error = await response.json();
        console.log('Delete error:', error);
        if (Platform.OS === 'web') {
          window.alert(error.detail || t('errorDeletingUser'));
        } else {
          Alert.alert(t('error'), error.detail || t('errorDeletingUser'));
        }
      }
    } catch (error) {
      console.error('Delete user error:', error);
      if (Platform.OS === 'web') {
        window.alert(t('errorDeletingUser'));
      } else {
        Alert.alert(t('error'), t('errorDeletingUser'));
      }
    }
  };

  const handleToggleAdmin = async (userToToggle: User) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userToToggle.id}/toggle-admin`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        Alert.alert(t('success'), data.message);
        fetchUsers(searchQuery);
        setShowUserModal(false);
      } else {
        const error = await response.json();
        Alert.alert(t('error'), error.detail);
      }
    } catch (error) {
      Alert.alert(t('error'), t('errorUpdatingUser'));
    }
  };

  const handleTogglePremium = async (userToToggle: User) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userToToggle.id}/toggle-premium`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        Alert.alert(t('success'), data.message);
        fetchUsers(searchQuery);
        setShowUserModal(false);
      } else {
        const error = await response.json();
        Alert.alert(t('error'), error.detail);
      }
    } catch (error) {
      Alert.alert(t('error'), t('errorUpdatingUser'));
    }
  };

  // System Metrics functions
  const fetchSystemMetrics = async () => {
    if (!token) return;
    setMetricsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/system-metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSystemMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setMetricsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return '#F44336';
      case 'warning': return '#FF9800';
      case 'ok': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const getUsageBarColor = (percentage: number) => {
    if (percentage > 90) return '#F44336';
    if (percentage > 70) return '#FF9800';
    if (percentage > 50) return '#FFC107';
    return '#4CAF50';
  };

  const [sendingEmail, setSendingEmail] = useState(false);

  const sendTestEmail = async () => {
    if (!token) return;
    setSendingEmail(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/send-test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        if (Platform.OS === 'web') {
          window.alert('📧 Email enviado correctamente a multyspy@gmail.com');
        } else {
          Alert.alert('Éxito', '📧 Email enviado correctamente');
        }
      } else {
        const error = await response.json();
        if (Platform.OS === 'web') {
          window.alert('Error al enviar email: ' + (error.detail || 'Error desconocido'));
        } else {
          Alert.alert('Error', error.detail || 'Error al enviar email');
        }
      }
    } catch (error) {
      console.error('Error sending email:', error);
      if (Platform.OS === 'web') {
        window.alert('Error de conexión al enviar email');
      } else {
        Alert.alert('Error', 'Error de conexión');
      }
    } finally {
      setSendingEmail(false);
    }
  };

  // Backup functions
  const fetchBackups = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/backups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
    }
  };

  const createBackup = async () => {
    if (!token) return;
    setBackupLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Platform.OS === 'web') {
          window.alert(`Backup creado exitosamente (${data.size_mb} MB)`);
        } else {
          Alert.alert(t('success'), `Backup creado exitosamente (${data.size_mb} MB)`);
        }
        fetchBackups();
      } else {
        const error = await response.json();
        if (Platform.OS === 'web') {
          window.alert(error.detail || 'Error creando backup');
        } else {
          Alert.alert(t('error'), error.detail || 'Error creando backup');
        }
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Error creando backup');
      } else {
        Alert.alert(t('error'), 'Error creando backup');
      }
    } finally {
      setBackupLoading(false);
    }
  };

  const restoreBackup = async (backupId: string, backupDate: string) => {
    const confirmRestore = () => {
      setRestoring(true);
      performRestore(backupId);
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`¿Estás seguro de restaurar el backup del ${new Date(backupDate).toLocaleString()}?\n\nEsto sobrescribirá TODOS los datos actuales.`);
      if (confirmed) confirmRestore();
    } else {
      Alert.alert(
        'Restaurar Backup',
        `¿Estás seguro de restaurar el backup del ${new Date(backupDate).toLocaleString()}?\n\nEsto sobrescribirá TODOS los datos actuales.`,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: 'Restaurar', style: 'destructive', onPress: confirmRestore },
        ]
      );
    }
  };

  const performRestore = async (backupId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/restore/${backupId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        if (Platform.OS === 'web') {
          window.alert('Backup restaurado exitosamente');
        } else {
          Alert.alert(t('success'), 'Backup restaurado exitosamente');
        }
        setShowBackupModal(false);
        fetchStats();
        fetchUsers();
      } else {
        const error = await response.json();
        if (Platform.OS === 'web') {
          window.alert(error.detail || 'Error restaurando backup');
        } else {
          Alert.alert(t('error'), error.detail || 'Error restaurando backup');
        }
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Error restaurando backup');
      } else {
        Alert.alert(t('error'), 'Error restaurando backup');
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = async () => {
    const performLogout = async () => {
      await logout();
      router.replace('/login');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Estás seguro de cerrar sesión?');
      if (confirmed) performLogout();
    } else {
      Alert.alert(
        'Cerrar Sesión',
        '¿Estás seguro de cerrar sesión?',
        [
          { text: t('cancel'), style: 'cancel' },
          { text: 'Cerrar Sesión', style: 'destructive', onPress: performLogout },
        ]
      );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const renderUserItem = ({ item }: { item: User }) => {
    // Determine user tier
    const isFreeTier = !item.is_premium && !item.is_admin;
    
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => { setSelectedUser(item); setShowUserModal(true); }}
      >
        <View style={styles.userHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>
              {item.name?.charAt(0)?.toUpperCase() || item.email?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{item.name || t('noName')}</Text>
              {item.is_admin ? (
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#fff" />
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              ) : item.is_premium ? (
                <View style={[styles.adminBadge, styles.premiumBadge]}>
                  <Ionicons name="star" size={12} color="#fff" />
                  <Text style={styles.adminBadgeText}>PRO</Text>
                </View>
              ) : (
                <View style={[styles.adminBadge, styles.freeBadge]}>
                  <Text style={styles.freeBadgeText}>Gratis</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail}>{item.email}</Text>
            <Text style={styles.userDate}>{t('registered')}: {formatDate(item.created_at)}</Text>
          </View>
        </View>
        <View style={styles.userStats}>
          <View style={styles.statItem}>
            <Ionicons name="fitness" size={16} color="#2E7D32" />
            <Text style={styles.statText}>{item.stats.horses}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="body" size={16} color="#1976D2" />
            <Text style={styles.statText}>{item.stats.riders}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="wallet" size={16} color="#F57C00" />
            <Text style={styles.statText}>{item.stats.expenses}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ccc" />
          <Text style={styles.accessDeniedTitle}>{t('accessDenied')}</Text>
          <Text style={styles.accessDeniedText}>{t('adminOnlyAccess')}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('adminPanel')}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => { fetchSystemMetrics(); setShowMetricsModal(true); }}>
            <Ionicons name="speedometer" size={24} color="#9C27B0" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { fetchBackups(); setShowBackupModal(true); }}>
            <Ionicons name="cloud-download" size={24} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowStatsModal(true)}>
            <Ionicons name="stats-chart" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Stats */}
      {stats && (
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{stats.users.total}</Text>
            <Text style={styles.quickStatLabel}>{t('users')}</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{stats.horses}</Text>
            <Text style={styles.quickStatLabel}>{t('horses')}</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{stats.riders}</Text>
            <Text style={styles.quickStatLabel}>{t('riders')}</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{stats.expenses.count}</Text>
            <Text style={styles.quickStatLabel}>{t('expenses')}</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchUsers')}
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Users List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('noUsersFound')}</Text>
          </View>
        }
      />

      {/* User Detail Modal */}
      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
            {selectedUser && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('userDetails')}</Text>
                  <TouchableOpacity onPress={() => setShowUserModal(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <View style={styles.userDetailSection}>
                  <View style={styles.largeAvatar}>
                    <Text style={styles.largeAvatarText}>
                      {selectedUser.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <Text style={styles.detailName}>{selectedUser.name || t('noName')}</Text>
                  <Text style={styles.detailEmail}>{selectedUser.email}</Text>
                  <View style={styles.badgeRow}>
                    {selectedUser.is_premium && (
                      <View style={[styles.adminBadgeLarge, styles.premiumBadgeLarge]}>
                        <Ionicons name="star" size={16} color="#fff" />
                        <Text style={styles.adminBadgeTextLarge}>Premium</Text>
                      </View>
                    )}
                    {selectedUser.is_admin && (
                      <View style={styles.adminBadgeLarge}>
                        <Ionicons name="shield-checkmark" size={16} color="#fff" />
                        <Text style={styles.adminBadgeTextLarge}>Administrator</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.detailStats}>
                  <View style={styles.detailStatItem}>
                    <Ionicons name="fitness" size={24} color="#2E7D32" />
                    <Text style={styles.detailStatValue}>{selectedUser.stats.horses}</Text>
                    <Text style={styles.detailStatLabel}>{t('horses')}</Text>
                  </View>
                  <View style={styles.detailStatItem}>
                    <Ionicons name="body" size={24} color="#1976D2" />
                    <Text style={styles.detailStatValue}>{selectedUser.stats.riders}</Text>
                    <Text style={styles.detailStatLabel}>{t('riders')}</Text>
                  </View>
                  <View style={styles.detailStatItem}>
                    <Ionicons name="wallet" size={24} color="#F57C00" />
                    <Text style={styles.detailStatValue}>{selectedUser.stats.expenses}</Text>
                    <Text style={styles.detailStatLabel}>{t('expenses')}</Text>
                  </View>
                </View>

                <View style={styles.detailInfo}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('registered')}:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedUser.created_at)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('language')}:</Text>
                    <Text style={styles.detailValue}>{selectedUser.language?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('plan')}:</Text>
                    <Text style={[styles.detailValue, selectedUser.is_premium ? styles.premiumText : styles.freeText]}>
                      {selectedUser.is_premium ? 'Premium' : t('free')}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.premiumButton]}
                    onPress={() => handleTogglePremium(selectedUser)}
                  >
                    <Ionicons 
                      name={selectedUser.is_premium ? "star-outline" : "star"} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.actionButtonText}>
                      {selectedUser.is_premium ? t('removePremium') : t('makePremium')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.adminButton]}
                    onPress={() => handleToggleAdmin(selectedUser)}
                  >
                    <Ionicons 
                      name={selectedUser.is_admin ? "shield-outline" : "shield-checkmark"} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.actionButtonText}>
                      {selectedUser.is_admin ? t('removeAdmin') : t('makeAdmin')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteUser(selectedUser)}
                  >
                    <Ionicons name="trash" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>{t('deleteUser')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Stats Modal */}
      <Modal visible={showStatsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('globalStats')}</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
            {stats && (
              <View style={styles.statsGrid}>
                <View style={styles.statsCard}>
                  <Ionicons name="people" size={32} color="#2E7D32" />
                  <Text style={styles.statsCardValue}>{stats.users.total}</Text>
                  <Text style={styles.statsCardLabel}>{t('totalUsers')}</Text>
                  <Text style={styles.statsCardSub}>+{stats.users.recent} {t('last30Days')}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Ionicons name="fitness" size={32} color="#8B4513" />
                  <Text style={styles.statsCardValue}>{stats.horses}</Text>
                  <Text style={styles.statsCardLabel}>{t('totalHorses')}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Ionicons name="body" size={32} color="#1976D2" />
                  <Text style={styles.statsCardValue}>{stats.riders}</Text>
                  <Text style={styles.statsCardLabel}>{t('totalRiders')}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Ionicons name="wallet" size={32} color="#F57C00" />
                  <Text style={styles.statsCardValue}>{stats.expenses.count}</Text>
                  <Text style={styles.statsCardLabel}>{t('totalExpenses')}</Text>
                  <Text style={styles.statsCardSub}>{formatCurrency(stats.expenses.total_amount)}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Ionicons name="flag" size={32} color="#9C27B0" />
                  <Text style={styles.statsCardValue}>{stats.competitions}</Text>
                  <Text style={styles.statsCardLabel}>{t('totalCompetitions')}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Ionicons name="ribbon" size={32} color="#FFD700" />
                  <Text style={styles.statsCardValue}>{stats.palmares}</Text>
                  <Text style={styles.statsCardLabel}>{t('totalAchievements')}</Text>
                </View>
              </View>
            )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Backup Modal */}
      <Modal visible={showBackupModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Copias de Seguridad</Text>
              <TouchableOpacity onPress={() => setShowBackupModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.createBackupButton, backupLoading && { opacity: 0.7 }]}
              onPress={createBackup}
              disabled={backupLoading}
            >
              {backupLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={24} color="#fff" />
                  <Text style={styles.createBackupButtonText}>Crear Backup Ahora</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.backupSectionTitle}>Backups Disponibles (últimos 7 días)</Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {backups.length === 0 ? (
                <View style={styles.emptyBackups}>
                  <Ionicons name="cloud-offline" size={48} color="#ccc" />
                  <Text style={styles.emptyBackupsText}>No hay backups disponibles</Text>
                  <Text style={[styles.emptyBackupsText, { fontSize: 12, marginTop: 8 }]}>
                    Pulsa "Crear Backup Ahora" para crear tu primera copia de seguridad
                  </Text>
                </View>
              ) : (
                backups.map((backup: any) => (
                  <View key={backup.id} style={styles.backupItem}>
                    <View style={styles.backupInfo}>
                      <Ionicons 
                        name={backup.type === 'automatic' ? 'time' : 'document'} 
                        size={24} 
                        color={backup.type === 'automatic' ? '#4CAF50' : '#2196F3'} 
                      />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.backupDate}>
                          {new Date(backup.created_at).toLocaleString('es-ES')}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.backupSize}>{backup.size_mb} MB</Text>
                          <Text style={[styles.backupSize, { 
                            color: backup.type === 'automatic' ? '#4CAF50' : '#2196F3',
                            fontWeight: '500'
                          }]}>
                            {backup.type === 'automatic' ? '⏰ Auto' : '✋ Manual'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.restoreButton}
                      onPress={() => restoreBackup(backup.id, backup.created_at)}
                      disabled={restoring}
                    >
                      {restoring ? (
                        <ActivityIndicator size="small" color="#F44336" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={18} color="#F44336" />
                          <Text style={styles.restoreButtonText}>Restaurar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <Text style={[styles.backupSectionTitle, { fontSize: 12, color: '#666', marginTop: 16 }]}>
              ⏰ Backup automático diario a las 3:00 AM
            </Text>
          </View>
        </View>
      </Modal>

      {/* System Metrics Modal */}
      <Modal visible={showMetricsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Monitor del Sistema</Text>
              <TouchableOpacity onPress={() => setShowMetricsModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {metricsLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#9C27B0" />
                <Text style={{ marginTop: 12, color: '#666' }}>Cargando métricas...</Text>
              </View>
            ) : systemMetrics ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Alerts Section */}
                {systemMetrics.alerts.length > 0 && (
                  <View style={styles.alertsSection}>
                    {systemMetrics.alerts.map((alert, index) => (
                      <View key={index} style={[styles.alertItem, { 
                        backgroundColor: alert.type === 'critical' ? '#FFEBEE' : '#FFF3E0',
                        borderLeftColor: alert.type === 'critical' ? '#F44336' : '#FF9800'
                      }]}>
                        <Ionicons 
                          name={alert.type === 'critical' ? 'warning' : 'alert-circle'} 
                          size={20} 
                          color={alert.type === 'critical' ? '#F44336' : '#FF9800'} 
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.alertService}>{alert.service}</Text>
                          <Text style={styles.alertMessage}>{alert.message}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* MongoDB Atlas Usage */}
                <View style={styles.metricsCard}>
                  <View style={styles.metricsCardHeader}>
                    <Ionicons name="server" size={24} color="#4CAF50" />
                    <Text style={styles.metricsCardTitle}>MongoDB Atlas</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(systemMetrics.limits.mongodb_atlas?.status || 'ok') }]}>
                      <Text style={styles.statusBadgeText}>
                        {systemMetrics.limits.mongodb_atlas?.status?.toUpperCase() || 'OK'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.usageBar}>
                    <View style={[styles.usageBarFill, { 
                      width: `${Math.min(systemMetrics.limits.mongodb_atlas?.usage_percentage || 0, 100)}%`,
                      backgroundColor: getUsageBarColor(systemMetrics.limits.mongodb_atlas?.usage_percentage || 0)
                    }]} />
                  </View>
                  
                  <View style={styles.usageStats}>
                    <Text style={styles.usageText}>
                      {systemMetrics.limits.mongodb_atlas?.used_mb || 0} MB / {systemMetrics.limits.mongodb_atlas?.limit_mb || 512} MB
                    </Text>
                    <Text style={[styles.usagePercentage, { 
                      color: getUsageBarColor(systemMetrics.limits.mongodb_atlas?.usage_percentage || 0) 
                    }]}>
                      {systemMetrics.limits.mongodb_atlas?.usage_percentage || 0}%
                    </Text>
                  </View>
                </View>

                {/* Database Details */}
                <View style={styles.metricsCard}>
                  <Text style={styles.metricsCardTitle}>📁 Detalles de la Base de Datos</Text>
                  <View style={styles.metricsRow}>
                    <Text style={styles.metricsLabel}>Tamaño de datos:</Text>
                    <Text style={styles.metricsValue}>{systemMetrics.database.data_size_mb} MB</Text>
                  </View>
                  <View style={styles.metricsRow}>
                    <Text style={styles.metricsLabel}>Tamaño de índices:</Text>
                    <Text style={styles.metricsValue}>{systemMetrics.database.index_size_mb} MB</Text>
                  </View>
                  <View style={styles.metricsRow}>
                    <Text style={styles.metricsLabel}>Total documentos:</Text>
                    <Text style={styles.metricsValue}>{systemMetrics.storage.total_documents}</Text>
                  </View>
                  <View style={styles.metricsRow}>
                    <Text style={styles.metricsLabel}>Colecciones:</Text>
                    <Text style={styles.metricsValue}>{systemMetrics.database.collections_count}</Text>
                  </View>
                </View>

                {/* Collections Breakdown */}
                <View style={styles.metricsCard}>
                  <Text style={styles.metricsCardTitle}>📊 Uso por Colección</Text>
                  {Object.entries(systemMetrics.collections)
                    .filter(([name]) => !['backups', 'backup_parts', 'metrics_history'].includes(name))
                    .sort((a, b) => (b[1].size_mb || 0) - (a[1].size_mb || 0))
                    .map(([name, data]) => (
                      <View key={name} style={styles.collectionRow}>
                        <View style={styles.collectionInfo}>
                          <Text style={styles.collectionName}>{name}</Text>
                          <Text style={styles.collectionCount}>{data.count} docs</Text>
                        </View>
                        <Text style={styles.collectionSize}>{data.size_mb} MB</Text>
                      </View>
                    ))}
                </View>

                {/* Other Services */}
                <View style={styles.metricsCard}>
                  <Text style={styles.metricsCardTitle}>🔧 Otros Servicios</Text>
                  
                  <View style={styles.serviceRow}>
                    <Ionicons name="train" size={20} color="#7C4DFF" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.serviceName}>Railway (Backend)</Text>
                      <Text style={styles.serviceNote}>{systemMetrics.limits.railway?.note}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                      <Text style={styles.statusBadgeText}>OK</Text>
                    </View>
                  </View>

                  <View style={styles.serviceRow}>
                    <Ionicons name="phone-portrait" size={20} color="#00BCD4" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.serviceName}>Expo EAS (Builds)</Text>
                      <Text style={styles.serviceNote}>{systemMetrics.limits.expo_eas?.note}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                      <Text style={styles.statusBadgeText}>OK</Text>
                    </View>
                  </View>
                </View>

                {/* Last Backup Info */}
                <View style={styles.metricsCard}>
                  <Text style={styles.metricsCardTitle}>💾 Último Backup</Text>
                  {systemMetrics.storage.backups.last_backup ? (
                    <>
                      <View style={styles.metricsRow}>
                        <Text style={styles.metricsLabel}>Fecha:</Text>
                        <Text style={styles.metricsValue}>
                          {new Date(systemMetrics.storage.backups.last_backup).toLocaleString('es-ES')}
                        </Text>
                      </View>
                      <View style={styles.metricsRow}>
                        <Text style={styles.metricsLabel}>Tipo:</Text>
                        <Text style={styles.metricsValue}>
                          {systemMetrics.storage.backups.last_backup_type === 'automatic' ? '⏰ Automático' : '✋ Manual'}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={{ color: '#999', fontStyle: 'italic' }}>No hay backups aún</Text>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.refreshMetricsButton}
                  onPress={fetchSystemMetrics}
                >
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.refreshMetricsButtonText}>Actualizar Métricas</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.refreshMetricsButton, { backgroundColor: '#FF5722', marginTop: 8 }]}
                  onPress={sendTestEmail}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="mail" size={20} color="#fff" />
                      <Text style={styles.refreshMetricsButtonText}>Enviar Informe por Email</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={{ textAlign: 'center', color: '#999', fontSize: 11, marginTop: 12, marginBottom: 16 }}>
                  📧 Email diario automático a las 8:00 AM{'\n'}
                  Última actualización: {new Date(systemMetrics.timestamp).toLocaleString('es-ES')}
                </Text>
              </ScrollView>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="alert-circle" size={48} color="#ccc" />
                <Text style={{ marginTop: 12, color: '#666' }}>Error al cargar métricas</Text>
              </View>
            )}
          </View>
        </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  premiumBadge: {
    backgroundColor: '#FFB300',
  },
  freeBadge: {
    backgroundColor: '#9E9E9E',
  },
  freeBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  adminBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  userStats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userDetailSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  detailName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  detailEmail: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  adminBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    marginRight: 8,
  },
  premiumBadgeLarge: {
    backgroundColor: '#FFB300',
  },
  adminBadgeTextLarge: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  premiumText: {
    color: '#FFB300',
    fontWeight: 'bold',
  },
  freeText: {
    color: '#999',
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  detailStatItem: {
    alignItems: 'center',
  },
  detailStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  detailStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailInfo: {
    paddingVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalActions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  adminButton: {
    backgroundColor: '#9C27B0',
  },
  premiumButton: {
    backgroundColor: '#FFB300',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statsCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statsCardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statsCardLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statsCardSub: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  createBackupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  createBackupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backupSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyBackups: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyBackupsText: {
    color: '#999',
    marginTop: 12,
  },
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  backupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backupDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  backupSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    gap: 4,
  },
  restoreButtonText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
  },
  // Metrics Modal Styles
  alertsSection: {
    marginBottom: 16,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  alertService: {
    fontWeight: '600',
    color: '#333',
    fontSize: 14,
  },
  alertMessage: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  metricsCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  metricsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  usageBar: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageText: {
    fontSize: 14,
    color: '#666',
  },
  usagePercentage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  metricsLabel: {
    color: '#666',
    fontSize: 14,
  },
  metricsValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textTransform: 'capitalize',
  },
  collectionCount: {
    fontSize: 12,
    color: '#999',
  },
  collectionSize: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  serviceNote: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  refreshMetricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  refreshMetricsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
