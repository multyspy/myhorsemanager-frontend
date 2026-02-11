import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';


interface Horse {
  id: string;
  name: string;
}

interface Rider {
  id: string;
  name: string;
}

interface CategorySummary {
  total: number;
  count: number;
  name: string;
}

interface EntityReport {
  horse_id?: string;
  rider_id?: string;
  horse_name?: string;
  rider_name?: string;
  total: number;
  count: number;
  by_category: Record<string, CategorySummary>;
}

interface MonthlyData {
  month: number;
  total: number;
  count: number;
}

interface BudgetStatus {
  budget: any;
  actual: number;
  remaining: number;
  percentage: number;
  over_budget: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const HORSE_CATEGORY_COLORS: Record<string, string> = {
  pupilaje: '#4CAF50',
  herrador: '#FF9800',
  veterinario: '#F44336',
  proveedores: '#2196F3',
  otros_propietarios: '#9C27B0',
  alimentacion: '#795548',
  equipo: '#607D8B',
  transporte: '#00BCD4',
  otros: '#9E9E9E',
};

const RIDER_CATEGORY_COLORS: Record<string, string> = {
  equipamiento: '#E91E63',
  formacion: '#3F51B5',
  competiciones: '#FFC107',
  licencias: '#009688',
  seguros: '#673AB7',
  transporte: '#00BCD4',
  alimentacion: '#795548',
  fisioterapia: '#8BC34A',
  otros: '#9E9E9E',
};

export default function ReportsScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedTab, setSelectedTab] = useState<'summary' | 'byEntity' | 'monthly' | 'budget'>('summary');
  const [entityType, setEntityType] = useState<'horse' | 'rider'>('horse');
  
  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [showEntitySelector, setShowEntitySelector] = useState(false);
  
  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState(new Date());
  
  // Report data
  const [summaryData, setSummaryData] = useState<any>(null);
  const [entityReportData, setEntityReportData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [budgetStatus, setBudgetStatus] = useState<any>(null);
  
  // Budget modal
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());

  // Date picker handlers
  const onStartDateChange = (event: any, date?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedStartDate(date);
      const dateStr = date.toISOString().split('T')[0];
      setStartDate(dateStr);
    }
  };

  const onEndDateChange = (event: any, date?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedEndDate(date);
      const dateStr = date.toISOString().split('T')[0];
      setEndDate(dateStr);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Seleccionar';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const fetchEntities = async () => {
    try {
      const [horsesRes, ridersRes] = await Promise.all([
        api.get('/api/horses'),
        api.get('/api/riders')
      ]);
      
      if (horsesRes.ok) setHorses(await horsesRes.json());
      if (ridersRes.ok) setRiders(await ridersRes.json());
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  };

  const fetchSummary = async () => {
    try {
      let url = `/api/reports/summary?entity_type=${entityType}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const response = await api.get(url);
      if (response.ok) {
        const data = await response.json();
        setSummaryData(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchByEntity = async () => {
    try {
      const endpoint = entityType === 'horse' ? 'by-horse' : 'by-rider';
      let url = `/api/reports/${endpoint}`;
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await api.get(url);
      if (response.ok) {
        const data = await response.json();
        setEntityReportData(data);
      }
    } catch (error) {
      console.error('Error fetching by entity:', error);
    }
  };

  const fetchMonthly = async () => {
    try {
      let url = `/api/reports/monthly?year=${selectedYear}&entity_type=${entityType}`;
      if (selectedEntityId) url += `&horse_id=${selectedEntityId}`;

      const response = await api.get(url);
      if (response.ok) {
        const data = await response.json();
        setMonthlyData(data);
      }
    } catch (error) {
      console.error('Error fetching monthly:', error);
    }
  };

  const fetchBudgetStatus = async () => {
    try {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const response = await api.get(`/api/budgets/status?entity_type=${entityType}&month=${month}&year=${year}`);
      if (response.ok) {
        const data = await response.json();
        setBudgetStatus(data);
      }
    } catch (error) {
      console.error('Error fetching budget status:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await fetchEntities();
    await Promise.all([fetchSummary(), fetchByEntity(), fetchMonthly(), fetchBudgetStatus()]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!authLoading && token) {
      fetchAllData();
    } else if (!authLoading && !token) {
      setLoading(false);
    }
  }, [authLoading, token]);

  useEffect(() => {
    if (!loading) {
      fetchSummary();
      fetchByEntity();
      fetchBudgetStatus();
    }
  }, [startDate, endDate, entityType]);

  useEffect(() => {
    if (!loading) {
      fetchMonthly();
    }
  }, [selectedYear, selectedEntityId, entityType]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllData();
  }, []);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const getEntityName = (entityId: string) => {
    if (entityType === 'horse') {
      const horse = horses.find(h => h.id === entityId);
      return horse?.name || 'Todos';
    }
    const rider = riders.find(r => r.id === entityId);
    return rider?.name || 'Todos';
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const exportData = async () => {
    try {
      const response = await api.get(
        `/api/reports/export?entity_type=${entityType}&start_date=${startDate || ''}&end_date=${endDate || ''}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (Platform.OS === 'web') {
          // For web, create a download link
          const blob = new Blob([data.data], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = data.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          Alert.alert('Éxito', 'Archivo CSV descargado');
        } else {
          // For mobile
          if (await Sharing.isAvailableAsync()) {
            const fileUri = FileSystem.documentDirectory + data.filename;
            await FileSystem.writeAsStringAsync(fileUri, data.data, {
              encoding: FileSystem.EncodingType.UTF8
            });
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: 'Exportar gastos a CSV'
            });
          } else {
            // Fallback to share
            await Share.share({
              message: data.data,
              title: data.filename,
            });
          }
        }
      } else {
        Alert.alert('Error', 'No se pudo obtener los datos para exportar');
      }
    } catch (error) {
      console.error('Error exporting:', error);
      Alert.alert('Error', 'No se pudo exportar los datos');
    }
  };

  const saveBudget = async () => {
    if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    try {
      const response = await api.post('/api/budgets', {
        entity_type: entityType,
        entity_id: null,
        category: null,
        month: budgetMonth,
        year: budgetYear,
        amount: parseFloat(budgetAmount),
      });

      if (response.ok) {
        setBudgetModalVisible(false);
        setBudgetAmount('');
        fetchBudgetStatus();
        Alert.alert('Éxito', 'Presupuesto guardado correctamente');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el presupuesto');
    }
  };

  const entities = entityType === 'horse' ? horses : riders;
  const categoryColors = entityType === 'horse' ? HORSE_CATEGORY_COLORS : RIDER_CATEGORY_COLORS;

  const getPieChartData = () => {
    if (!summaryData?.by_category) return [];
    
    return Object.entries(summaryData.by_category)
      .filter(([_, value]: [string, any]) => value.total > 0)
      .map(([key, value]: [string, any]) => ({
        value: value.total,
        color: categoryColors[key] || '#999',
        text: value.name,
        focused: false,
      }));
  };

  const renderSummaryTab = () => {
    if (!summaryData) return null;

    const pieData = getPieChartData();
    const categories = Object.entries(summaryData.by_category || {})
      .filter(([_, value]: [string, any]) => value.total > 0)
      .sort((a: any, b: any) => b[1].total - a[1].total);

    return (
      <View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Gasto Total</Text>
          <Text style={styles.totalAmount}>{formatAmount(summaryData.total)}</Text>
          <Text style={styles.totalCount}>{summaryData.count} gastos registrados</Text>
        </View>

        {pieData.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Distribución por Categoría</Text>
            <View style={styles.pieContainer}>
              <PieChart
                data={pieData}
                donut
                radius={100}
                innerRadius={60}
                centerLabelComponent={() => (
                  <View style={styles.pieCenter}>
                    <Text style={styles.pieCenterText}>{formatAmount(summaryData.total)}</Text>
                  </View>
                )}
              />
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Detalle por Categoría</Text>
        {categories.length === 0 ? (
          <View style={styles.emptyCategory}>
            <Text style={styles.emptyCategoryText}>No hay datos para mostrar</Text>
          </View>
        ) : (
          categories.map(([key, value]: [string, any]) => {
            const percentage = summaryData.total > 0 ? (value.total / summaryData.total) * 100 : 0;
            return (
              <View key={key} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <View style={[styles.categoryDot, { backgroundColor: categoryColors[key] || '#999' }]} />
                  <Text style={styles.categoryName}>{value.name}</Text>
                  <Text style={styles.categoryAmount}>{formatAmount(value.total)}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${percentage}%`, backgroundColor: categoryColors[key] || '#999' },
                    ]}
                  />
                </View>
                <Text style={styles.categoryCount}>{value.count} gastos ({percentage.toFixed(1)}%)</Text>
              </View>
            );
          })
        )}

        <TouchableOpacity style={styles.exportButton} onPress={exportData}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.exportButtonText}>Exportar a CSV</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderByEntityTab = () => {
    if (!entityReportData) return null;

    const entityList = entityType === 'horse' ? entityReportData.horses : entityReportData.riders;
    const grandTotal = entityReportData.grand_total || 0;

    return (
      <View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Gasto Total</Text>
          <Text style={styles.totalAmount}>{formatAmount(grandTotal)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Por {entityType === 'horse' ? 'Caballo' : 'Jinete'}</Text>
        {!entityList || entityList.length === 0 ? (
          <View style={styles.emptyCategory}>
            <Text style={styles.emptyCategoryText}>No hay datos para mostrar</Text>
          </View>
        ) : (
          entityList.map((entity: EntityReport) => {
            const percentage = grandTotal > 0 ? (entity.total / grandTotal) * 100 : 0;
            const name = entityType === 'horse' ? entity.horse_name : entity.rider_name;
            return (
              <View key={entity.horse_id || entity.rider_id} style={styles.entityCard}>
                <View style={styles.entityHeader}>
                  <View style={styles.entityIconContainer}>
                    <Ionicons name={entityType === 'horse' ? 'fitness' : 'person'} size={20} color="#2E7D32" />
                  </View>
                  <View style={styles.entityInfo}>
                    <Text style={styles.entityName}>{name}</Text>
                    <Text style={styles.entityCount}>{entity.count} gastos</Text>
                  </View>
                  <Text style={styles.entityAmount}>{formatAmount(entity.total)}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${percentage}%`, backgroundColor: '#2E7D32' },
                    ]}
                  />
                </View>
                <View style={styles.entityCategoriesContainer}>
                  {Object.entries(entity.by_category)
                    .filter(([_, val]: [string, any]) => val.total > 0)
                    .slice(0, 3)
                    .map(([cat, val]: [string, any]) => (
                      <View key={cat} style={styles.miniCategory}>
                        <View style={[styles.miniDot, { backgroundColor: categoryColors[cat] || '#999' }]} />
                        <Text style={styles.miniCategoryText}>
                          {val.name}: {formatAmount(val.total)}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  const renderMonthlyTab = () => {
    if (!monthlyData) return null;

    const maxMonthTotal = Math.max(...monthlyData.months.map((m: MonthlyData) => m.total), 1);

    return (
      <View>
        <View style={styles.yearSelector}>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(selectedYear - 1)}
          >
            <Ionicons name="chevron-back" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}</Text>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(selectedYear + 1)}
          >
            <Ionicons name="chevron-forward" size={24} color="#2E7D32" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.entityFilter}
          onPress={() => setShowEntitySelector(true)}
        >
          <Ionicons name="filter" size={18} color="#666" />
          <Text style={styles.entityFilterText}>
            {selectedEntityId ? getEntityName(selectedEntityId) : `Todos los ${entityType === 'horse' ? 'caballos' : 'jinetes'}`}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#666" />
        </TouchableOpacity>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total {selectedYear}</Text>
          <Text style={styles.totalAmount}>{formatAmount(monthlyData.total)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Gastos Mensuales</Text>
        {monthlyData.months.map((month: MonthlyData, index: number) => {
          const barWidth = maxMonthTotal > 0 ? (month.total / maxMonthTotal) * 100 : 0;
          return (
            <View key={month.month} style={styles.monthRow}>
              <Text style={styles.monthName}>{MONTH_NAMES[index]}</Text>
              <View style={styles.monthBarContainer}>
                <View
                  style={[
                    styles.monthBar,
                    { width: `${barWidth}%`, backgroundColor: month.total > 0 ? '#2E7D32' : '#e0e0e0' },
                  ]}
                />
              </View>
              <Text style={styles.monthAmount}>{formatAmount(month.total)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderBudgetTab = () => {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    return (
      <View>
        <View style={styles.budgetHeader}>
          <Text style={styles.budgetTitle}>Presupuesto {MONTH_NAMES[month - 1]} {year}</Text>
          <TouchableOpacity
            style={styles.addBudgetButton}
            onPress={() => setBudgetModalVisible(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {!budgetStatus || budgetStatus.status?.length === 0 ? (
          <View style={styles.emptyBudget}>
            <Ionicons name="wallet-outline" size={64} color="#ccc" />
            <Text style={styles.emptyBudgetText}>No hay presupuestos configurados</Text>
            <Text style={styles.emptyBudgetSubtext}>Toca + para crear uno</Text>
          </View>
        ) : (
          <>
            <View style={styles.budgetSummaryCard}>
              <View style={styles.budgetSummaryRow}>
                <Text style={styles.budgetSummaryLabel}>Presupuestado:</Text>
                <Text style={styles.budgetSummaryValue}>{formatAmount(budgetStatus.total_budgeted)}</Text>
              </View>
              <View style={styles.budgetSummaryRow}>
                <Text style={styles.budgetSummaryLabel}>Gastado:</Text>
                <Text style={[
                  styles.budgetSummaryValue,
                  budgetStatus.total_actual > budgetStatus.total_budgeted && styles.overBudgetText
                ]}>
                  {formatAmount(budgetStatus.total_actual)}
                </Text>
              </View>
              <View style={styles.budgetSummaryRow}>
                <Text style={styles.budgetSummaryLabel}>Disponible:</Text>
                <Text style={[
                  styles.budgetSummaryValue,
                  budgetStatus.total_budgeted - budgetStatus.total_actual < 0 && styles.overBudgetText
                ]}>
                  {formatAmount(budgetStatus.total_budgeted - budgetStatus.total_actual)}
                </Text>
              </View>
            </View>

            {budgetStatus.status.map((item: BudgetStatus, index: number) => (
              <View key={index} style={styles.budgetItemCard}>
                <View style={styles.budgetItemHeader}>
                  <Text style={styles.budgetItemTitle}>
                    {item.budget.category 
                      ? (entityType === 'horse' 
                          ? HORSE_CATEGORY_COLORS[item.budget.category] 
                          : item.budget.category)
                      : 'Presupuesto Global'}
                  </Text>
                  {item.over_budget && (
                    <View style={styles.overBudgetBadge}>
                      <Text style={styles.overBudgetBadgeText}>Excedido</Text>
                    </View>
                  )}
                </View>
                <View style={styles.budgetProgressContainer}>
                  <View style={styles.budgetProgressBar}>
                    <View
                      style={[
                        styles.budgetProgressFill,
                        { 
                          width: `${Math.min(item.percentage, 100)}%`,
                          backgroundColor: item.over_budget ? '#F44336' : '#2E7D32'
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.budgetPercentage}>{item.percentage.toFixed(0)}%</Text>
                </View>
                <View style={styles.budgetItemDetails}>
                  <Text style={styles.budgetItemDetail}>
                    {formatAmount(item.actual)} / {formatAmount(item.budget.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
      >
        {/* Entity Type Selector */}
        <View style={styles.entityTypeSelector}>
          <TouchableOpacity
            style={[styles.entityTypeButton, entityType === 'horse' && styles.entityTypeButtonActive]}
            onPress={() => setEntityType('horse')}
          >
            <Ionicons name="fitness" size={18} color={entityType === 'horse' ? '#fff' : '#666'} />
            <Text style={[styles.entityTypeText, entityType === 'horse' && styles.entityTypeTextActive]}>
              Caballos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.entityTypeButton, entityType === 'rider' && styles.entityTypeButtonActive]}
            onPress={() => setEntityType('rider')}
          >
            <Ionicons name="person" size={18} color={entityType === 'rider' ? '#fff' : '#666'} />
            <Text style={[styles.entityTypeText, entityType === 'rider' && styles.entityTypeTextActive]}>
              Jinetes
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Filters */}
        {selectedTab !== 'monthly' && selectedTab !== 'budget' && (
          <View style={styles.filterContainer}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.filterLabel}>Desde</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.webDateInputWrapper}>
                  <Ionicons name="calendar-outline" size={18} color="#666" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: 14,
                      padding: 10,
                      border: '1px solid #e0e0e0',
                      borderRadius: 8,
                      backgroundColor: '#f5f5f5',
                      marginLeft: 8,
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateSelector}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#666" />
                    <Text style={styles.dateSelectorText}>
                      {startDate ? formatDisplayDate(startDate) : 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={selectedStartDate}
                      mode="date"
                      display="default"
                      onChange={onStartDateChange}
                    />
                  )}
                </>
              )}
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={styles.filterLabel}>Hasta</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.webDateInputWrapper}>
                  <Ionicons name="calendar-outline" size={18} color="#666" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      fontSize: 14,
                      padding: 10,
                      border: '1px solid #e0e0e0',
                      borderRadius: 8,
                      backgroundColor: '#f5f5f5',
                      marginLeft: 8,
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateSelector}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#666" />
                    <Text style={styles.dateSelectorText}>
                      {endDate ? formatDisplayDate(endDate) : 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={selectedEndDate}
                      mode="date"
                      display="default"
                      onChange={onEndDateChange}
                    />
                  )}
                </>
              )}
            </View>
            {(startDate || endDate) && (
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Ionicons name="close-circle" size={24} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'summary' && styles.tabActive]}
            onPress={() => setSelectedTab('summary')}
          >
            <Text style={[styles.tabText, selectedTab === 'summary' && styles.tabTextActive]}>
              Resumen
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'byEntity' && styles.tabActive]}
            onPress={() => setSelectedTab('byEntity')}
          >
            <Text style={[styles.tabText, selectedTab === 'byEntity' && styles.tabTextActive]}>
              Por {entityType === 'horse' ? 'Caballo' : 'Jinete'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'monthly' && styles.tabActive]}
            onPress={() => setSelectedTab('monthly')}
          >
            <Text style={[styles.tabText, selectedTab === 'monthly' && styles.tabTextActive]}>
              Mensual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'budget' && styles.tabActive]}
            onPress={() => setSelectedTab('budget')}
          >
            <Text style={[styles.tabText, selectedTab === 'budget' && styles.tabTextActive]}>
              Presupuesto
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {selectedTab === 'summary' && renderSummaryTab()}
        {selectedTab === 'byEntity' && renderByEntityTab()}
        {selectedTab === 'monthly' && renderMonthlyTab()}
        {selectedTab === 'budget' && renderBudgetTab()}
      </ScrollView>

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
            <Text style={styles.selectorTitle}>Filtrar por {entityType === 'horse' ? 'Caballo' : 'Jinete'}</Text>
            <TouchableOpacity
              style={[styles.selectorItem, !selectedEntityId && styles.selectorItemSelected]}
              onPress={() => {
                setSelectedEntityId(null);
                setShowEntitySelector(false);
              }}
            >
              <Text style={styles.selectorItemText}>Todos</Text>
              {!selectedEntityId && <Ionicons name="checkmark" size={20} color="#2E7D32" />}
            </TouchableOpacity>
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
                  {selectedEntityId === item.id && (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Budget Modal */}
      <Modal
        visible={budgetModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.selectorOverlay}
          activeOpacity={1}
          onPress={() => setBudgetModalVisible(false)}
        >
          <View style={styles.budgetModal}>
            <Text style={styles.selectorTitle}>Nuevo Presupuesto</Text>
            
            <Text style={styles.budgetModalLabel}>Monto (€)</Text>
            <TextInput
              style={styles.budgetModalInput}
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />

            <View style={styles.budgetModalButtons}>
              <TouchableOpacity
                style={styles.budgetModalCancel}
                onPress={() => setBudgetModalVisible(false)}
              >
                <Text style={styles.budgetModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.budgetModalSave}
                onPress={saveBudget}
              >
                <Text style={styles.budgetModalSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  entityTypeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  entityTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    gap: 6,
  },
  entityTypeButtonActive: {
    backgroundColor: '#2E7D32',
  },
  entityTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  entityTypeTextActive: {
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 8,
  },
  dateSelectorText: {
    fontSize: 14,
    color: '#333',
  },
  webDateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingLeft: 10,
  },
  clearButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#2E7D32',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
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
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  pieContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  pieCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieCenterText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
  categoryCount: {
    fontSize: 12,
    color: '#666',
  },
  emptyCategory: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyCategoryText: {
    fontSize: 14,
    color: '#999',
  },
  entityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  entityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  entityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  entityInfo: {
    flex: 1,
  },
  entityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  entityCount: {
    fontSize: 12,
    color: '#666',
  },
  entityAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  entityCategoriesContainer: {
    marginTop: 8,
  },
  miniCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  miniCategoryText: {
    fontSize: 12,
    color: '#666',
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearButton: {
    padding: 8,
  },
  yearText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 24,
  },
  entityFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  entityFilterText: {
    fontSize: 14,
    color: '#333',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  monthName: {
    width: 80,
    fontSize: 14,
    color: '#333',
  },
  monthBarContainer: {
    flex: 1,
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  monthBar: {
    height: '100%',
    borderRadius: 8,
  },
  monthAmount: {
    width: 80,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
    gap: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addBudgetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBudget: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyBudgetText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptyBudgetSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  budgetSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  budgetSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  budgetSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  budgetSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  overBudgetText: {
    color: '#F44336',
  },
  budgetItemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  budgetItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  overBudgetBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  overBudgetBadgeText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: 'bold',
  },
  budgetProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetProgressBar: {
    flex: 1,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  budgetProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  budgetPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    width: 50,
    textAlign: 'right',
  },
  budgetItemDetails: {
    marginTop: 8,
  },
  budgetItemDetail: {
    fontSize: 12,
    color: '#666',
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
  budgetModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    padding: 20,
  },
  budgetModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  budgetModalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  budgetModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  budgetModalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  budgetModalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  budgetModalSave: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  budgetModalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
