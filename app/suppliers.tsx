import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';


interface Supplier {
  id: string;
  name: string;
  category?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  contact_person?: string;
  created_at: string;
  updated_at: string;
}

interface SupplierReport {
  supplier: Supplier;
  total: number;
  count: number;
}

const SUPPLIER_CATEGORIES = [
  'herrador',
  'veterinario',
  'alimentacion',
  'equipamiento',
  'transporte',
  'seguros',
  'otros'
];

export default function SuppliersScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  
  // Function to get translated category names
  const getCategoryName = (category: string): string => {
    const categoryKeys: Record<string, string> = {
      herrador: 'supplierCategories.farrier',
      veterinario: 'supplierCategories.veterinary',
      alimentacion: 'supplierCategories.feed',
      equipamiento: 'supplierCategories.equipment',
      transporte: 'supplierCategories.transport',
      seguros: 'supplierCategories.insurance',
      otros: 'supplierCategories.other'
    };
    return t(categoryKeys[category] || category);
  };

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierReport, setSelectedSupplierReport] = useState<any>(null);
  const [suppliersReport, setSuppliersReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'report'>('list');
  
  // Filter for report
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  
  // Date picker states
  const [selectedStartDate, setSelectedStartDate] = useState(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // Date picker handlers
  const onStartDateChange = (event: any, date?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedStartDate(date);
      setReportStartDate(date.toISOString().split('T')[0]);
    }
  };

  const onEndDateChange = (event: any, date?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedEndDate(date);
      setReportEndDate(date.toISOString().split('T')[0]);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Seleccionar';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/api/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSuppliersReport = async () => {
    try {
      let url = '/api/reports/suppliers';
      const params = new URLSearchParams();
      if (reportStartDate) params.append('start_date', reportStartDate);
      if (reportEndDate) params.append('end_date', reportEndDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await api.get(url);
      if (response.ok) {
        const data = await response.json();
        setSuppliersReport(data);
      }
    } catch (error) {
      console.error('Error fetching suppliers report:', error);
    }
  };

  useEffect(() => {
    if (!authLoading && token) {
      fetchSuppliers();
    } else if (!authLoading && !token) {
      setLoading(false);
    }
  }, [authLoading, token]);

  useEffect(() => {
    if (activeTab === 'report') {
      fetchSuppliersReport();
    }
  }, [activeTab, reportStartDate, reportEndDate]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSuppliers();
    if (activeTab === 'report') {
      fetchSuppliersReport();
    }
  }, [activeTab]);

  const resetForm = () => {
    setName('');
    setCategory('');
    setCustomCategory('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setContactPerson('');
    setNotes('');
    setEditingSupplier(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setCategory(supplier.category || '');
    setCustomCategory((supplier as any).custom_category || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
    setAddress(supplier.address || '');
    setCity(supplier.city || '');
    setContactPerson(supplier.contact_person || '');
    setNotes(supplier.notes || '');
    setModalVisible(true);
  };

  const viewSupplierReport = async (supplier: Supplier) => {
    try {
      let url = `/api/suppliers/${supplier.id}/report`;
      const params = new URLSearchParams();
      if (reportStartDate) params.append('start_date', reportStartDate);
      if (reportEndDate) params.append('end_date', reportEndDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await api.get(url);
      if (response.ok) {
        const data = await response.json();
        setSelectedSupplierReport(data);
        setReportModalVisible(true);
      }
    } catch (error) {
      console.error('Error fetching supplier report:', error);
    }
  };

  const saveSupplier = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const supplierData = {
        name: name.trim(),
        category: category || null,
        custom_category: category === 'otros' ? customCategory.trim() : null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        contact_person: contactPerson.trim() || null,
        notes: notes.trim() || null,
      };

      let response;
      if (editingSupplier) {
        response = await api.put(`/api/suppliers/${editingSupplier.id}`, supplierData);
      } else {
        response = await api.post('/api/suppliers', supplierData);
      }

      if (response.ok) {
        setModalVisible(false);
        resetForm();
        fetchSuppliers();
      } else {
        Alert.alert(t('error'), t('connectionError'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = (supplier: Supplier) => {
    if (Platform.OS === 'web') {
      try {
        const confirmed = window.confirm(`${t('confirmDeleteSupplier')}`);
        if (confirmed) {
          performDeleteSupplier(supplier.id);
        }
      } catch (e) {
        performDeleteSupplier(supplier.id);
      }
    } else {
      Alert.alert(
        t('deleteSupplier'),
        t('confirmDeleteSupplier'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => performDeleteSupplier(supplier.id),
          },
        ]
      );
    }
  };

  const performDeleteSupplier = async (supplierId: string) => {
    try {
      const response = await api.delete(`/api/suppliers/${supplierId}`);
      if (response.ok) {
        fetchSuppliers();
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const renderSupplierItem = ({ item }: { item: Supplier }) => (
    <View style={styles.supplierCard}>
      <TouchableOpacity
        style={styles.supplierCardContent}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.supplierIcon}>
          <Ionicons name="business" size={24} color="#2E7D32" />
        </View>
        <View style={styles.supplierInfo}>
          <Text style={styles.supplierName}>{item.name}</Text>
          {item.category && (
            <Text style={styles.supplierCategory}>{getCategoryName(item.category)}</Text>
          )}
          {item.city && <Text style={styles.supplierDetail}>{item.city}</Text>}
          {item.phone && <Text style={styles.supplierDetail}>{item.phone}</Text>}
        </View>
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => viewSupplierReport(item)}
        >
          <Ionicons name="stats-chart" size={20} color="#2196F3" />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteSupplier(item)}
      >
        <Ionicons name="trash-outline" size={22} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  const renderReportItem = ({ item }: { item: SupplierReport }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportName}>{item.supplier.name}</Text>
        <Text style={styles.reportTotal}>{formatAmount(item.total)}</Text>
      </View>
      <Text style={styles.reportCount}>{item.count} {t('transactions')}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.tabActive]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
            {t('list')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'report' && styles.tabActive]}
          onPress={() => setActiveTab('report')}
        >
          <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
            {t('report')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'list' ? (
        <>
          <FlatList
            data={suppliers}
            renderItem={renderSupplierItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>{t('noSuppliers')}</Text>
                <Text style={styles.emptySubtext}>{t('addFirstSupplier')}</Text>
              </View>
            }
          />
          <TouchableOpacity style={styles.fab} onPress={openAddModal}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView
          contentContainerStyle={styles.reportContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
          }
        >
          {/* Date Filters */}
          <View style={styles.filterContainer}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.filterLabel}>Desde</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e: any) => setReportStartDate(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 10,
                    fontSize: 14,
                    borderRadius: 8,
                    border: '1px solid #e0e0e0',
                    backgroundColor: '#fff',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.dateButton} 
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color="#666" />
                    <Text style={styles.dateButtonText}>{formatDisplayDate(reportStartDate)}</Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={selectedStartDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onStartDateChange}
                    />
                  )}
                </>
              )}
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={styles.filterLabel}>Hasta</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e: any) => setReportEndDate(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 10,
                    fontSize: 14,
                    borderRadius: 8,
                    border: '1px solid #e0e0e0',
                    backgroundColor: '#fff',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.dateButton} 
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color="#666" />
                    <Text style={styles.dateButtonText}>{formatDisplayDate(reportEndDate)}</Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={selectedEndDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onEndDateChange}
                    />
                  )}
                </>
              )}
            </View>
          </View>

          {suppliersReport && (
            <>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>{t('totalSuppliers')}</Text>
                <Text style={styles.totalAmount}>{formatAmount(suppliersReport.grand_total || 0)}</Text>
                <Text style={styles.totalCount}>{suppliersReport.total_count || 0} {t('transactions')}</Text>
              </View>

              <Text style={styles.sectionTitle}>{t('bySupplier')}</Text>
              {suppliersReport.suppliers?.map((item: SupplierReport) => (
                <View key={item.supplier.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportName}>{item.supplier.name}</Text>
                    <Text style={styles.reportTotal}>{formatAmount(item.total)}</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${suppliersReport.grand_total > 0 ? (item.total / suppliersReport.grand_total) * 100 : 0}%`,
                          backgroundColor: '#2E7D32'
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.reportCount}>{item.count} {t('transactions')}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingSupplier ? t('editSupplier') : t('newSupplier')}
            </Text>
            <TouchableOpacity onPress={saveSupplier} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? t('saving') : t('save')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <Text style={styles.label}>{t('name')} *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('supplierName')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('category')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowCategorySelector(true)}
            >
              <Text style={category ? styles.selectorText : styles.selectorPlaceholder}>
                {category ? getCategoryName(category) : t('selectCategory')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            {category === 'otros' && (
              <>
                <Text style={styles.label}>Especificar Categoría</Text>
                <TextInput
                  style={styles.input}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  placeholder="Escribir categoría personalizada"
                  placeholderTextColor="#999"
                />
              </>
            )}

            <Text style={styles.label}>{t('contactPerson')}</Text>
            <TextInput
              style={styles.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder={t('contactName')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+34 600 000 000"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@supplier.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('address')}</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder={t('fullAddress')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('city')}</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder={t('city')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('notes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('notesPlaceholder')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Category Selector */}
        <Modal
          visible={showCategorySelector}
          animationType="fade"
          transparent
          onRequestClose={() => setShowCategorySelector(false)}
        >
          <TouchableOpacity
            style={styles.selectorOverlay}
            activeOpacity={1}
            onPress={() => setShowCategorySelector(false)}
          >
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>{t('selectCategory')}</Text>
              <FlatList
                data={SUPPLIER_CATEGORIES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, category === item && styles.selectorItemSelected]}
                    onPress={() => {
                      setCategory(item);
                      setShowCategorySelector(false);
                    }}
                  >
                    <Text style={styles.selectorItemText}>{getCategoryName(item)}</Text>
                    {category === item && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Supplier Report Modal */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReportModalVisible(false)}>
              <Text style={styles.modalCancel}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Informe de Proveedor</Text>
            <View style={{ width: 60 }} />
          </View>

          {selectedSupplierReport && (
            <ScrollView style={styles.formContainer}>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>{selectedSupplierReport.supplier?.name}</Text>
                <Text style={styles.totalAmount}>{formatAmount(selectedSupplierReport.total || 0)}</Text>
                <Text style={styles.totalCount}>{selectedSupplierReport.total_count || 0} transacciones</Text>
              </View>

              <View style={styles.splitRow}>
                <View style={styles.splitCard}>
                  <Text style={styles.splitLabel}>Caballos</Text>
                  <Text style={styles.splitAmount}>{formatAmount(selectedSupplierReport.horse_total || 0)}</Text>
                  <Text style={styles.splitCount}>{selectedSupplierReport.horse_count || 0} gastos</Text>
                </View>
                <View style={styles.splitCard}>
                  <Text style={styles.splitLabel}>Jinetes</Text>
                  <Text style={styles.splitAmount}>{formatAmount(selectedSupplierReport.rider_total || 0)}</Text>
                  <Text style={styles.splitCount}>{selectedSupplierReport.rider_count || 0} gastos</Text>
                </View>
              </View>

              {selectedSupplierReport.horse_expenses?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Últimos Gastos (Caballos)</Text>
                  {selectedSupplierReport.horse_expenses.slice(0, 10).map((exp: any) => (
                    <View key={exp.id} style={styles.expenseItem}>
                      <View>
                        <Text style={styles.expenseDate}>{exp.date}</Text>
                        <Text style={styles.expenseDesc}>{exp.description || 'Sin descripción'}</Text>
                      </View>
                      <Text style={styles.expenseAmount}>{formatAmount(exp.amount)}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  reportContainer: {
    padding: 16,
  },
  supplierCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  supplierCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deleteButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
  },
  supplierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  supplierCategory: {
    fontSize: 14,
    color: '#2E7D32',
    marginTop: 2,
  },
  supplierDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reportButton: {
    padding: 8,
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  totalCard: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  reportTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reportCount: {
    fontSize: 12,
    color: '#666',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  splitCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  splitLabel: {
    fontSize: 12,
    color: '#666',
  },
  splitAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  splitCount: {
    fontSize: 12,
    color: '#999',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  expenseDate: {
    fontSize: 12,
    color: '#666',
  },
  expenseDesc: {
    fontSize: 14,
    color: '#333',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
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
  modalSave: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selector: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
    padding: 16,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectorItemSelected: {
    backgroundColor: '#f0f8f0',
  },
  selectorItemText: {
    fontSize: 16,
    color: '#333',
  },
  bottomSpacer: {
    height: 40,
  },
});
