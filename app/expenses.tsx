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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../src/context/SubscriptionContext';
import { canAddMore, shouldShowLimitPopup, FREE_LIMITS } from '../src/utils/subscriptionLimits';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';


interface Horse {
  id: string;
  name: string;
}

interface Rider {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  category?: string;
}

interface Expense {
  id: string;
  horse_id?: string;
  rider_id?: string;
  category: string;
  custom_category?: string;
  amount: number;
  date: string;
  description?: string;
  provider?: string;
  supplier_id?: string;
  invoice_photo?: string;
  invoice_photos?: string[];
  created_at: string;
  updated_at: string;
}

interface CategoryInfo {
  horse_categories: string[];
  horse_names: Record<string, string>;
  rider_categories: string[];
  rider_names: Record<string, string>;
}

const HORSE_CATEGORY_ICONS: Record<string, string> = {
  pupilaje: 'business',           // Centro ecuestre / instalación
  herrador: 'construct',          // Servicio de herraje
  veterinario: 'medkit',          // Atención médica
  dentista: 'happy',              // Odontología equina (sonrisa/dientes)
  vacunas: 'fitness',             // Vacunación preventiva
  desparasitacion: 'shield-checkmark', // Protección antiparasitaria
  fisioterapia: 'accessibility',  // Recuperación y movilidad
  proveedores: 'cube',            // Suministros y compras
  otros_propietarios: 'people',   // Copropietarios
  alimentacion: 'leaf',           // Pienso y nutrición
  equipo: 'ribbon',               // Material ecuestre
  transporte: 'bus',              // Traslado y viajes
  otros: 'ellipsis-horizontal',
};

const RIDER_CATEGORY_ICONS: Record<string, string> = {
  equipamiento: 'shirt',
  formacion: 'school',
  competiciones: 'trophy',
  licencias: 'document-text',
  seguros: 'shield-checkmark',
  transporte: 'bus',
  alimentacion: 'leaf',
  fisioterapia: 'accessibility',
  otros: 'ellipsis-horizontal',
};

const HORSE_CATEGORY_COLORS: Record<string, string> = {
  pupilaje: '#2E7D32',            // Verde oscuro - Centro ecuestre
  herrador: '#F57C00',            // Naranja - Herraje
  veterinario: '#C62828',         // Rojo oscuro - Atención médica
  dentista: '#E91E63',            // Rosa - Odontología
  vacunas: '#8E24AA',             // Púrpura - Vacunación
  desparasitacion: '#5E35B1',     // Violeta - Antiparasitario
  fisioterapia: '#00ACC1',        // Cyan - Recuperación
  proveedores: '#1565C0',         // Azul - Suministros
  otros_propietarios: '#3949AB',  // Índigo - Copropietarios
  alimentacion: '#6D4C41',        // Marrón - Nutrición
  equipo: '#546E7A',              // Gris azulado - Material
  transporte: '#00796B',          // Teal - Traslado
  otros: '#757575',               // Gris
};

const RIDER_CATEGORY_COLORS: Record<string, string> = {
  equipamiento: '#E91E63',        // Rosa
  formacion: '#3F51B5',           // Índigo
  competiciones: '#FFC107',       // Amarillo
  licencias: '#00796B',           // Teal
  seguros: '#5E35B1',             // Violeta
  transporte: '#00ACC1',          // Cyan
  alimentacion: '#6D4C41',        // Marrón
  fisioterapia: '#8BC34A',        // Verde claro
  otros: '#757575',               // Gris
};

export default function ExpensesScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { isProUser, subscriptionStatus } = useSubscription();
  const router = useRouter();
  
  // Function to get translated category name
  const getCategoryName = (category: string): string => {
    const categoryKeys: Record<string, string> = {
      // Horse categories
      pupilaje: 'categories.boarding',
      herrador: 'categories.farrier',
      veterinario: 'categories.veterinary',
      proveedores: 'categories.suppliers',
      otros_propietarios: 'categories.otherOwners',
      alimentacion: 'categories.feed',
      equipo: 'categories.equipment',
      transporte: 'categories.transport',
      otros: 'categories.other',
      // Rider categories
      equipamiento: 'categories.equipment',
      formacion: 'categories.training',
      competiciones: 'categories.competitions',
      licencias: 'categories.licenses',
      seguros: 'categories.insurance',
      fisioterapia: 'categories.physiotherapy',
      dentista: 'categories.dentista',
      vacunas: 'categories.vacunas',
      desparasitacion: 'categories.desparasitacion',
    };
    return t(categoryKeys[category] || category);
  };

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Check if user can add more expenses
  const canAddExpense = canAddMore(subscriptionStatus, 'expenses', expenses.length);
  
  // Tab state (horse or rider)
  const [expenseType, setExpenseType] = useState<'horse' | 'rider'>('horse');
  
  // Form state
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [invoicePhoto, setInvoicePhoto] = useState<string | null>(null);
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showEntitySelector, setShowEntitySelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showSupplierSelector, setShowSupplierSelector] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [createReminder, setCreateReminder] = useState(true);
  
  // Photo viewer state
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingPhotoTitle, setViewingPhotoTitle] = useState<string>('');

  const fetchData = async () => {
    try {
      const [horsesRes, ridersRes, suppliersRes, expensesRes, riderExpensesRes, categoriesRes] = await Promise.all([
        api.get('/api/horses'),
        api.get('/api/riders'),
        api.get('/api/suppliers'),
        api.get('/api/expenses'),
        api.get('/api/rider-expenses'),
        api.get('/api/categories'),
      ]);

      if (horsesRes.ok) setHorses(await horsesRes.json());
      if (ridersRes.ok) setRiders(await ridersRes.json());
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json());

      let allExpenses: Expense[] = [];
      if (expensesRes.ok) {
        const horseExpenses = await expensesRes.json();
        allExpenses = [...horseExpenses.map((e: any) => ({ ...e, type: 'horse' }))];
      }
      if (riderExpensesRes.ok) {
        const riderExpenses = await riderExpensesRes.json();
        allExpenses = [...allExpenses, ...riderExpenses.map((e: any) => ({ ...e, type: 'rider' }))];
      }
      allExpenses.sort((a, b) => b.date.localeCompare(a.date));
      setExpenses(allExpenses);

      if (categoriesRes.ok) setCategoryInfo(await categoriesRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && token) {
      fetchData();
    } else if (!authLoading && !token) {
      setLoading(false);
    }
  }, [authLoading, token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const resetForm = () => {
    setSelectedEntityId('');
    setSelectedCategory('');
    setCustomCategory('');
    setAmount('');
    setDate(new Date());
    setDescription('');
    setProvider('');
    setSelectedSupplierId(null);
    setInvoicePhoto(null);
    setInvoicePhotos([]);
    setEditingExpense(null);
    setIsRecurring(false);
    setCreateReminder(true);
  };

  const openAddModal = () => {
    // Usar shouldShowLimitPopup que respeta el estado loading
    if (shouldShowLimitPopup(subscriptionStatus, 'expenses', expenses.length)) {
      Alert.alert(
        t('limitReached'),
        t('upgradeToAddMore').replace('{item}', t('expenses').toLowerCase()),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('seePlans'), onPress: () => router.push('/subscription') }
        ]
      );
      return;
    }
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    const isRiderExpense = 'rider_id' in expense && expense.rider_id;
    setExpenseType(isRiderExpense ? 'rider' : 'horse');
    setSelectedEntityId(isRiderExpense ? expense.rider_id! : expense.horse_id!);
    setSelectedCategory(expense.category);
    setCustomCategory(expense.custom_category || '');
    setAmount(expense.amount.toString());
    setDate(new Date(expense.date));
    setDescription(expense.description || '');
    setProvider(expense.provider || '');
    setSelectedSupplierId(expense.supplier_id || null);
    setInvoicePhoto(expense.invoice_photo || null);
    setInvoicePhotos(expense.invoice_photos || []);
    setModalVisible(true);
  };

  const pickInvoicePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), t('permissionsRequired'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const newPhoto = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setInvoicePhotos([...invoicePhotos, newPhoto]);
    }
  };

  const takeInvoicePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), t('permissionsRequired'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const newPhoto = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setInvoicePhotos([...invoicePhotos, newPhoto]);
    }
  };

  const removeInvoicePhoto = (index: number) => {
    const newPhotos = invoicePhotos.filter((_, i) => i !== index);
    setInvoicePhotos(newPhotos);
  };

  // Function to view photo in full screen
  const viewPhoto = (photoUri: string, title: string) => {
    setViewingPhoto(photoUri);
    setViewingPhotoTitle(title);
    setPhotoViewerVisible(true);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatDateString = (d: Date) => {
    return d.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Seleccionar fecha';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const saveExpense = async () => {
    if (!selectedEntityId) {
      Alert.alert(t('error'), expenseType === 'horse' ? t('selectHorse') : t('selectRider'));
      return;
    }
    if (!selectedCategory) {
      Alert.alert(t('error'), t('selectCategory'));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t('error'), t('amount') + ' ' + t('required').toLowerCase());
      return;
    }

    setSaving(true);
    try {
      const expenseData = expenseType === 'horse' 
        ? {
            horse_id: selectedEntityId,
            category: selectedCategory,
            custom_category: selectedCategory === 'otros' ? customCategory.trim() : null,
            amount: parseFloat(amount),
            date: formatDateString(date),
            description: description.trim() || null,
            provider: provider.trim() || null,
            supplier_id: selectedSupplierId,
            invoice_photo: invoicePhotos.length > 0 ? invoicePhotos[0] : null,
            invoice_photos: invoicePhotos,
            is_recurring: isRecurring,
            create_reminder: createReminder,
          }
        : {
            rider_id: selectedEntityId,
            category: selectedCategory,
            custom_category: selectedCategory === 'otros' ? customCategory.trim() : null,
            amount: parseFloat(amount),
            date: formatDateString(date),
            description: description.trim() || null,
            provider: provider.trim() || null,
            supplier_id: selectedSupplierId,
            invoice_photo: invoicePhotos.length > 0 ? invoicePhotos[0] : null,
            invoice_photos: invoicePhotos,
            is_recurring: isRecurring,
            create_reminder: createReminder,
          };

      const endpoint = expenseType === 'horse' ? '/api/expenses' : '/api/rider-expenses';
      
      let response;
      if (editingExpense) {
        response = await api.put(`${endpoint}/${editingExpense.id}`, expenseData);
      } else {
        response = await api.post(endpoint, expenseData);
      }

      if (response.ok) {
        setModalVisible(false);
        resetForm();
        fetchData();
      } else {
        Alert.alert(t('error'), t('connectionError'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = (expense: Expense) => {
    const isRiderExpense = 'rider_id' in expense && expense.rider_id;
    if (Platform.OS === 'web') {
      try {
        const confirmed = window.confirm(t('confirmDeleteExpense'));
        if (confirmed) {
          performDeleteExpense(expense.id, isRiderExpense);
        }
      } catch (e) {
        performDeleteExpense(expense.id, isRiderExpense);
      }
    } else {
      Alert.alert(
        t('deleteExpense'),
        t('confirmDeleteExpense'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => performDeleteExpense(expense.id, isRiderExpense),
          },
        ]
      );
    }
  };

  const performDeleteExpense = async (expenseId: string, isRiderExpense: boolean) => {
    try {
      const endpoint = isRiderExpense ? '/api/rider-expenses' : '/api/expenses';
      const response = await api.delete(`${endpoint}/${expenseId}`);
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const getEntityName = (expense: Expense) => {
    if ('rider_id' in expense && expense.rider_id) {
      const rider = riders.find(r => r.id === expense.rider_id);
      return rider?.name || 'Desconocido';
    }
    const horse = horses.find(h => h.id === expense.horse_id);
    return horse?.name || t('unknown');
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return null;
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name;
  };

  const getTranslatedCategoryName = (category: string, customCat: string | undefined, isRider: boolean) => {
    if (category === 'otros' && customCat) return customCat;
    // Use translated category name
    return getCategoryName(category);
  };

  const getCategoryIcon = (category: string, isRider: boolean) => {
    if (isRider) return RIDER_CATEGORY_ICONS[category] || 'cash';
    return HORSE_CATEGORY_ICONS[category] || 'cash';
  };

  const getCategoryColor = (category: string, isRider: boolean) => {
    if (isRider) return RIDER_CATEGORY_COLORS[category] || '#999';
    return HORSE_CATEGORY_COLORS[category] || '#999';
  };

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const entities = expenseType === 'horse' ? horses : riders;
  const categories = expenseType === 'horse' 
    ? (categoryInfo?.horse_categories || [])
    : (categoryInfo?.rider_categories || []);
  const categoryNames = expenseType === 'horse'
    ? (categoryInfo?.horse_names || {})
    : (categoryInfo?.rider_names || {});

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const isRiderExpense = 'rider_id' in item && item.rider_id;
    const supplierName = getSupplierName(item.supplier_id);
    
    return (
      <View style={styles.expenseCard}>
        <TouchableOpacity
          style={styles.expenseContent}
          onPress={() => openEditModal(item)}
        >
          <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(item.category, !!isRiderExpense) }]}>
            <Ionicons
              name={getCategoryIcon(item.category, !!isRiderExpense) as any}
              size={20}
              color="#fff"
            />
          </View>
          <View style={styles.expenseInfo}>
            <View style={styles.expenseHeader}>
              <Text style={styles.expenseCategory}>
                {getTranslatedCategoryName(item.category, item.custom_category, !!isRiderExpense)}
              </Text>
              <View style={[styles.typeBadge, isRiderExpense ? styles.riderBadge : styles.horseBadge]}>
                <Ionicons name={isRiderExpense ? 'person' : 'fitness'} size={10} color="#fff" />
              </View>
              {item.invoice_photo && (
                <Ionicons name="document-attach" size={14} color="#666" />
              )}
            </View>
            <Text style={styles.expenseEntity}>{getEntityName(item)}</Text>
            <Text style={styles.expenseDate}>{item.date}</Text>
            {supplierName && (
              <Text style={styles.expenseSupplier}>{t('provider')}: {supplierName}</Text>
            )}
            {item.description && <Text style={styles.expenseDescription}>{item.description}</Text>}
          </View>
          <Text style={styles.expenseAmount}>{formatAmount(item.amount)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteExpense(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    );
  };

  const hasEntities = horses.length > 0 || riders.length > 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!hasEntities ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="fitness-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>{t('firstRegisterRidersOrHorses')}</Text>
          <Text style={styles.emptySubtext}>{t('horses')} / {t('riders')}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={expenses}
            renderItem={renderExpenseItem}
            keyExtractor={(item) => `${item.horse_id || item.rider_id}-${item.id}`}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cash-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>{t('noExpenses')}</Text>
                <Text style={styles.emptySubtext}>{t('addFirstExpense')}</Text>
              </View>
            }
          />

          <TouchableOpacity style={styles.fab} onPress={openAddModal}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      )}

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
              {editingExpense ? t('editExpense') : t('addExpense')}
            </Text>
            <TouchableOpacity onPress={saveExpense} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? t('saving') : t('save')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            {/* Type Selector */}
            <Text style={styles.label}>{t('expenseType')}</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeButton, expenseType === 'horse' && styles.typeButtonActive]}
                onPress={() => {
                  setExpenseType('horse');
                  setSelectedEntityId('');
                  setSelectedCategory('');
                }}
              >
                <Ionicons name="fitness" size={20} color={expenseType === 'horse' ? '#fff' : '#666'} />
                <Text style={[styles.typeButtonText, expenseType === 'horse' && styles.typeButtonTextActive]}>
                  {t('horse')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, expenseType === 'rider' && styles.typeButtonActive]}
                onPress={() => {
                  setExpenseType('rider');
                  setSelectedEntityId('');
                  setSelectedCategory('');
                }}
              >
                <Ionicons name="person" size={20} color={expenseType === 'rider' ? '#fff' : '#666'} />
                <Text style={[styles.typeButtonText, expenseType === 'rider' && styles.typeButtonTextActive]}>
                  {t('rider')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{expenseType === 'horse' ? t('horse') : t('rider')} *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowEntitySelector(true)}
            >
              <Text style={selectedEntityId ? styles.selectorText : styles.selectorPlaceholder}>
                {selectedEntityId 
                  ? entities.find(e => e.id === selectedEntityId)?.name 
                  : expenseType === 'horse' ? t('selectHorse') : t('selectRider')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <Text style={styles.label}>{t('category')} *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowCategorySelector(true)}
            >
              <Text style={selectedCategory ? styles.selectorText : styles.selectorPlaceholder}>
                {selectedCategory ? getCategoryName(selectedCategory) : t('selectCategory')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            {selectedCategory === 'otros' && (
              <>
                <Text style={styles.label}>{t('specifyCategory')}</Text>
                <TextInput
                  style={styles.input}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  placeholder={t('categoryName')}
                  placeholderTextColor="#999"
                />
              </>
            )}

            <Text style={styles.label}>{t('amount')} (€) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>{t('date')} *</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.webDateContainer}>
                <Ionicons name="calendar" size={20} color="#666" style={{ marginRight: 8 }} />
                <input
                  type="date"
                  value={formatDateString(date)}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value + 'T12:00:00');
                    setDate(newDate);
                  }}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    padding: 12,
                    border: '1px solid #e0e0e0',
                    borderRadius: 8,
                    backgroundColor: '#f5f5f5',
                    color: '#333',
                  }}
                />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.dateContainer}>
                    <Ionicons name="calendar" size={20} color="#666" />
                    <Text style={styles.selectorText}>{formatDisplayDate(formatDateString(date))}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                  />
                )}
              </>
            )}

            <Text style={styles.label}>{t('providerFromList')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowSupplierSelector(true)}
            >
              <Text style={selectedSupplierId ? styles.selectorText : styles.selectorPlaceholder}>
                {selectedSupplierId 
                  ? suppliers.find(s => s.id === selectedSupplierId)?.name 
                  : t('selectProvider')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <Text style={styles.label}>{t('freeTextProvider')}</Text>
            <TextInput
              style={styles.input}
              value={provider}
              onChangeText={setProvider}
              placeholder={t('supplierName')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('description')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>{t('invoicePhotos')}</Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoButton} onPress={pickInvoicePhoto}>
                <Ionicons name="images" size={24} color="#2E7D32" />
                <Text style={styles.photoButtonText}>{t('gallery')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={takeInvoicePhoto}>
                <Ionicons name="camera" size={24} color="#2E7D32" />
                <Text style={styles.photoButtonText}>{t('camera')}</Text>
              </TouchableOpacity>
            </View>
            {invoicePhotos.length > 0 && (
              <ScrollView horizontal style={styles.photosGallery} showsHorizontalScrollIndicator={false}>
                {invoicePhotos.map((photo, index) => (
                  <View key={index} style={styles.invoicePreview}>
                    <TouchableOpacity onPress={() => viewPhoto(photo, `${t('invoice')} ${index + 1}`)}>
                      <Image source={{ uri: photo }} style={styles.invoiceImage} />
                      <View style={styles.viewPhotoOverlay}>
                        <Ionicons name="expand-outline" size={20} color="#fff" />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.removePhotoButton}
                      onPress={() => removeInvoicePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Options Section */}
            <View style={styles.optionsSection}>
              <Text style={styles.optionsSectionTitle}>{t('options')}</Text>
              
              {/* Recurring Expense */}
              <TouchableOpacity 
                style={styles.checkboxRow}
                onPress={() => setIsRecurring(!isRecurring)}
              >
                <View style={[styles.checkbox, isRecurring && styles.checkboxChecked]}>
                  {isRecurring && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.checkboxTextContainer}>
                  <Text style={styles.checkboxLabel}>{t('recurringExpense')}</Text>
                  <Text style={styles.checkboxDescription}>{t('recurringExpenseDescription')}</Text>
                </View>
              </TouchableOpacity>

              {/* Auto Reminder */}
              <TouchableOpacity 
                style={styles.checkboxRow}
                onPress={() => setCreateReminder(!createReminder)}
              >
                <View style={[styles.checkbox, createReminder && styles.checkboxChecked]}>
                  {createReminder && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.checkboxTextContainer}>
                  <Text style={styles.checkboxLabel}>{t('createAutoReminder')}</Text>
                  <Text style={styles.checkboxDescription}>{t('createAutoReminderDescription')}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Photo Viewer Modal */}
        <Modal
          visible={photoViewerVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setPhotoViewerVisible(false)}
        >
          <View style={styles.photoViewerOverlay}>
            <View style={styles.photoViewerHeader}>
              <Text style={styles.photoViewerTitle}>{viewingPhotoTitle}</Text>
              <TouchableOpacity 
                style={styles.photoViewerClose}
                onPress={() => setPhotoViewerVisible(false)}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {viewingPhoto && (
              <Image 
                source={{ uri: viewingPhoto }} 
                style={styles.photoViewerImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

        {/* Entity Selector Modal */}
        <Modal
          visible={showEntitySelector}
          animationType="fade"
          transparent
          onRequestClose={() => setShowEntitySelector(false)}
        >
          <TouchableOpacity
            style={styles.selectorOverlay}
            activeOpacity={1}
            onPress={() => setShowEntitySelector(false)}
          >
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>
                {expenseType === 'horse' ? t('selectHorse') : t('selectRider')}
              </Text>
              <FlatList
                data={entities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, selectedEntityId === item.id && styles.selectorItemSelected]}
                    onPress={() => {
                      setSelectedEntityId(item.id);
                      setShowEntitySelector(false);
                    }}
                  >
                    <Text style={styles.selectorItemText}>{item.name}</Text>
                    {selectedEntityId === item.id && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyListText}>
                    {expenseType === 'horse' ? t('noHorses') : t('noRiders')}
                  </Text>
                }
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Category Selector Modal */}
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
                data={categories}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, selectedCategory === item && styles.selectorItemSelected]}
                    onPress={() => {
                      setSelectedCategory(item);
                      setShowCategorySelector(false);
                    }}
                  >
                    <View style={styles.categoryItemContent}>
                      <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(item, expenseType === 'rider') }]} />
                      <Text style={styles.selectorItemText}>{getCategoryName(item)}</Text>
                    </View>
                    {selectedCategory === item && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Supplier Selector Modal */}
        <Modal
          visible={showSupplierSelector}
          animationType="fade"
          transparent
          onRequestClose={() => setShowSupplierSelector(false)}
        >
          <TouchableOpacity
            style={styles.selectorOverlay}
            activeOpacity={1}
            onPress={() => setShowSupplierSelector(false)}
          >
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>{t('selectProvider')}</Text>
              <TouchableOpacity
                style={[styles.selectorItem, !selectedSupplierId && styles.selectorItemSelected]}
                onPress={() => {
                  setSelectedSupplierId(null);
                  setShowSupplierSelector(false);
                }}
              >
                <Text style={styles.selectorItemText}>{t('noProvider')}</Text>
                {!selectedSupplierId && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
              </TouchableOpacity>
              <FlatList
                data={suppliers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, selectedSupplierId === item.id && styles.selectorItemSelected]}
                    onPress={() => {
                      setSelectedSupplierId(item.id);
                      setShowSupplierSelector(false);
                    }}
                  >
                    <View>
                      <Text style={styles.selectorItemText}>{item.name}</Text>
                      {item.category && (
                        <Text style={styles.selectorItemSubtext}>{item.category}</Text>
                      )}
                    </View>
                    {selectedSupplierId === item.id && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyListText}>{t('noSuppliers')}</Text>
                }
              />
            </View>
          </TouchableOpacity>
        </Modal>
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
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  expenseCard: {
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
  },
  expenseContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  horseBadge: {
    backgroundColor: '#4CAF50',
  },
  riderBadge: {
    backgroundColor: '#2196F3',
  },
  expenseEntity: {
    fontSize: 14,
    color: '#2E7D32',
    marginTop: 2,
  },
  expenseDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  expenseSupplier: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  expenseDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
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
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingLeft: 12,
    marginBottom: 4,
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  invoicePreview: {
    marginRight: 12,
    position: 'relative',
  },
  invoiceImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  viewPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    alignItems: 'center',
  },
  photosGallery: {
    marginTop: 12,
    marginBottom: 8,
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerHeader: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  photoViewerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  photoViewerClose: {
    padding: 8,
  },
  photoViewerImage: {
    width: '100%',
    height: '80%',
  },
  bottomSpacer: {
    height: 40,
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
  selectorItemSubtext: {
    fontSize: 12,
    color: '#666',
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  emptyListText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  optionsSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  optionsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2E7D32',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2E7D32',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  checkboxDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
