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
import { api } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';


interface Palmares {
  id: string;
  rider_id: string;
  competition_name: string;
  date: string;
  place?: string;
  city?: string;
  country: string;
  location_link?: string;
  discipline: string;
  custom_discipline?: string;
  position?: string;
  horse_id?: string;
  category?: string;
  notes?: string;
  prize?: string;
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
  'salto', 'doma_clasica', 'doma_vaquera', 'concurso_completo',
  'raid', 'enganche', 'reining', 'volteo', 'horseball', 'polo', 'otros'
];

const DISCIPLINE_NAMES: Record<string, string> = {
  salto: 'Salto',
  doma_clasica: 'Doma Clásica',
  doma_vaquera: 'Doma Vaquera',
  concurso_completo: 'Concurso Completo',
  raid: 'Raid',
  enganche: 'Enganche',
  reining: 'Reining',
  volteo: 'Volteo',
  horseball: 'Horseball',
  polo: 'Polo',
  otros: 'Otros'
};

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

const POSITIONS = [
  { value: '1', label: 'gold', icon: 'medal', color: '#FFD700' },
  { value: '2', label: 'silver', icon: 'medal', color: '#C0C0C0' },
  { value: '3', label: 'bronze', icon: 'medal', color: '#CD7F32' },
  { value: '4', label: 'fourth', icon: 'ribbon', color: '#4CAF50' },
  { value: '5', label: 'fifth', icon: 'ribbon', color: '#2196F3' },
  { value: 'clasificado', label: 'classified', icon: 'checkmark-circle', color: '#9C27B0' },
  { value: 'participante', label: 'participant', icon: 'star', color: '#607D8B' },
];

export default function PalmaresScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [palmaresList, setPalmaresList] = useState<Palmares[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPalmares, setEditingPalmares] = useState<Palmares | null>(null);
  const [filterRiderId, setFilterRiderId] = useState<string | null>(null);
  const [filterHorseId, setFilterHorseId] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'palmares' | 'premios'>('palmares');
  
  // Form state
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [competitionName, setCompetitionName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [place, setPlace] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('España');
  const [locationLink, setLocationLink] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [customDiscipline, setCustomDiscipline] = useState('');
  const [position, setPosition] = useState('');
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [prize, setPrize] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [showRiderSelector, setShowRiderSelector] = useState(false);
  const [showHorseSelector, setShowHorseSelector] = useState(false);
  const [showDisciplineSelector, setShowDisciplineSelector] = useState(false);
  const [showPositionSelector, setShowPositionSelector] = useState(false);

  // Calculate prizes summary
  const getPrizesSummary = () => {
    const palmaresWithPrizes = palmaresList.filter(p => p.prize && parseFloat(p.prize) > 0);
    const totalPrizes = palmaresWithPrizes.reduce((sum, p) => sum + (parseFloat(p.prize || '0')), 0);
    
    // Group by rider
    const byRider: { [key: string]: { name: string; total: number; count: number; prizes: Palmares[] } } = {};
    palmaresWithPrizes.forEach(p => {
      const rider = riders.find(r => r.id === p.rider_id);
      const riderName = rider?.name || 'Sin jinete';
      if (!byRider[p.rider_id]) {
        byRider[p.rider_id] = { name: riderName, total: 0, count: 0, prizes: [] };
      }
      byRider[p.rider_id].total += parseFloat(p.prize || '0');
      byRider[p.rider_id].count += 1;
      byRider[p.rider_id].prizes.push(p);
    });

    // Group by horse
    const byHorse: { [key: string]: { name: string; total: number; count: number; prizes: Palmares[] } } = {};
    palmaresWithPrizes.forEach(p => {
      if (p.horse_id) {
        const horse = horses.find(h => h.id === p.horse_id);
        const horseName = horse?.name || 'Sin caballo';
        if (!byHorse[p.horse_id]) {
          byHorse[p.horse_id] = { name: horseName, total: 0, count: 0, prizes: [] };
        }
        byHorse[p.horse_id].total += parseFloat(p.prize || '0');
        byHorse[p.horse_id].count += 1;
        byHorse[p.horse_id].prizes.push(p);
      }
    });

    return { totalPrizes, byRider, byHorse, palmaresWithPrizes };
  };

  const fetchData = async () => {
    try {
      let url = '/api/palmares';
      const params = new URLSearchParams();
      if (filterRiderId) params.append('rider_id', filterRiderId);
      if (params.toString()) url += `?${params.toString()}`;

      const [palmaresRes, horsesRes, ridersRes] = await Promise.all([
        api.get(url),
        api.get('/api/horses'),
        api.get('/api/riders')
      ]);

      if (palmaresRes.ok) {
        let data = await palmaresRes.json();
        if (filterHorseId) {
          data = data.filter((p: Palmares) => p.horse_id === filterHorseId);
        }
        setPalmaresList(data);
      }
      if (horsesRes.ok) setHorses(await horsesRes.json());
      if (ridersRes.ok) setRiders(await ridersRes.json());
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
  }, [authLoading, token, filterRiderId, filterHorseId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [filterRiderId, filterHorseId]);

  const resetForm = () => {
    setSelectedRiderId('');
    setCompetitionName('');
    setDate(new Date());
    setPlace('');
    setCity('');
    setCountry('España');
    setLocationLink('');
    setDiscipline('');
    setCustomDiscipline('');
    setPosition('');
    setSelectedHorseId(null);
    setCategory('');
    setNotes('');
    setPrize('');
    setEditingPalmares(null);
  };

  const openAddModal = () => {
    resetForm();
    if (filterRiderId) setSelectedRiderId(filterRiderId);
    if (filterHorseId) setSelectedHorseId(filterHorseId);
    setModalVisible(true);
  };

  const openEditModal = (palmares: Palmares) => {
    setEditingPalmares(palmares);
    setSelectedRiderId(palmares.rider_id);
    setCompetitionName(palmares.competition_name);
    setDate(new Date(palmares.date));
    setPlace(palmares.place || '');
    setCity(palmares.city || '');
    setCountry(palmares.country || 'España');
    setLocationLink(palmares.location_link || '');
    setDiscipline(palmares.discipline);
    setCustomDiscipline(palmares.custom_discipline || '');
    setPosition(palmares.position || '');
    setSelectedHorseId(palmares.horse_id || null);
    setCategory(palmares.category || '');
    setNotes(palmares.notes || '');
    setPrize(palmares.prize || '');
    setModalVisible(true);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const formatDateString = (d: Date) => d.toISOString().split('T')[0];

  const savePalmares = async () => {
    if (!selectedRiderId) {
      Alert.alert(t('error'), t('selectRider'));
      return;
    }
    if (!competitionName.trim()) {
      Alert.alert(t('error'), t('competitionNameRequired'));
      return;
    }
    if (!discipline) {
      Alert.alert(t('error'), t('disciplineRequired'));
      return;
    }

    setSaving(true);
    try {
      const palmaresData = {
        rider_id: selectedRiderId,
        competition_name: competitionName.trim(),
        date: formatDateString(date),
        place: place.trim() || null,
        city: city.trim() || null,
        country: country.trim() || 'España',
        location_link: locationLink.trim() || null,
        discipline,
        custom_discipline: discipline === 'otros' ? customDiscipline.trim() : null,
        position: position || null,
        horse_id: selectedHorseId,
        category: category.trim() || null,
        notes: notes.trim() || null,
        prize: prize.trim() || null,
      };

      let response;
      if (editingPalmares) {
        response = await api.put(`/api/palmares/${editingPalmares.id}`, palmaresData);
      } else {
        response = await api.post('/api/palmares', palmaresData);
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

  const deletePalmares = (palmares: Palmares) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('confirmDeleteAchievement'));
      if (confirmed) {
        performDeletePalmares(palmares.id);
      }
    } else {
      Alert.alert(
        t('deleteAchievement'),
        t('confirmDeleteAchievement'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => performDeletePalmares(palmares.id),
          },
        ]
      );
    }
  };

  const performDeletePalmares = async (palmaresId: string) => {
    try {
      const response = await api.delete(`/api/palmares/${palmaresId}`);
      if (response.ok) fetchData();
    } catch (error) {
      Alert.alert(t('error'), t('connectionError'));
    }
  };

  const getRiderName = (riderId: string) => {
    const rider = riders.find(r => r.id === riderId);
    return rider?.name || t('unknown');
  };

  const getHorseName = (horseId?: string) => {
    if (!horseId) return null;
    const horse = horses.find(h => h.id === horseId);
    return horse?.name;
  };

  const getPositionInfo = (pos?: string) => {
    const posItem = POSITIONS.find(p => p.value === pos);
    if (posItem) {
      return { ...posItem, label: t(posItem.label) };
    }
    return null;
  };

  const getDisciplineName = (disc: string) => {
    const disciplineKeys: Record<string, string> = {
      salto: 'showJumping',
      doma_clasica: 'dressage',
      doma_vaquera: 'vaquera',
      concurso_completo: 'completeRiding',
      raid: 'endurance',
      enganche: 'driving',
      reining: 'reining',
      volteo: 'vaulting',
      horseball: 'horseball',
      polo: 'polo',
      otros: 'otherDiscipline',
    };
    return t(disciplineKeys[disc] || 'otherDiscipline');
  };

  const clearFilters = () => {
    setFilterRiderId(null);
    setFilterHorseId(null);
    setShowFilterModal(false);
  };

  const renderPalmaresItem = ({ item }: { item: Palmares }) => {
    const positionInfo = getPositionInfo(item.position);
    const horseName = getHorseName(item.horse_id);

    return (
      <View style={styles.palmaresCard}>
        <TouchableOpacity
          style={styles.palmaresContent}
          onPress={() => openEditModal(item)}
        >
          <View style={[styles.disciplineBadge, { backgroundColor: DISCIPLINE_COLORS[item.discipline] || '#999' }]}>
            {positionInfo ? (
              <Ionicons name={positionInfo.icon as any} size={24} color={positionInfo.color} />
            ) : (
              <Ionicons name="trophy" size={24} color="#fff" />
            )}
          </View>
          <View style={styles.palmaresInfo}>
            <Text style={styles.palmaresName}>{item.competition_name}</Text>
            <Text style={styles.palmaresDiscipline}>
              {item.discipline === 'otros' && item.custom_discipline 
                ? item.custom_discipline 
                : DISCIPLINE_NAMES[item.discipline]}
              {item.category && ` - ${item.category}`}
            </Text>
            <View style={styles.palmaresMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar" size={12} color="#666" />
                <Text style={styles.metaText}>{item.date}</Text>
              </View>
              {item.city && (
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={12} color="#666" />
                  <Text style={styles.metaText}>{item.city}</Text>
                </View>
              )}
            </View>
            <View style={styles.palmaresParticipants}>
              <View style={styles.participant}>
                <Ionicons name="person" size={12} color="#2196F3" />
                <Text style={styles.participantText}>{getRiderName(item.rider_id)}</Text>
              </View>
              {horseName && (
                <View style={styles.participant}>
                  <Ionicons name="fitness" size={12} color="#4CAF50" />
                  <Text style={styles.participantText}>{horseName}</Text>
                </View>
              )}
            </View>
            {positionInfo && (
              <View style={[styles.positionBadge, { backgroundColor: positionInfo.color + '20' }]}>
                <Text style={[styles.positionText, { color: positionInfo.color }]}>
                  {positionInfo.label}
                </Text>
              </View>
            )}
            {item.prize && (
              <Text style={styles.prizeText}>{t('prize')}: {item.prize}</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deletePalmares(item)}
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

  const hasRidersOrHorses = riders.length > 0 || horses.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'palmares' && styles.tabActive]}
          onPress={() => setActiveTab('palmares')}
        >
          <Ionicons name="trophy" size={20} color={activeTab === 'palmares' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'palmares' && styles.tabTextActive]}>{t('palmares')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'premios' && styles.tabActive]}
          onPress={() => setActiveTab('premios')}
        >
          <Ionicons name="cash" size={20} color={activeTab === 'premios' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'premios' && styles.tabTextActive]}>{t('prizes')}</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'palmares' ? (
        <>
          {/* Filter Bar */}
          <TouchableOpacity
            style={styles.filterBar}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={18} color="#666" />
            <Text style={styles.filterBarText}>
              {filterRiderId || filterHorseId 
                ? `${t('filteredBy')}: ${filterRiderId ? getRiderName(filterRiderId) : ''} ${filterHorseId ? getHorseName(filterHorseId) : ''}`
                : t('allAchievements')}
            </Text>
            {(filterRiderId || filterHorseId) && (
              <TouchableOpacity onPress={clearFilters}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {!hasRidersOrHorses ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>{t('firstRegisterRidersOrHorses')}</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={palmaresList}
                renderItem={renderPalmaresItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="trophy-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>{t('noAchievements')}</Text>
                    <Text style={styles.emptySubtext}>{t('addFirstAchievement')}</Text>
                  </View>
                }
              />

              <TouchableOpacity style={styles.fab} onPress={openAddModal}>
                <Ionicons name="add" size={28} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </>
      ) : (
        /* Premios Tab */
        <ScrollView 
          style={styles.premiosContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
          }
        >
          {(() => {
            const { totalPrizes, byRider, byHorse, palmaresWithPrizes } = getPrizesSummary();
            
            if (palmaresWithPrizes.length === 0) {
              return (
                <View style={styles.emptyContainer}>
                  <Ionicons name="wallet-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>{t('noPrizesRegistered')}</Text>
                  <Text style={styles.emptySubtext}>{t('addPrizesToAchievements')}</Text>
                </View>
              );
            }

            return (
              <>
                {/* Total Summary Card */}
                <View style={styles.totalPrizesCard}>
                  <View style={styles.totalPrizesHeader}>
                    <Ionicons name="trophy" size={32} color="#FFD700" />
                    <Text style={styles.totalPrizesLabel}>{t('totalPrizes')}</Text>
                  </View>
                  <Text style={styles.totalPrizesAmount}>{totalPrizes.toFixed(2)} €</Text>
                  <Text style={styles.totalPrizesCount}>{palmaresWithPrizes.length} {palmaresWithPrizes.length !== 1 ? t('prizes').toLowerCase() : t('prize').toLowerCase()}</Text>
                </View>

                {/* By Rider */}
                {Object.keys(byRider).length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>{t('byRider')}</Text>
                    {Object.entries(byRider).map(([riderId, data]) => (
                      <View key={riderId} style={styles.prizeCard}>
                        <View style={styles.prizeCardHeader}>
                          <Ionicons name="person" size={24} color="#2E7D32" />
                          <View style={styles.prizeCardInfo}>
                            <Text style={styles.prizeCardName}>{data.name}</Text>
                            <Text style={styles.prizeCardCount}>{data.count} {data.count !== 1 ? t('prizes').toLowerCase() : t('prize').toLowerCase()}</Text>
                          </View>
                          <Text style={styles.prizeCardAmount}>{data.total.toFixed(2)} €</Text>
                        </View>
                        {data.prizes.map((p, idx) => (
                          <View key={idx} style={styles.prizeDetail}>
                            <Text style={styles.prizeDetailCompetition}>{p.competition_name}</Text>
                            <Text style={styles.prizeDetailAmount}>{parseFloat(p.prize || '0').toFixed(2)} €</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                )}

                {/* By Horse */}
                {Object.keys(byHorse).length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>{t('byHorse')}</Text>
                    {Object.entries(byHorse).map(([horseId, data]) => (
                      <View key={horseId} style={styles.prizeCard}>
                        <View style={styles.prizeCardHeader}>
                          <Ionicons name="fitness" size={24} color="#8B4513" />
                          <View style={styles.prizeCardInfo}>
                            <Text style={styles.prizeCardName}>{data.name}</Text>
                            <Text style={styles.prizeCardCount}>{data.count} {data.count !== 1 ? t('prizes').toLowerCase() : t('prize').toLowerCase()}</Text>
                          </View>
                          <Text style={styles.prizeCardAmount}>{data.total.toFixed(2)} €</Text>
                        </View>
                        {data.prizes.map((p, idx) => (
                          <View key={idx} style={styles.prizeDetail}>
                            <Text style={styles.prizeDetailCompetition}>{p.competition_name}</Text>
                            <Text style={styles.prizeDetailAmount}>{parseFloat(p.prize || '0').toFixed(2)} €</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                )}

                {/* All Prizes List */}
                <Text style={styles.sectionTitle}>{t('prizeHistory')}</Text>
                {palmaresWithPrizes
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p, idx) => (
                    <View key={idx} style={styles.prizeHistoryItem}>
                      <View style={styles.prizeHistoryInfo}>
                        <Text style={styles.prizeHistoryCompetition}>{p.competition_name}</Text>
                        <Text style={styles.prizeHistoryDate}>
                          {new Date(p.date).toLocaleDateString('es-ES')} - {p.position || t('noPosition')}
                        </Text>
                        <Text style={styles.prizeHistoryRider}>
                          {getRiderName(p.rider_id)} {p.horse_id ? `/ ${getHorseName(p.horse_id)}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.prizeHistoryAmount}>{parseFloat(p.prize || '0').toFixed(2)} €</Text>
                    </View>
                  ))}
              </>
            );
          })()}
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.selectorOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterModal}>
            <Text style={styles.selectorTitle}>{t('filterAchievements')}</Text>
            
            <Text style={styles.filterLabel}>{t('byRider')}</Text>
            <ScrollView style={styles.filterList} horizontal={false}>
              <TouchableOpacity
                style={[styles.filterItem, !filterRiderId && styles.filterItemSelected]}
                onPress={() => setFilterRiderId(null)}
              >
                <Text style={styles.filterItemText}>{t('allRidersFilter')}</Text>
              </TouchableOpacity>
              {riders.map(rider => (
                <TouchableOpacity
                  key={rider.id}
                  style={[styles.filterItem, filterRiderId === rider.id && styles.filterItemSelected]}
                  onPress={() => setFilterRiderId(rider.id)}
                >
                  <Text style={styles.filterItemText}>{rider.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>{t('byHorse')}</Text>
            <ScrollView style={styles.filterList} horizontal={false}>
              <TouchableOpacity
                style={[styles.filterItem, !filterHorseId && styles.filterItemSelected]}
                onPress={() => setFilterHorseId(null)}
              >
                <Text style={styles.filterItemText}>{t('allHorsesFilter')}</Text>
              </TouchableOpacity>
              {horses.map(horse => (
                <TouchableOpacity
                  key={horse.id}
                  style={[styles.filterItem, filterHorseId === horse.id && styles.filterItemSelected]}
                  onPress={() => setFilterHorseId(horse.id)}
                >
                  <Text style={styles.filterItemText}>{horse.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.applyFilterButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.applyFilterText}>{t('applyFilters')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
              {editingPalmares ? t('editAchievement') : t('newAchievement')}
            </Text>
            <TouchableOpacity onPress={savePalmares} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? t('saving') : t('save')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <Text style={styles.sectionHeader}>{t('participants')}</Text>

            <Text style={styles.label}>{t('rider')} *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowRiderSelector(true)}
            >
              <Text style={selectedRiderId ? styles.selectorText : styles.selectorPlaceholder}>
                {selectedRiderId ? getRiderName(selectedRiderId) : t('selectRider')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <Text style={styles.label}>{t('horse')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowHorseSelector(true)}
            >
              <Text style={selectedHorseId ? styles.selectorText : styles.selectorPlaceholder}>
                {selectedHorseId ? getHorseName(selectedHorseId) : t('noSpecificHorse')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>{t('competition')}</Text>

            <Text style={styles.label}>{t('competitionName')} *</Text>
            <TextInput
              style={styles.input}
              value={competitionName}
              onChangeText={setCompetitionName}
              placeholder={t('competitionName')}
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
                <Text style={styles.label}>{t('specifyDisciplineLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={customDiscipline}
                  onChangeText={setCustomDiscipline}
                  placeholder={t('discipline')}
                  placeholderTextColor="#999"
                />
              </>
            )}

            <Text style={styles.label}>{t('categoryLevel')}</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder={t('levelCategory')}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Fecha *</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={formatDateString(date)}
                onChange={(e: any) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setDate(newDate);
                  }
                }}
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
                  style={styles.selector}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.dateContainer}>
                    <Ionicons name="calendar" size={20} color="#666" />
                    <Text style={styles.selectorText}>{formatDateString(date)}</Text>
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

            <Text style={styles.sectionHeader}>{t('locationSection')}</Text>

            <Text style={styles.label}>{t('placeVenue')}</Text>
            <TextInput
              style={styles.input}
              value={place}
              onChangeText={setPlace}
              placeholder={t('venue')}
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

            <Text style={styles.label}>{t('country')}</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder={t('country')}
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

            <Text style={styles.sectionHeader}>{t('result')}</Text>

            <Text style={styles.label}>{t('position')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowPositionSelector(true)}
            >
              <Text style={position ? styles.selectorText : styles.selectorPlaceholder}>
                {position ? getPositionInfo(position)?.label : t('selectResult')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <Text style={styles.label}>{t('prize')}</Text>
            <TextInput
              style={styles.input}
              value={prize}
              onChangeText={setPrize}
              placeholder={t('prize')}
              placeholderTextColor="#999"
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

        {/* Rider Selector */}
        <Modal visible={showRiderSelector} animationType="fade" transparent>
          <TouchableOpacity style={styles.selectorOverlay} activeOpacity={1} onPress={() => setShowRiderSelector(false)}>
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>{t('selectRider')}</Text>
              <FlatList
                data={riders}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, selectedRiderId === item.id && styles.selectorItemSelected]}
                    onPress={() => { setSelectedRiderId(item.id); setShowRiderSelector(false); }}
                  >
                    <Text style={styles.selectorItemText}>{item.name}</Text>
                    {selectedRiderId === item.id && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Horse Selector */}
        <Modal visible={showHorseSelector} animationType="fade" transparent>
          <TouchableOpacity style={styles.selectorOverlay} activeOpacity={1} onPress={() => setShowHorseSelector(false)}>
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>{t('selectHorse')}</Text>
              <TouchableOpacity
                style={[styles.selectorItem, !selectedHorseId && styles.selectorItemSelected]}
                onPress={() => { setSelectedHorseId(null); setShowHorseSelector(false); }}
              >
                <Text style={styles.selectorItemText}>{t('noSpecificHorse')}</Text>
                {!selectedHorseId && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
              </TouchableOpacity>
              <FlatList
                data={horses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, selectedHorseId === item.id && styles.selectorItemSelected]}
                    onPress={() => { setSelectedHorseId(item.id); setShowHorseSelector(false); }}
                  >
                    <Text style={styles.selectorItemText}>{item.name}</Text>
                    {selectedHorseId === item.id && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Discipline Selector */}
        <Modal visible={showDisciplineSelector} animationType="fade" transparent>
          <TouchableOpacity style={styles.selectorOverlay} activeOpacity={1} onPress={() => setShowDisciplineSelector(false)}>
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>{t('selectDiscipline')}</Text>
              <FlatList
                data={DISCIPLINES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, discipline === item && styles.selectorItemSelected]}
                    onPress={() => { setDiscipline(item); setShowDisciplineSelector(false); }}
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

        {/* Position Selector */}
        <Modal visible={showPositionSelector} animationType="fade" transparent>
          <TouchableOpacity style={styles.selectorOverlay} activeOpacity={1} onPress={() => setShowPositionSelector(false)}>
            <View style={styles.selectorModal}>
              <Text style={styles.selectorTitle}>{t('selectResult')}</Text>
              <TouchableOpacity
                style={[styles.selectorItem, !position && styles.selectorItemSelected]}
                onPress={() => { setPosition(''); setShowPositionSelector(false); }}
              >
                <Text style={styles.selectorItemText}>{t('unspecified')}</Text>
                {!position && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
              </TouchableOpacity>
              <FlatList
                data={POSITIONS}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.selectorItem, position === item.value && styles.selectorItemSelected]}
                    onPress={() => { setPosition(item.value); setShowPositionSelector(false); }}
                  >
                    <View style={styles.positionItemContent}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                      <Text style={styles.selectorItemText}>{t(item.label)}</Text>
                    </View>
                    {position === item.value && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
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
  premiosContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 0,
  },
  totalPrizesCard: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalPrizesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  totalPrizesLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  totalPrizesAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalPrizesCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  prizeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  prizeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  prizeCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  prizeCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  prizeCardCount: {
    fontSize: 12,
    color: '#666',
  },
  prizeCardAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  prizeDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  prizeDetailCompetition: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  prizeDetailAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  prizeHistoryItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  prizeHistoryInfo: {
    flex: 1,
  },
  prizeHistoryCompetition: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  prizeHistoryDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  prizeHistoryRider: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  prizeHistoryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    marginBottom: 0,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  filterBarText: { flex: 1, fontSize: 14, color: '#333' },
  listContainer: { padding: 16, paddingBottom: 80 },
  palmaresCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  palmaresContent: { flex: 1, flexDirection: 'row', padding: 16 },
  disciplineBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  palmaresInfo: { flex: 1 },
  palmaresName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  palmaresDiscipline: { fontSize: 14, color: '#666', marginTop: 2 },
  palmaresMeta: { flexDirection: 'row', marginTop: 6, gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#666' },
  palmaresParticipants: { flexDirection: 'row', marginTop: 8, gap: 12 },
  participant: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  participantText: { fontSize: 12, color: '#333' },
  positionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  positionText: { fontSize: 12, fontWeight: 'bold' },
  prizeText: { fontSize: 12, color: '#FF9800', marginTop: 4, fontWeight: '600' },
  deleteButton: { padding: 16, borderLeftWidth: 1, borderLeftColor: '#f0f0f0', justifyContent: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, color: '#666', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8 },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  filterModal: { backgroundColor: '#fff', borderRadius: 12, width: '85%', maxHeight: '80%', padding: 16 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8 },
  filterList: { maxHeight: 150 },
  filterItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  filterItemSelected: { backgroundColor: '#e8f5e9' },
  filterItemText: { fontSize: 14, color: '#333' },
  applyFilterButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 14, marginTop: 16, alignItems: 'center' },
  applyFilterText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalCancel: { fontSize: 16, color: '#666' },
  modalSave: { fontSize: 16, color: '#2E7D32', fontWeight: '600' },
  modalSaveDisabled: { opacity: 0.5 },
  formContainer: { flex: 1, padding: 16 },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', color: '#666', marginTop: 24, marginBottom: 12, letterSpacing: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  textArea: { height: 80, textAlignVertical: 'top' },
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
  dateContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectorText: { fontSize: 16, color: '#333' },
  selectorPlaceholder: { fontSize: 16, color: '#999' },
  selectorOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  selectorModal: { backgroundColor: '#fff', borderRadius: 12, width: '80%', maxHeight: '60%', padding: 16 },
  selectorTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16, textAlign: 'center' },
  selectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectorItemSelected: { backgroundColor: '#f0f8f0' },
  selectorItemText: { fontSize: 16, color: '#333' },
  disciplineItemContent: { flexDirection: 'row', alignItems: 'center' },
  disciplineDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  positionItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomSpacer: { height: 40 },
});
