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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  id: string;
  email: string;
  name: string;
  language: string;
  is_admin: boolean;
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

export default function AdminScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useAuth();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

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

  const renderUserItem = ({ item }: { item: User }) => (
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
            {item.is_admin && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.adminBadgeText}>Admin</Text>
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
        <TouchableOpacity onPress={() => setShowStatsModal(true)}>
          <Ionicons name="stats-chart" size={24} color="#2E7D32" />
        </TouchableOpacity>
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
                  {selectedUser.is_admin && (
                    <View style={styles.adminBadgeLarge}>
                      <Ionicons name="shield-checkmark" size={16} color="#fff" />
                      <Text style={styles.adminBadgeTextLarge}>Administrator</Text>
                    </View>
                  )}
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
                </View>

                <View style={styles.modalActions}>
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
    marginTop: 12,
  },
  adminBadgeTextLarge: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
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
});
