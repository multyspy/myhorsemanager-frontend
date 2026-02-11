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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

interface Document {
  name: string;
  data: string;
  uploaded_at?: string;
}

interface Rider {
  id: string;
  name: string;
  photo?: string;
  birth_date?: string;
  phone?: string;
  email?: string;
  notes?: string;
  territorial_license?: string;
  national_license?: string;
  documents?: Document[];
  created_at: string;
  updated_at: string;
}

interface Horse {
  id: string;
  name: string;
}

export default function RidersScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [horsesModalVisible, setHorsesModalVisible] = useState(false);
  const [selectedRiderForHorses, setSelectedRiderForHorses] = useState<Rider | null>(null);
  const [riderHorses, setRiderHorses] = useState<Horse[]>([]);
  
  // Form state
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [territorialLicense, setTerritorialLicense] = useState('');
  const [nationalLicense, setNationalLicense] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Date picker state
  const [selectedBirthDate, setSelectedBirthDate] = useState(new Date());
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  
  // Photo/Document viewer state
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingPhotoTitle, setViewingPhotoTitle] = useState<string>('');

  const fetchData = async () => {
    try {
      const [ridersRes, horsesRes] = await Promise.all([
        api.get('/api/riders'),
        api.get('/api/horses')
      ]);
      
      if (ridersRes.ok) {
        const data = await ridersRes.json();
        setRiders(data);
      }
      if (horsesRes.ok) {
        const data = await horsesRes.json();
        setHorses(data);
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
  }, [authLoading, token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const resetForm = () => {
    setName('');
    setPhoto(null);
    setBirthDate('');
    setSelectedBirthDate(new Date());
    setPhone('');
    setEmail('');
    setNotes('');
    setTerritorialLicense('');
    setNationalLicense('');
    setDocuments([]);
    setEditingRider(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (rider: Rider) => {
    setEditingRider(rider);
    setName(rider.name);
    setPhoto(rider.photo || null);
    setBirthDate(rider.birth_date || '');
    if (rider.birth_date) {
      const [year, month, day] = rider.birth_date.split('-').map(Number);
      setSelectedBirthDate(new Date(year, month - 1, day));
    }
    setPhone(rider.phone || '');
    setEmail(rider.email || '');
    setNotes(rider.notes || '');
    setTerritorialLicense(rider.territorial_license || '');
    setNationalLicense(rider.national_license || '');
    setDocuments(rider.documents || []);
    setModalVisible(true);
  };

  const onBirthDateChange = (event: any, date?: Date) => {
    setShowBirthDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedBirthDate(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setBirthDate(`${year}-${month}-${day}`);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return t('select');
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const openHorsesModal = async (rider: Rider) => {
    setSelectedRiderForHorses(rider);
    try {
      const response = await api.get(`/api/riders/${rider.id}/horses`);
      if (response.ok) {
        const data = await response.json();
        setRiderHorses(data);
      }
    } catch (error) {
      console.error('Error fetching rider horses:', error);
    }
    setHorsesModalVisible(true);
  };

  const toggleHorseAssociation = async (horseId: string) => {
    if (!selectedRiderForHorses) return;
    
    const isAssociated = riderHorses.some(h => h.id === horseId);
    
    try {
      if (isAssociated) {
        await api.delete(`/api/associations?horse_id=${horseId}&rider_id=${selectedRiderForHorses.id}`);
        setRiderHorses(riderHorses.filter(h => h.id !== horseId));
      } else {
        await api.post('/api/associations', { horse_id: horseId, rider_id: selectedRiderForHorses.id });
        const horse = horses.find(h => h.id === horseId);
        if (horse) {
          setRiderHorses([...riderHorses, horse]);
        }
      }
    } catch (error) {
      console.error('Error toggling association:', error);
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), t('permissionsRequired'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.uri) {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const newDoc: Document = {
            name: asset.name || 'documento.pdf',
            data: `data:application/pdf;base64,${base64}`,
            uploaded_at: new Date().toISOString(),
          };
          
          setDocuments([...documents, newDoc]);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const removeDocument = (index: number) => {
    const newDocs = documents.filter((_, i) => i !== index);
    setDocuments(newDocs);
  };

  // Function to view photo in full screen
  const viewPhoto = (photoUri: string, title: string) => {
    setViewingPhoto(photoUri);
    setViewingPhotoTitle(title);
    setPhotoViewerVisible(true);
  };

  // Function to view/download document
  const viewDocument = async (doc: Document) => {
    try {
      if (Platform.OS === 'web') {
        // For web: Create a blob and open/download
        const base64Data = doc.data.split(',')[1] || doc.data;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Open in new tab
        window.open(url, '_blank');
      } else {
        // For mobile: Use expo-file-system to save and share
        try {
          const base64Data = doc.data.split(',')[1] || doc.data;
          const fileUri = `${FileSystem.cacheDirectory}${doc.name}`;
          
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: 'base64',
          });
          
          Alert.alert(
            t('documentSaved'),
            `${t('documentSavedAt')}: ${doc.name}`,
            [{ text: 'OK' }]
          );
        } catch (fsError) {
          console.error('FileSystem error:', fsError);
          Alert.alert(
            t('openDocument'),
            doc.name,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      Alert.alert(t('error'), t('cannotOpenDocument'));
    }
  };

  const saveRider = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const riderData = {
        name: name.trim(),
        photo: photo,
        birth_date: birthDate.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        territorial_license: territorialLicense.trim() || null,
        national_license: nationalLicense.trim() || null,
        documents: documents,
      };

      let response;
      if (editingRider) {
        response = await api.put(`/api/riders/${editingRider.id}`, riderData);
      } else {
        response = await api.post('/api/riders', riderData);
      }

      if (response.ok) {
        setModalVisible(false);
        resetForm();
        fetchData();
      } else {
        Alert.alert(t('error'), t('connectionError'));
      }
    } catch (error) {
      console.error('Error saving rider:', error);
      Alert.alert(t('error'), t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteRider = (rider: Rider) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${t('confirmDelete')} ${rider.name}?`);
      if (confirmed) {
        performDeleteRider(rider.id);
      }
    } else {
      Alert.alert(
        t('delete'),
        `${t('confirmDelete')} ${rider.name}?`,
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => performDeleteRider(rider.id),
          },
        ]
      );
    }
  };

  const performDeleteRider = async (riderId: string) => {
    try {
      const response = await api.delete(`/api/riders/${riderId}`);
      if (response.ok) {
        fetchData();
      } else {
        Alert.alert(t('error'), t('connectionError'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const renderRiderItem = ({ item }: { item: Rider }) => (
    <View style={styles.riderCard}>
      <TouchableOpacity
        style={styles.riderCardContent}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.riderPhotoContainer}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.riderPhoto} />
          ) : (
            <View style={styles.riderPhotoPlaceholder}>
              <Ionicons name="person" size={32} color="#aaa" />
            </View>
          )}
        </View>
        <View style={styles.riderInfo}>
          <Text style={styles.riderName}>{item.name}</Text>
          {item.phone && <Text style={styles.riderDetail}>{item.phone}</Text>}
          {item.email && <Text style={styles.riderDetail}>{item.email}</Text>}
          <View style={styles.licenseBadges}>
            {item.territorial_license && (
              <View style={styles.licenseBadge}>
                <Text style={styles.licenseBadgeText}>LT</Text>
              </View>
            )}
            {item.national_license && (
              <View style={[styles.licenseBadge, styles.nationalBadge]}>
                <Text style={styles.licenseBadgeText}>LN</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.horsesButton}
          onPress={() => openHorsesModal(item)}
        >
          <Ionicons name="fitness" size={20} color="#2E7D32" />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteRider(item)}
      >
        <Ionicons name="trash-outline" size={22} color="#F44336" />
      </TouchableOpacity>
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
      <FlatList
        data={riders}
        renderItem={renderRiderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="person-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('noRiders')}</Text>
            <Text style={styles.emptySubtext}>{t('addFirstRider')}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Edit/Add Modal */}
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
              {editingRider ? t('editRider') : t('newRider')}
            </Text>
            <TouchableOpacity onPress={saveRider} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? t('saving') : t('save')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <View style={styles.photoPickerWrapper}>
              <TouchableOpacity style={styles.photoPickerContainer} onPress={pickImage}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photoPicker} />
                ) : (
                  <View style={styles.photoPickerPlaceholder}>
                    <Ionicons name="camera" size={40} color="#666" />
                    <Text style={styles.photoPickerText}>{t('addPhoto')}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {photo && (
                <View style={styles.photoActions}>
                  <TouchableOpacity 
                    style={styles.photoActionButton}
                    onPress={() => viewPhoto(photo, editingRider?.name || t('photo'))}
                  >
                    <Ionicons name="expand-outline" size={20} color="#2E7D32" />
                    <Text style={styles.photoActionText}>{t('viewFull')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.photoActionButton}
                    onPress={pickImage}
                  >
                    <Ionicons name="camera-outline" size={20} color="#666" />
                    <Text style={styles.photoActionText}>{t('change')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={styles.sectionHeader}>{t('basicInfo')}</Text>

            <Text style={styles.label}>{t('name')} *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('riderName')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('birthDate')}</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={birthDate}
                onChange={(e: any) => setBirthDate(e.target.value)}
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
                  onPress={() => setShowBirthDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#2E7D32" />
                  <Text style={styles.datePickerText}>{formatDisplayDate(birthDate)}</Text>
                </TouchableOpacity>
                {showBirthDatePicker && (
                  <DateTimePicker
                    value={selectedBirthDate}
                    mode="date"
                    display="default"
                    onChange={onBirthDateChange}
                    maximumDate={new Date()}
                  />
                )}
              </>
            )}

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
              placeholder="email@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.sectionHeader}>{t('federativeLicenses')}</Text>

            <Text style={styles.label}>{t('territorialLicense')}</Text>
            <TextInput
              style={styles.input}
              value={territorialLicense}
              onChangeText={setTerritorialLicense}
              placeholder={t('territorialLicensePlaceholder')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('nationalLicense')}</Text>
            <TextInput
              style={styles.input}
              value={nationalLicense}
              onChangeText={setNationalLicense}
              placeholder={t('nationalLicensePlaceholder')}
              placeholderTextColor="#999"
            />

            <Text style={styles.sectionHeader}>{t('notes')}</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('notesPlaceholder')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.sectionHeader}>{t('pdfDocuments')}</Text>
            
            <TouchableOpacity style={styles.addDocButton} onPress={pickDocument}>
              <Ionicons name="document-attach" size={20} color="#2E7D32" />
              <Text style={styles.addDocButtonText}>{t('addPdfDocument')}</Text>
            </TouchableOpacity>

            {documents.length > 0 && (
              <View style={styles.documentsContainer}>
                {documents.map((doc, index) => (
                  <View key={index} style={styles.documentItem}>
                    <TouchableOpacity 
                      style={styles.documentTouchable}
                      onPress={() => viewDocument(doc)}
                    >
                      <Ionicons name="document-text" size={20} color="#E53935" />
                      <Text style={styles.documentName} numberOfLines={1}>{doc.name}</Text>
                      <Ionicons name="eye-outline" size={18} color="#2E7D32" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.removeDocButton}
                      onPress={() => removeDocument(index)}
                    >
                      <Ionicons name="close-circle" size={22} color="#999" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* Horses Association Modal */}
      <Modal
        visible={horsesModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setHorsesModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.selectorOverlay}
          activeOpacity={1}
          onPress={() => setHorsesModalVisible(false)}
        >
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>
              {t('associatedHorses')} - {selectedRiderForHorses?.name}
            </Text>
            <Text style={styles.selectorSubtitle}>
              {t('tapToAssociate')}
            </Text>
            {horses.length === 0 ? (
              <Text style={styles.noHorsesText}>{t('noHorses')}</Text>
            ) : (
              <FlatList
                data={horses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isAssociated = riderHorses.some(h => h.id === item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.selectorItem,
                        isAssociated && styles.selectorItemSelected,
                      ]}
                      onPress={() => toggleHorseAssociation(item.id)}
                    >
                      <View style={styles.horseItemContent}>
                        <Ionicons 
                          name="fitness" 
                          size={20} 
                          color={isAssociated ? '#2E7D32' : '#999'} 
                        />
                        <Text style={styles.selectorItemText}>{item.name}</Text>
                      </View>
                      {isAssociated && (
                        <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </TouchableOpacity>
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
  riderCard: {
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
  riderCardContent: {
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
  riderPhotoContainer: {
    marginRight: 16,
  },
  riderPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  riderPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  riderDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  licenseBadges: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  licenseBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nationalBadge: {
    backgroundColor: '#FF9800',
  },
  licenseBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  horsesButton: {
    padding: 10,
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
  photoPickerContainer: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  photoPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPickerPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPickerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
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
    height: 100,
    textAlignVertical: 'top',
  },
  addDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2E7D32',
    borderStyle: 'dashed',
    gap: 10,
  },
  addDocButtonText: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '500',
  },
  documentsContainer: {
    marginTop: 12,
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 10,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  removeDocButton: {
    padding: 2,
  },
  documentTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoPickerWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  photoActionText: {
    fontSize: 14,
    color: '#333',
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
    width: '85%',
    maxHeight: '70%',
    padding: 16,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  selectorSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  noHorsesText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
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
    marginLeft: 12,
  },
  horseItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
