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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
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

interface Horse {
  id: string;
  name: string;
  breed?: string;
  birth_date?: string;
  color?: string;
  notes?: string;
  photo?: string;
  stabling_location?: string;
  territorial_license?: string;
  national_license?: string;
  owner?: string;
  documents?: Document[];
  created_at: string;
  updated_at: string;
}

export default function HorsesScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [stablingLocation, setStablingLocation] = useState('');
  const [territorialLicense, setTerritorialLicense] = useState('');
  const [nationalLicense, setNationalLicense] = useState('');
  const [owner, setOwner] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Date picker state
  const [selectedBirthDate, setSelectedBirthDate] = useState(new Date());
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  
  // Photo/Document viewer state
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingPhotoTitle, setViewingPhotoTitle] = useState<string>('');

  const fetchHorses = async () => {
    try {
      console.log('Fetching horses... Token available:', !!token);
      const response = await api.get('/api/horses');
      console.log('Horses response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Horses loaded:', data.length);
        setHorses(data);
      } else {
        console.log('Failed to load horses:', response.status);
      }
    } catch (error) {
      console.error('Error fetching horses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Only fetch horses when auth is loaded and we have a token
    if (!authLoading && token) {
      fetchHorses();
    } else if (!authLoading && !token) {
      setLoading(false);
    }
  }, [authLoading, token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHorses();
  }, [token]);

  const resetForm = () => {
    setName('');
    setBreed('');
    setBirthDate('');
    setColor('');
    setNotes('');
    setPhoto(null);
    setStablingLocation('');
    setTerritorialLicense('');
    setNationalLicense('');
    setOwner('');
    setDocuments([]);
    setEditingHorse(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (horse: Horse) => {
    setEditingHorse(horse);
    setName(horse.name);
    setBreed(horse.breed || '');
    setBirthDate(horse.birth_date || '');
    if (horse.birth_date) {
      const [year, month, day] = horse.birth_date.split('-').map(Number);
      setSelectedBirthDate(new Date(year, month - 1, day));
    }
    setColor(horse.color || '');
    setNotes(horse.notes || '');
    setPhoto(horse.photo || null);
    setStablingLocation(horse.stabling_location || '');
    setTerritorialLicense(horse.territorial_license || '');
    setNationalLicense(horse.national_license || '');
    setOwner(horse.owner || '');
    setDocuments(horse.documents || []);
    setModalVisible(true);
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

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Read file and convert to base64
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
          
          // Use Linking to try to open the file
          // On iOS/Android, this may open a share dialog or document viewer
          if (await Linking.canOpenURL(fileUri)) {
            await Linking.openURL(fileUri);
          } else {
            // Fallback: Show alert with file location
            Alert.alert(
              t('documentSaved'),
              `${t('documentSavedAt')}: ${doc.name}`,
              [{ text: 'OK' }]
            );
          }
        } catch (fsError) {
          console.error('FileSystem error:', fsError);
          // Fallback for mobile: Just show the document name
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

  const saveHorse = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const horseData = {
        name: name.trim(),
        breed: breed.trim() || null,
        birth_date: birthDate.trim() || null,
        color: color.trim() || null,
        notes: notes.trim() || null,
        photo: photo,
        stabling_location: stablingLocation.trim() || null,
        territorial_license: territorialLicense.trim() || null,
        national_license: nationalLicense.trim() || null,
        owner: owner.trim() || null,
        documents: documents,
      };

      let response;
      if (editingHorse) {
        response = await api.put(`/api/horses/${editingHorse.id}`, horseData);
      } else {
        response = await api.post('/api/horses', horseData);
      }

      if (response.ok) {
        setModalVisible(false);
        resetForm();
        fetchHorses();
      } else {
        Alert.alert(t('error'), t('connectionError'));
      }
    } catch (error) {
      console.error('Error saving horse:', error);
      Alert.alert(t('error'), t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteHorse = (horse: Horse) => {
    Alert.alert(
      t('confirmDelete'),
      `${t('confirmDelete')} ${horse.name}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => performDeleteHorse(horse.id),
        },
      ]
    );
  };

  const performDeleteHorse = async (horseId: string) => {
    try {
      console.log('Attempting to delete horse:', horseId);
      const response = await api.delete(`/api/horses/${horseId}`);
      console.log('Delete response status:', response.status);
      if (response.ok) {
        console.log('Horse deleted successfully');
        fetchHorses();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('Delete failed:', errorData);
        Alert.alert(t('error'), errorData.detail || t('connectionError'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const renderHorseItem = ({ item }: { item: Horse }) => (
    <View style={styles.horseCard}>
      <TouchableOpacity
        style={styles.horseCardContent}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.horsePhotoContainer}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.horsePhoto} />
          ) : (
            <View style={styles.horsePhotoPlaceholder}>
              <FontAwesome5 name="horse-head" size={28} color="#aaa" />
            </View>
          )}
        </View>
        <View style={styles.horseInfo}>
          <Text style={styles.horseName}>{item.name}</Text>
          {item.breed && <Text style={styles.horseDetail}>{t('breed')}: {item.breed}</Text>}
          {item.owner && <Text style={styles.horseDetail}>{t('owner')}: {item.owner}</Text>}
          {item.stabling_location && <Text style={styles.horseDetail}>{t('stablingLocation')}: {item.stabling_location}</Text>}
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
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteHorse(item)}
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
        data={horses}
        renderItem={renderHorseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="horse-head" size={56} color="#ccc" />
            <Text style={styles.emptyText}>{t('noHorses')}</Text>
            <Text style={styles.emptySubtext}>{t('addFirstHorse')}</Text>
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
              <Text style={styles.modalCancel}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingHorse ? t('editHorse') : t('newHorse')}
            </Text>
            <TouchableOpacity onPress={saveHorse} disabled={saving}>
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
                    onPress={() => viewPhoto(photo, editingHorse?.name || t('photo'))}
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
              placeholder={t('horseName')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('breed')}</Text>
            <TextInput
              style={styles.input}
              value={breed}
              onChangeText={setBreed}
              placeholder={t('breed')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('color')}</Text>
            <TextInput
              style={styles.input}
              value={color}
              onChangeText={setColor}
              placeholder={t('color')}
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

            <Text style={styles.label}>{t('stablingLocation')}</Text>
            <TextInput
              style={styles.input}
              value={stablingLocation}
              onChangeText={setStablingLocation}
              placeholder={t('stablingLocationPlaceholder')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t('owner')}</Text>
            <TextInput
              style={styles.input}
              value={owner}
              onChangeText={setOwner}
              placeholder={t('ownerPlaceholder')}
              placeholderTextColor="#999"
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
  horseCard: {
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
  horseCardContent: {
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
  horsePhotoContainer: {
    marginRight: 16,
  },
  horsePhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  horsePhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  horseInfo: {
    flex: 1,
  },
  horseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  horseDetail: {
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
});
