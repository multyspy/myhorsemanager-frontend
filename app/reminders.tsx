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
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../src/context/SubscriptionContext';
import { shouldShowLimitPopup, FREE_LIMITS } from '../src/utils/subscriptionLimits';
import { useRouter } from 'expo-router';


interface Reminder {
  id: string;
  title: string;
  description?: string;
  reminder_date: string;
  reminder_time: string;
  entity_type: string;
  entity_id?: string;
  category?: string;
  is_automatic: boolean;
  is_completed: boolean;
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

export default function RemindersScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [entityType, setEntityType] = useState<'horse' | 'rider'>('horse');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEntitySelector, setShowEntitySelector] = useState(false);
  
  // Date/Time picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fetchData = async () => {
    try {
      const [remindersRes, horsesRes, ridersRes] = await Promise.all([
        api.get(`/api/reminders?is_completed=${filter === 'completed'}`),
        api.get('/api/horses'),
        api.get('/api/riders'),
      ]);

      if (remindersRes.ok) {
        let data = await remindersRes.json();
        if (filter === 'all') {
          // Fetch all reminders
          const allRes = await api.get('/api/reminders');
          if (allRes.ok) {
            data = await allRes.json();
          }
        }
        setReminders(data);
      }

      if (horsesRes.ok) {
        const horsesData = await horsesRes.json();
        setHorses(horsesData);
      }

      if (ridersRes.ok) {
        const ridersData = await ridersRes.json();
        setRiders(ridersData);
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
  }, [authLoading, token, filter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [filter]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    const today = new Date();
    setSelectedDate(today);
    setSelectedTime(today);
    setReminderDate(today.toISOString().split('T')[0]);
    setReminderTime('09:00');
    setEntityType('horse');
    setEntityId(null);
    setEditingReminder(null);
  };

  const { isProUser, subscriptionStatus } = useSubscription();
  const router = useRouter();

  const openAddModal = () => {
    // Usar shouldShowLimitPopup que respeta el estado loading
    if (shouldShowLimitPopup(subscriptionStatus, 'reminders', reminders.length)) {
      Alert.alert(
        t('limitReached'),
        t('upgradeToAddMore').replace('{item}', t('reminders').toLowerCase()),
        [
          { text: t('cancel'), style: 'cancel' },
          { 
            text: t('seePlans'), 
            onPress: () => router.push('/subscription')
          },
        ]
      );
      return;
    }
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setTitle(reminder.title);
    setDescription(reminder.description || '');
    setReminderDate(reminder.reminder_date);
    setReminderTime(reminder.reminder_time || '09:00');
    
    // Parse date
    const [year, month, day] = reminder.reminder_date.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, day));
    
    // Parse time
    const [hours, minutes] = (reminder.reminder_time || '09:00').split(':').map(Number);
    const timeDate = new Date();
    timeDate.setHours(hours, minutes, 0, 0);
    setSelectedTime(timeDate);
    
    setEntityType(reminder.entity_type as 'horse' | 'rider');
    setEntityId(reminder.entity_id || null);
    setModalVisible(true);
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setReminderDate(`${year}-${month}-${day}`);
    }
  };

  const onTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedTime(time);
      const hours = String(time.getHours()).padStart(2, '0');
      const minutes = String(time.getMinutes()).padStart(2, '0');
      setReminderTime(`${hours}:${minutes}`);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return t('selectDate');
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return t('selectTime');
    return timeStr;
  };

  const saveReminder = async () => {
    if (!title.trim()) {
      Alert.alert(t('error'), t('titleRequired'));
      return;
    }
    if (!reminderDate) {
      Alert.alert(t('error'), t('dateRequired'));
      return;
    }

    setSaving(true);
    try {
      const reminderData = {
        title: title.trim(),
        description: description.trim() || null,
        reminder_date: reminderDate,
        reminder_time: reminderTime,
        entity_type: entityType,
        entity_id: entityId,
        is_automatic: false,
        is_completed: editingReminder?.is_completed || false,
      };

      let response;
      if (editingReminder) {
        response = await api.put(`/api/reminders/${editingReminder.id}`, reminderData);
      } else {
        response = await api.post('/api/reminders', reminderData);
      }

      if (response.ok) {
        // Schedule local notification
        const reminder = await response.json();
        await scheduleNotification(reminder);
        
        setModalVisible(false);
        resetForm();
        fetchData();
      } else {
        Alert.alert(t('error'), t('connectionError'));
      }
    } catch (error) {
      console.error('Error saving reminder:', error);
      Alert.alert(t('error'), t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const scheduleNotification = async (reminder: Reminder) => {
    try {
      const reminderDateTime = new Date(`${reminder.reminder_date}T${reminder.reminder_time || '09:00'}:00`);
      const now = new Date();
      
      if (reminderDateTime > now) {
        const trigger = reminderDateTime.getTime() - now.getTime();
        
        if (trigger > 0 && trigger < 30 * 24 * 60 * 60 * 1000) { // Max 30 days
          await Notifications.scheduleNotificationAsync({
            content: {
              title: reminder.title,
              body: reminder.description || 'Tienes un recordatorio pendiente',
              data: { reminderId: reminder.id },
            },
            trigger: {
              seconds: Math.floor(trigger / 1000),
            },
          });
        }
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  const toggleComplete = async (reminder: Reminder) => {
    try {
      const response = await api.put(`/api/reminders/${reminder.id}`, { is_completed: !reminder.is_completed });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  const deleteReminder = (reminder: Reminder) => {
    if (Platform.OS === 'web') {
      try {
        const confirmed = window.confirm(t('confirmDeleteReminder'));
        if (confirmed) {
          performDeleteReminder(reminder.id);
        }
      } catch (e) {
        performDeleteReminder(reminder.id);
      }
    } else {
      Alert.alert(
        t('deleteReminder'),
        t('confirmDeleteReminder'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => performDeleteReminder(reminder.id),
          },
        ]
      );
    }
  };

  const performDeleteReminder = async (reminderId: string) => {
    try {
      const response = await api.delete(`/api/reminders/${reminderId}`);
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const getEntityName = (reminder: Reminder) => {
    if (!reminder.entity_id) return null;
    
    if (reminder.entity_type === 'horse') {
      const horse = horses.find(h => h.id === reminder.entity_id);
      return horse?.name;
    } else {
      const rider = riders.find(r => r.id === reminder.entity_id);
      return rider?.name;
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = new Date(dateStr);
    reminderDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil((reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const entities = entityType === 'horse' ? horses : riders;

  const renderReminderItem = ({ item }: { item: Reminder }) => {
    const daysUntil = getDaysUntil(item.reminder_date);
    const entityName = getEntityName(item);
    const isOverdue = daysUntil < 0 && !item.is_completed;
    const isToday = daysUntil === 0;
    
    return (
      <View style={[
        styles.reminderCard,
        item.is_completed && styles.reminderCardCompleted,
        isOverdue && styles.reminderCardOverdue,
      ]}>
        <TouchableOpacity
          style={styles.reminderCardContent}
          onPress={() => openEditModal(item)}
        >
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleComplete(item)}
          >
            <View style={[styles.checkbox, item.is_completed && styles.checkboxChecked]}>
              {item.is_completed && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
          </TouchableOpacity>
          
          <View style={styles.reminderContent}>
            <View style={styles.reminderHeader}>
              <Text style={[styles.reminderTitle, item.is_completed && styles.textCompleted]}>
                {item.title}
              </Text>
              {item.is_automatic && (
                <View style={styles.autoBadge}>
                  <Text style={styles.autoBadgeText}>Auto</Text>
                </View>
              )}
            </View>
            
            {item.description && (
              <Text style={[styles.reminderDescription, item.is_completed && styles.textCompleted]}>
                {item.description}
              </Text>
            )}
            
            <View style={styles.reminderMeta}>
              <View style={styles.dateContainer}>
                <Ionicons 
                  name="calendar" 
                  size={14} 
                  color={isOverdue ? '#F44336' : isToday ? '#FF9800' : '#666'} 
                />
                <Text style={[
                  styles.reminderDate,
                  isOverdue && styles.textOverdue,
                  isToday && styles.textToday,
                ]}>
                  {item.reminder_date} {item.reminder_time}
                </Text>
              </View>
              
              {entityName && (
                <View style={styles.entityContainer}>
                  <Ionicons 
                    name={item.entity_type === 'horse' ? 'paw' : 'person'} 
                    size={14} 
                    color="#666" 
                  />
                  <Text style={styles.entityName}>{entityName}</Text>
                </View>
              )}
            </View>
            
            {!item.is_completed && (
              <Text style={[
                styles.daysUntil,
                isOverdue && styles.textOverdue,
                isToday && styles.textToday,
              ]}>
                {isOverdue 
                  ? `${t('daysAgo', { count: Math.abs(daysUntil) })}` 
                  : isToday 
                    ? t('today') 
                    : daysUntil === 1 
                      ? t('tomorrow') 
                      : t('inDays', { count: daysUntil })}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteReminder(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
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
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterTabText, filter === 'pending' && styles.filterTabTextActive]}>
            {t('pending')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'completed' && styles.filterTabActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterTabText, filter === 'completed' && styles.filterTabTextActive]}>
            {t('completed')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            {t('all')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reminders}
        renderItem={renderReminderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('noReminders')}</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'pending' 
                ? t('tapToAddReminder') 
                : filter === 'completed'
                  ? t('noCompletedReminders')
                  : t('noRemindersYet')}
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

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
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingReminder ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
            </Text>
            <TouchableOpacity onPress={saveReminder} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Vacunación anual"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Detalles adicionales..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Fecha *</Text>
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
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#2E7D32" />
                  <Text style={styles.datePickerText}>{formatDisplayDate(reminderDate)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </>
            )}

            <Text style={styles.label}>Hora *</Text>
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
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time" size={20} color="#2E7D32" />
                  <Text style={styles.datePickerText}>{formatDisplayTime(reminderTime)}</Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display="default"
                    is24Hour={true}
                    onChange={onTimeChange}
                  />
                )}
              </>
            )}

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeButton, entityType === 'horse' && styles.typeButtonActive]}
                onPress={() => {
                  setEntityType('horse');
                  setEntityId(null);
                }}
              >
                <Ionicons name="fitness" size={20} color={entityType === 'horse' ? '#fff' : '#666'} />
                <Text style={[styles.typeButtonText, entityType === 'horse' && styles.typeButtonTextActive]}>
                  Caballo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, entityType === 'rider' && styles.typeButtonActive]}
                onPress={() => {
                  setEntityType('rider');
                  setEntityId(null);
                }}
              >
                <Ionicons name="person" size={20} color={entityType === 'rider' ? '#fff' : '#666'} />
                <Text style={[styles.typeButtonText, entityType === 'rider' && styles.typeButtonTextActive]}>
                  Jinete
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{entityType === 'horse' ? 'Caballo' : 'Jinete'} (opcional)</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowEntitySelector(true)}
            >
              <Text style={entityId ? styles.selectorText : styles.selectorPlaceholder}>
                {entityId 
                  ? entities.find(e => e.id === entityId)?.name 
                  : `Sin ${entityType === 'horse' ? 'caballo' : 'jinete'} específico`}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

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
                Seleccionar {entityType === 'horse' ? 'Caballo' : 'Jinete'}
              </Text>
              <TouchableOpacity
                style={[styles.selectorItem, !entityId && styles.selectorItemSelected]}
                onPress={() => {
                  setEntityId(null);
                  setShowEntitySelector(false);
                }}
              >
                <Text style={styles.selectorItemText}>General (sin asignar)</Text>
                {!entityId && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
              </TouchableOpacity>
              <FlatList
                data={entities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.selectorItem,
                      entityId === item.id && styles.selectorItemSelected,
                    ]}
                    onPress={() => {
                      setEntityId(item.id);
                      setShowEntitySelector(false);
                    }}
                  >
                    <Text style={styles.selectorItemText}>{item.name}</Text>
                    {entityId === item.id && (
                      <Ionicons name="checkmark" size={20} color="#2E7D32" />
                    )}
                  </TouchableOpacity>
                )}
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
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#2E7D32',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 80,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  reminderCardContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
  },
  deleteButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
  },
  reminderCardCompleted: {
    opacity: 0.7,
    backgroundColor: '#f8f8f8',
  },
  reminderCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  reminderContent: {
    flex: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  autoBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  autoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  reminderDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  reminderMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reminderDate: {
    fontSize: 12,
    color: '#666',
  },
  entityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entityName: {
    fontSize: 12,
    color: '#666',
  },
  daysUntil: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
  },
  textCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  textOverdue: {
    color: '#F44336',
  },
  textToday: {
    color: '#FF9800',
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
    textAlign: 'center',
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  datePickerButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
});
