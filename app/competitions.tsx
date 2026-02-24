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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { api } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../src/context/SubscriptionContext';
import { canAddMore, shouldShowLimitPopup, FREE_LIMITS } from '../src/utils/subscriptionLimits';
import { useRouter } from 'expo-router';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


interface Competition {
  id: string;
  name: string;
  date: string;
  end_date?: string;
  place: string;
  city: string;
  country: string;
  location_link?: string;
  discipline: string;
  custom_discipline?: string;
  level?: string;
  organizer?: string;
  entry_deadline?: string;
  entry_fee?: number;
  notes?: string;
  website?: string;
  contact_phone?: string;
  contact_email?: string;
  accommodation_info?: string;
  participating_horses: string[];
  participating_riders: string[];
  created_at: string;
  updated_at: string;
}

interface Horse {
  id: string;
  name: string;
}

interface Rider {
  id: string;
  name: string;
}

const DISCIPLINES = [
  'salto',
  'doma_clasica',
  'doma_vaquera',
  'concurso_completo',
  'raid',
  'enganche',
  'reining',
  'volteo',
  'horseball',
  'polo',
  'otros'
];

const DISCIPLINE_COLORS: Record<string, string> = {
  salto: '#4CAF50',
  doma_clasica: '#2196F3',
  doma_vaquera: '#FF9800',
  concurso_completo: '#9C27B0',
  raid: '#795548',
  enganche: '#607D8B',
  reining: '#E91E63',
  volteo: '#00BCD4',
  horseball: '#FFC107',
  polo: '#3F51B5',
  otros: '#9E9E9E'
};

export default function CompetitionsScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { isProUser, subscriptionStatus } = useSubscription();
  const router = useRouter();
  
  // Function to get translated discipline names
  const getDisciplineName = (discipline: string): string => {
    const disciplineKeys: Record<string, string> = {
      salto: 'disciplines.jumping',
      doma_clasica: 'disciplines.classicalDressage',
      doma_vaquera: 'disciplines.vaqueraDressage',
      concurso_completo: 'disciplines.eventing',
      raid: 'disciplines.endurance',
      enganche: 'disciplines.driving',
      reining: 'disciplines.reining',
      volteo: 'disciplines.vaulting',
      horseball: 'disciplines.horseball',
      polo: 'disciplines.polo',
      otros: 'disciplines.other'
    };
    return t(disciplineKeys[discipline] || discipline);
  };

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Check if user can add more competitions
  const canAddCompetition = canAddMore(subscriptionStatus, 'competitions', competitions.length);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [viewingCompetition, setViewingCompetition] = useState<Competition | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [place, setPlace] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('España');
  const [discipline, setDiscipline] = useState('');
  const [customDiscipline, setCustomDiscipline] = useState('');
  const [level, setLevel] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [entryDeadline, setEntryDeadline] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [accommodationInfo, setAccommodationInfo] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDisciplineSelector, setShowDisciplineSelector] = useState(false);
  
  // Reminder/Notification state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [selectedReminderDate, setSelectedReminderDate] = useState(new Date());
  const [selectedReminderTime, setSelectedReminderTime] = useState(new Date());
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  
  // Entry fee association (rider/horse)
  const [entryFeeEntityType, setEntryFeeEntityType] = useState<'horse' | 'rider'>('rider');
  const [entryFeeEntityId, setEntryFeeEntityId] = useState<string | null>(null);
  const [showEntitySelector, setShowEntitySelector] = useState(false);
  const [createExpense, setCreateExpense] = useState(false);
  
  // Date picker states
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState(new Date());
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);

  // Date picker handlers
  const onDateChange = (event: any, selectedDateValue?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDateValue) {
      setSelectedDate(selectedDateValue);
      const dateStr = selectedDateValue.toISOString().split('T')[0];
      setDate(dateStr);
    }
  };

  const onEndDateChange = (event: any, selectedDateValue?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (selectedDateValue) {
      setSelectedEndDate(selectedDateValue);
      const dateStr = selectedDateValue.toISOString().split('T')[0];
      setEndDate(dateStr);
    }
  };

  const onDeadlineChange = (event: any, selectedDateValue?: Date) => {
    setShowDeadlinePicker(Platform.OS === 'ios');
    if (selectedDateValue) {
      setSelectedDeadlineDate(selectedDateValue);
      const dateStr = selectedDateValue.toISOString().split('T')[0];
      setEntryDeadline(dateStr);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return t('selectDate');
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '09:00';
    return timeStr;
  };

  // Reminder date/time handlers
  const onReminderDateChange = (event: any, date?: Date) => {
    setShowReminderDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedReminderDate(date);
      setReminderDate(date.toISOString().split('T')[0]);
    }
  };

  const onReminderTimeChange = (event: any, time?: Date) => {
    setShowReminderTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedReminderTime(time);
      const hours = time.getHours().toString().padStart(2, '0');
      const minutes = time.getMinutes().toString().padStart(2, '0');
      setReminderTime(`${hours}:${minutes}`);
    }
  };

  // Schedule notification function
  const scheduleCompetitionNotification = async (competitionName: string, reminderDateTime: Date) => {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permissions'), t('notificationPermissionsRequired'));
        return;
      }

      const trigger = reminderDateTime.getTime() - Date.now();
      
      if (trigger > 0 && trigger < 30 * 24 * 60 * 60 * 1000) { // Max 30 days
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🏇 ${t('competitionReminder')}`,
            body: `${competitionName} - ${t('dontForgetToPrepare')}`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDateTime,
          },
        });
        console.log('Notification scheduled for:', reminderDateTime);
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Create expense for entry fee
  const createEntryFeeExpense = async (competitionName: string, fee: string, entityType: 'horse' | 'rider', entityId: string) => {
    try {
      const expenseData = {
        amount: parseFloat(fee),
        date: new Date().toISOString().split('T')[0],
        description: `Inscripción: ${competitionName}`,
        provider: organizer || 'Organizador',
      };

      if (entityType === 'horse') {
        const response = await api.post('/api/expenses', {
          ...expenseData,
          category: 'concursos', // Horse expense category
          horse_id: entityId,
        });
        if (response.ok) {
          console.log('Horse expense created successfully');
        } else {
          const error = await response.json();
          console.error('Horse expense error:', error);
        }
      } else {
        const response = await api.post('/api/rider-expenses', {
          ...expenseData,
          category: 'competiciones', // Rider expense category
          rider_id: entityId,
        });
        if (response.ok) {
          console.log('Rider expense created successfully');
        } else {
          const error = await response.json();
          console.error('Rider expense error:', error);
        }
      }
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  const getEntityName = (entityType: 'horse' | 'rider', entityId: string | null) => {
    if (!entityId) return t('select');
    if (entityType === 'horse') {
      const horse = horses.find(h => h.id === entityId);
      return horse?.name || t('select');
    } else {
      const rider = riders.find(r => r.id === entityId);
      return rider?.name || t('select');
    }
  };

  const fetchData = async () => {
    try {
      const [competitionsRes, horsesRes, ridersRes] = await Promise.all([
        api.get(`/api/competitions?upcoming=${showUpcoming}`),
        api.get('/api/horses'),
        api.get('/api/riders')
      ]);

      if (competitionsRes.ok) {
        const data = await competitionsRes.json();
        setCompetitions(data);
      }
      if (horsesRes.ok) {
        const data = await horsesRes.json();
        setHorses(data);
      }
      if (ridersRes.ok) {
        const data = await ridersRes.json();
        setRiders(data);
      }
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
  }, [authLoading, token, showUpcoming]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [showUpcoming]);

  const resetForm = () => {
    setName('');
    setDate('');
    setEndDate('');
    setPlace('');
    setCity('');
    setCountry('España');
    setDiscipline('');
    setCustomDiscipline('');
    setLevel('');
    setOrganizer('');
    setEntryDeadline('');
    setEntryFee('');
    setNotes('');
    setWebsite('');
    setContactPhone('');
    setContactEmail('');
    setAccommodationInfo('');
    setLocationLink('');
    setEditingCompetition(null);
    // Reset reminder fields
    setReminderEnabled(false);
    setReminderDate('');
    setReminderTime('09:00');
    // Reset expense fields
    setCreateExpense(false);
    setEntryFeeEntityType('rider');
    setEntryFeeEntityId(null);
  };

  const openAddModal = () => {
    // Usar shouldShowLimitPopup que respeta el estado loading
    if (shouldShowLimitPopup(subscriptionStatus, 'competitions', competitions.length)) {
      Alert.alert(
        t('limitReached'),
        t('upgradeToAddMore').replace('{item}', t('competitions').toLowerCase()),
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

  const openEditModal = (competition: Competition) => {
    setEditingCompetition(competition);
    setName(competition.name);
    setDate(competition.date);
    setEndDate(competition.end_date || '');
    setPlace(competition.place);
    setCity(competition.city);
    setCountry(competition.country || 'España');
    setDiscipline(competition.discipline);
    setCustomDiscipline(competition.custom_discipline || '');
    setLevel(competition.level || '');
    setOrganizer(competition.organizer || '');
    setEntryDeadline(competition.entry_deadline || '');
    setEntryFee(competition.entry_fee?.toString() || '');
    setNotes(competition.notes || '');
    setWebsite(competition.website || '');
    setContactPhone(competition.contact_phone || '');
    setContactEmail(competition.contact_email || '');
    setAccommodationInfo(competition.accommodation_info || '');
    setLocationLink(competition.location_link || '');
    setModalVisible(true);
  };

  const openDetailModal = (competition: Competition) => {
    setViewingCompetition(competition);
    setDetailModalVisible(true);
  };

  const saveCompetition = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('competitionNameRequired'));
      return;
    }
    if (!date) {
      Alert.alert(t('error'), t('dateRequired'));
      return;
    }
    if (!place.trim()) {
      Alert.alert(t('error'), t('placeRequired'));
      return;
    }
    if (!city.trim()) {
      Alert.alert(t('error'), t('cityRequired'));
      return;
    }
    if (!discipline) {
      Alert.alert(t('error'), t('disciplineRequired'));
      return;
    }
    
    // Validate expense creation - require entity selection if there's an entry fee
    if (entryFee && parseFloat(entryFee) > 0 && !entryFeeEntityId) {
      Alert.alert(t('error'), t('selectRiderOrHorseForExpense'));
      return;
    }

    setSaving(true);
    try {
      const competitionData = {
        name: name.trim(),
        date,
        end_date: endDate || null,
        place: place.trim(),
        city: city.trim(),
        country: country.trim() || 'España',
        location_link: locationLink.trim() || null,
        discipline,
        custom_discipline: discipline === 'otros' ? customDiscipline.trim() : null,
        level: level.trim() || null,
        organizer: organizer.trim() || null,
        entry_deadline: entryDeadline || null,
        entry_fee: entryFee ? parseFloat(entryFee) : null,
        notes: notes.trim() || null,
        website: website.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        accommodation_info: accommodationInfo.trim() || null,
        participating_horses: editingCompetition?.participating_horses || [],
        participating_riders: editingCompetition?.participating_riders || [],
      };

      let response;
      if (editingCompetition) {
        response = await api.put(`/api/competitions/${editingCompetition.id}`, competitionData);
      } else {
        response = await api.post('/api/competitions', competitionData);
      }

      if (response.ok) {
        // Schedule notification if enabled
        if (reminderEnabled && reminderDate && !editingCompetition) {
          const [hours, minutes] = reminderTime.split(':').map(Number);
          const reminderDateTime = new Date(reminderDate);
          reminderDateTime.setHours(hours, minutes, 0, 0);
          await scheduleCompetitionNotification(name.trim(), reminderDateTime);
        }
        
        // Create expense automatically if there's an entry fee and entity selected
        if (entryFee && parseFloat(entryFee) > 0 && entryFeeEntityId && !editingCompetition) {
          await createEntryFeeExpense(name.trim(), entryFee, entryFeeEntityType, entryFeeEntityId);
        }
        
        setModalVisible(false);
        resetForm();
        fetchData();
        
        let successMsg = editingCompetition ? t('competitionUpdated') : t('competitionCreated');
        if (reminderEnabled && reminderDate && !editingCompetition) {
          successMsg += '. ' + t('reminderScheduled');
        }
        if (entryFee && parseFloat(entryFee) > 0 && entryFeeEntityId && !editingCompetition) {
          successMsg += '. ' + t('entryFeeRegistered');
        }
        Alert.alert(t('success'), successMsg);
      } else {
        Alert.alert(t('error'), t('connectionError'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteCompetition = (competition: Competition) => {
    if (Platform.OS === 'web') {
      try {
        const confirmed = window.confirm(t('confirmDeleteCompetition'));
        if (confirmed) {
          performDeleteCompetition(competition.id);
        }
      } catch (e) {
        performDeleteCompetition(competition.id);
      }
    } else {
      Alert.alert(
        t('deleteCompetition'),
        t('confirmDeleteCompetition'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => performDeleteCompetition(competition.id),
          },
        ]
      );
    }
  };

  const performDeleteCompetition = async (competitionId: string) => {
    try {
      const response = await api.delete(`/api/competitions/${competitionId}`);
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const competitionDate = new Date(dateStr);
    competitionDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil((competitionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const renderCompetitionItem = ({ item }: { item: Competition }) => {
    const daysUntil = getDaysUntil(item.date);
    const isPast = daysUntil < 0;
    const isToday = daysUntil === 0;
    const isSoon = daysUntil > 0 && daysUntil <= 7;

    return (
      <View style={[styles.competitionCard, isPast && styles.pastCard]}>
        <TouchableOpacity
          style={styles.competitionCardContent}
          onPress={() => openDetailModal(item)}
        >
          <View style={[styles.disciplineBadge, { backgroundColor: DISCIPLINE_COLORS[item.discipline] || '#999' }]}>
            <Ionicons name="trophy" size={20} color="#fff" />
          </View>
          <View style={styles.competitionInfo}>
            <Text style={styles.competitionName}>{item.name}</Text>
            <Text style={styles.competitionDiscipline}>
              {item.discipline === 'otros' && item.custom_discipline 
                ? item.custom_discipline 
                : getDisciplineName(item.discipline)}
            </Text>
            <View style={styles.competitionMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar" size={14} color="#666" />
                <Text style={styles.metaText}>{item.date}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="location" size={14} color="#666" />
                <Text style={styles.metaText}>{item.city}</Text>
              </View>
            </View>
            <Text style={[
              styles.daysUntil,
              isPast && styles.pastText,
              isToday && styles.todayText,
              isSoon && styles.soonText,
            ]}>
              {isPast 
                ? t('daysAgoComp', { count: Math.abs(daysUntil) })
                : isToday 
                  ? t('today')
                  : daysUntil === 1 
                    ? t('tomorrow') 
                    : t('inDaysComp', { count: daysUntil })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditModal(item)}
          >
            <Ionicons name="create-outline" size={20} color="#666" />
          </TouchableOpacity>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteCompetition(item)}
        >
          <Ionicons name="trash-outline" size={22} color="#F44336" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter Toggle */}
      <View style={styles.filterToggle}>
        <TouchableOpacity
          style={[styles.filterButton, showUpcoming && styles.filterButtonActive]}
          onPress={() => setShowUpcoming(true)}
        >
          <Text style={[styles.filterButtonText, showUpcoming && styles.filterButtonTextActive]}>
            {t('upcomingCompetitions')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, !showUpcoming && styles.filterButtonActive]}
          onPress={() => setShowUpcoming(false)}
        >
          <Text style={[styles.filterButtonText, !showUpcoming && styles.filterButtonTextActive]}>
            {t('allCompetitions')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={competitions}
        renderItem={renderCompetitionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {showUpcoming ? t('noCompetitions') : t('noCompetitions')}
            </Text>
            <Text style={styles.emptySubtext}>{t('addFirstCompetition')}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

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
              {editingCompetition ? t('editCompetition') : t('newCompetition')}
            </Text>
            <TouchableOpacity onPress={saveCompetition} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? t('saving') : t('save')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <Text style={styles.sectionHeader}>{t('basicInfo')}</Text>

            <Text style={styles.label}>{t('competitionName')} *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ej: CSI 3* Madrid"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('discipline')} *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowDisciplineSelector(true)}
            >
              <Text style={discipline ? styles.selectorText : styles.selectorPlaceholder}>
                {discipline ? getDisciplineName(discipline) : t('selectDiscipline')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            {discipline === 'otros' && (
              <>
                <Text style={styles.label}>{t('specifyDiscipline')}</Text>
                <TextInput
                  style={styles.input}
                  value={customDiscipline}
                  onChangeText={setCustomDiscipline}
                  placeholder="Nombre de la disciplina"
                  placeholderTextColor="#999"
                />
              </>
            )}

            <Text style={styles.label}>{t('levelCategory')}</Text>
            <TextInput
              style={styles.input}
              value={level}
              onChangeText={setLevel}
              placeholder={t('levelCategory')}
              placeholderTextColor="#999"
            />

            <Text style={styles.sectionHeader}>{t('dates')}</Text>

            <Text style={styles.label}>{t('startDate')} *</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={date}
                onChange={(e: any) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.dateButton} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#666" />
                  <Text style={styles.dateButtonText}>{formatDisplayDate(date)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                  />
                )}
              </>
            )}

            <Text style={styles.label}>{t('endDate')}</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={endDate}
                onChange={(e: any) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.dateButton} 
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#666" />
                  <Text style={styles.dateButtonText}>{formatDisplayDate(endDate) === t('selectDate') ? t('optionalText') : formatDisplayDate(endDate)}</Text>
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

            <Text style={styles.label}>{t('entryDeadline')}</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={entryDeadline}
                onChange={(e: any) => setEntryDeadline(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.dateButton} 
                  onPress={() => setShowDeadlinePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#666" />
                  <Text style={styles.dateButtonText}>{formatDisplayDate(entryDeadline) === t('selectDate') ? t('optionalText') : formatDisplayDate(entryDeadline)}</Text>
                </TouchableOpacity>
                {showDeadlinePicker && (
                  <DateTimePicker
                    value={selectedDeadlineDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDeadlineChange}
                  />
                )}
              </>
            )}

            <Text style={styles.sectionHeader}>{t('locationSection')}</Text>

            <Text style={styles.label}>{t('venue')} *</Text>
            <TextInput
              style={styles.input}
              value={place}
              onChangeText={setPlace}
              placeholder={t('venue')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('city')} *</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Ciudad"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('country')}</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="País"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('locationLink')}</Text>
            <TextInput
              style={styles.input}
              value={locationLink}
              onChangeText={setLocationLink}
              placeholder="https://maps.google.com/..."
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.sectionHeader}>{t('organization')}</Text>

            <Text style={styles.label}>{t('organizer')}</Text>
            <TextInput
              style={styles.input}
              value={organizer}
              onChangeText={setOrganizer}
              placeholder={t('organizer')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('entryFee')} (€)</Text>
            <TextInput
              style={styles.input}
              value={entryFee}
              onChangeText={setEntryFee}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />

            {/* Expense association - always show when there's an entry fee */}
            {entryFee && parseFloat(entryFee) > 0 && (
              <>
                <Text style={styles.label}>{t('associateExpenseTo')}:</Text>
                <View style={styles.entityTypeContainer}>
                  <TouchableOpacity
                    style={[styles.entityTypeButton, entryFeeEntityType === 'rider' && styles.entityTypeButtonActive]}
                    onPress={() => { setEntryFeeEntityType('rider'); setEntryFeeEntityId(null); }}
                  >
                    <Ionicons name="person" size={18} color={entryFeeEntityType === 'rider' ? '#fff' : '#666'} />
                    <Text style={[styles.entityTypeText, entryFeeEntityType === 'rider' && styles.entityTypeTextActive]}>{t('rider')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.entityTypeButton, entryFeeEntityType === 'horse' && styles.entityTypeButtonActive]}
                    onPress={() => { setEntryFeeEntityType('horse'); setEntryFeeEntityId(null); }}
                  >
                    <Ionicons name="fitness" size={18} color={entryFeeEntityType === 'horse' ? '#fff' : '#666'} />
                    <Text style={[styles.entityTypeText, entryFeeEntityType === 'horse' && styles.entityTypeTextActive]}>{t('horse')}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={() => setShowEntitySelector(true)}
                >
                  <Ionicons name={entryFeeEntityType === 'rider' ? 'person' : 'fitness'} size={20} color="#666" />
                  <Text style={styles.selectorButtonText}>
                    {getEntityName(entryFeeEntityType, entryFeeEntityId)}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>

                <View style={styles.expenseInfoBox}>
                  <Ionicons name="information-circle" size={18} color="#2E7D32" />
                  <Text style={styles.expenseInfoText}>
                    {t('expenseAutoCreate', { amount: entryFee, entity: entryFeeEntityType === 'rider' ? t('rider').toLowerCase() : t('horse').toLowerCase() })}
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.sectionHeader}>{t('reminders')}</Text>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setReminderEnabled(!reminderEnabled)}
            >
              <View style={[styles.checkbox, reminderEnabled && styles.checkboxChecked]}>
                {reminderEnabled && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>{t('scheduleReminderCheckbox')}</Text>
            </TouchableOpacity>

            {reminderEnabled && (
              <>
                <Text style={styles.label}>{t('reminderDate')}</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e: any) => setReminderDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      fontSize: 16,
                      borderRadius: 8,
                      border: '1px solid #e0e0e0',
                      backgroundColor: '#fff',
                      boxSizing: 'border-box',
                      marginBottom: 16,
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.dateButton} 
                      onPress={() => setShowReminderDatePicker(true)}
                    >
                      <Ionicons name="calendar" size={20} color="#666" />
                      <Text style={styles.dateButtonText}>{formatDisplayDate(reminderDate)}</Text>
                    </TouchableOpacity>
                    {showReminderDatePicker && (
                      <DateTimePicker
                        value={selectedReminderDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onReminderDateChange}
                      />
                    )}
                  </>
                )}

                <Text style={styles.label}>{t('reminderTime')}</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e: any) => setReminderTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      fontSize: 16,
                      borderRadius: 8,
                      border: '1px solid #e0e0e0',
                      backgroundColor: '#fff',
                      boxSizing: 'border-box',
                      marginBottom: 16,
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.dateButton} 
                      onPress={() => setShowReminderTimePicker(true)}
                    >
                      <Ionicons name="time" size={20} color="#666" />
                      <Text style={styles.dateButtonText}>{formatDisplayTime(reminderTime)}</Text>
                    </TouchableOpacity>
                    {showReminderTimePicker && (
                      <DateTimePicker
                        value={selectedReminderTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onReminderTimeChange}
                      />
                    )}
                  </>
                )}
              </>
            )}

            <Text style={styles.label}>{t('website')}</Text>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://..."
              placeholderTextColor="#999"
              autoCapitalize="none"
            />

            <Text style={styles.sectionHeader}>{t('contact')}</Text>

            <Text style={styles.label}>{t('contactPhone')}</Text>
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="+34 600 000 000"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t('contactEmail')}</Text>
            <TextInput
              style={styles.input}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('accommodationInfo')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={accommodationInfo}
              onChangeText={setAccommodationInfo}
              placeholder={t('accommodation')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>{t('notes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('notes')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Discipline Selector */}
        <Modal
          visible={showDisciplineSelector}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDisciplineSelector(false)}
        >
          <TouchableOpacity
            style={styles.selectorOverlay}
            activeOpacity={1}
            onPress={() => setShowDisciplineSelector(false)}
          >
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>{t('selectDiscipline')}</Text>
              <FlatList
                data={DISCIPLINES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, discipline === item && styles.selectorItemSelected]}
                    onPress={() => {
                      setDiscipline(item);
                      setShowDisciplineSelector(false);
                    }}
                  >
                    <View style={styles.disciplineItemContent}>
                      <View style={[styles.disciplineDot, { backgroundColor: DISCIPLINE_COLORS[item] }]} />
                      <Text style={styles.selectorItemText}>{getDisciplineName(item)}</Text>
                    </View>
                    {discipline === item && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Entity Selector (Horse/Rider for expense) */}
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
                {entryFeeEntityType === 'rider' ? t('selectRider') : t('selectHorse')}
              </Text>
              <FlatList
                data={entryFeeEntityType === 'rider' ? riders : horses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, entryFeeEntityId === item.id && styles.selectorItemSelected]}
                    onPress={() => {
                      setEntryFeeEntityId(item.id);
                      setShowEntitySelector(false);
                    }}
                  >
                    <Ionicons 
                      name={entryFeeEntityType === 'rider' ? 'person' : 'fitness'} 
                      size={20} 
                      color="#666" 
                      style={{ marginRight: 12 }}
                    />
                    <Text style={styles.selectorItemText}>{item.name}</Text>
                    {entryFeeEntityId === item.id && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {entryFeeEntityType === 'rider' ? t('noRiders') : t('noHorses')}
                  </Text>
                }
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.modalCancel}>{t('close')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('details')}</Text>
            <TouchableOpacity onPress={() => {
              setDetailModalVisible(false);
              if (viewingCompetition) openEditModal(viewingCompetition);
            }}>
              <Text style={styles.modalSave}>{t('edit')}</Text>
            </TouchableOpacity>
          </View>

          {viewingCompetition && (
            <ScrollView style={styles.formContainer}>
              <View style={[styles.detailHeader, { backgroundColor: DISCIPLINE_COLORS[viewingCompetition.discipline] || '#999' }]}>
                <Text style={styles.detailName}>{viewingCompetition.name}</Text>
                <Text style={styles.detailDiscipline}>
                  {viewingCompetition.discipline === 'otros' && viewingCompetition.custom_discipline 
                    ? viewingCompetition.custom_discipline 
                    : getDisciplineName(viewingCompetition.discipline)}
                </Text>
                {viewingCompetition.level && (
                  <Text style={styles.detailLevel}>{viewingCompetition.level}</Text>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>{t('dates')}</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={18} color="#666" />
                  <Text style={styles.detailText}>
                    {viewingCompetition.date}
                    {viewingCompetition.end_date && ` - ${viewingCompetition.end_date}`}
                  </Text>
                </View>
                {viewingCompetition.entry_deadline && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={18} color="#FF9800" />
                    <Text style={styles.detailText}>
                      {t('registrationUntil')}: {viewingCompetition.entry_deadline}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>{t('locationSection')}</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={18} color="#666" />
                  <Text style={styles.detailText}>{viewingCompetition.place}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="business" size={18} color="#666" />
                  <Text style={styles.detailText}>
                    {viewingCompetition.city}, {viewingCompetition.country}
                  </Text>
                </View>
              </View>

              {(viewingCompetition.organizer || viewingCompetition.entry_fee) && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{t('organization')}</Text>
                  {viewingCompetition.organizer && (
                    <View style={styles.detailRow}>
                      <Ionicons name="people" size={18} color="#666" />
                      <Text style={styles.detailText}>{viewingCompetition.organizer}</Text>
                    </View>
                  )}
                  {viewingCompetition.entry_fee && (
                    <View style={styles.detailRow}>
                      <Ionicons name="cash" size={18} color="#666" />
                      <Text style={styles.detailText}>
                        {t('registration')}: {formatAmount(viewingCompetition.entry_fee)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {(viewingCompetition.contact_phone || viewingCompetition.contact_email || viewingCompetition.website) && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{t('contact')}</Text>
                  {viewingCompetition.contact_phone && (
                    <View style={styles.detailRow}>
                      <Ionicons name="call" size={18} color="#666" />
                      <Text style={styles.detailText}>{viewingCompetition.contact_phone}</Text>
                    </View>
                  )}
                  {viewingCompetition.contact_email && (
                    <View style={styles.detailRow}>
                      <Ionicons name="mail" size={18} color="#666" />
                      <Text style={styles.detailText}>{viewingCompetition.contact_email}</Text>
                    </View>
                  )}
                  {viewingCompetition.website && (
                    <View style={styles.detailRow}>
                      <Ionicons name="globe" size={18} color="#666" />
                      <Text style={[styles.detailText, styles.linkText]}>{viewingCompetition.website}</Text>
                    </View>
                  )}
                </View>
              )}

              {viewingCompetition.accommodation_info && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{t('lodging')}</Text>
                  <Text style={styles.detailParagraph}>{viewingCompetition.accommodation_info}</Text>
                </View>
              )}

              {viewingCompetition.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{t('notes')}</Text>
                  <Text style={styles.detailParagraph}>{viewingCompetition.notes}</Text>
                </View>
              )}

              <View style={styles.bottomSpacer} />
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
  filterToggle: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#2E7D32',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  entityTypeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  entityTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  entityTypeButtonActive: {
    backgroundColor: '#2E7D32',
  },
  entityTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  entityTypeTextActive: {
    color: '#fff',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectorButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  expenseInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  expenseInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#2E7D32',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  competitionCard: {
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
  competitionCardContent: {
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
  pastCard: {
    opacity: 0.6,
  },
  disciplineBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  competitionInfo: {
    flex: 1,
  },
  competitionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  competitionDiscipline: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  competitionMeta: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  daysUntil: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
  },
  pastText: {
    color: '#999',
  },
  todayText: {
    color: '#FF9800',
  },
  soonText: {
    color: '#F44336',
  },
  editButton: {
    padding: 8,
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
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 24,
    marginBottom: 12,
    letterSpacing: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
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
    maxHeight: '70%',
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
  disciplineItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disciplineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  bottomSpacer: {
    height: 40,
  },
  detailHeader: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  detailName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  detailDiscipline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  detailLevel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  detailParagraph: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  linkText: {
    color: '#2196F3',
  },
});
