import React, { useEffect, useRef, useState } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Platform, View, Text, AppState, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../src/i18n';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

function RootLayoutNav() {
  const { user, token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password';

    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [token, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={{ marginTop: 16, color: '#666' }}>{t('loading')}</Text>
      </View>
    );
  }

  return <TabLayoutContent />;
}

function TabLayoutContent() {
  const [notificationCount, setNotificationCount] = useState(0);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const { token } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Only set up notifications if user is authenticated
    if (!token) return;

    registerForPushNotificationsAsync();
    checkUpcomingReminders();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkUpcomingReminders();
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      subscription.remove();
    };
  }, []);

  const registerForPushNotificationsAsync = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
  };

  const checkUpcomingReminders = async () => {
    try {
      const response = await fetch(`${API_URL}/api/reminders/upcoming?days=7`);
      if (response.ok) {
        const reminders = await response.json();
        setNotificationCount(reminders.length);
        
        for (const reminder of reminders) {
          await scheduleNotification(reminder);
        }
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  };

  const scheduleNotification = async (reminder: any) => {
    const reminderDate = new Date(`${reminder.reminder_date}T${reminder.reminder_time || '09:00'}:00`);
    const now = new Date();
    
    if (reminderDate > now) {
      const trigger = reminderDate.getTime() - now.getTime();
      
      if (trigger > 0 && trigger < 7 * 24 * 60 * 60 * 1000) {
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
  };

  // Hide tabs when not authenticated
  const tabBarStyle = token ? styles.tabBar : { display: 'none' as const };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: tabBarStyle,
        tabBarLabelStyle: styles.tabBarLabel,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTintColor: '#fff',
        headerShown: !!token,
        headerRight: () => token ? (
          <TouchableOpacity 
            style={{ marginRight: 16 }} 
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('horses'),
          headerTitle: t('myHorses'),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="horse-head" size={size - 4} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="riders"
        options={{
          title: t('riders'),
          headerTitle: t('myRiders'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="body" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t('expenses'),
          headerTitle: t('expenseControl'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="palmares"
        options={{
          title: t('palmares'),
          headerTitle: t('palmares'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ribbon" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="competitions"
        options={{
          title: t('competitions'),
          headerTitle: t('competitions'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="suppliers"
        options={{
          title: t('suppliers'),
          headerTitle: t('suppliers'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t('reminders'),
          headerTitle: t('reminders'),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="alarm" size={size} color={color} />
              {notificationCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('reports'),
          headerTitle: t('reports'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      {/* Hide auth screens from tab bar */}
      <Tabs.Screen
        name="login"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="register"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="forgot-password"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 25 : 8,
    height: Platform.OS === 'ios' ? 88 : 62,
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#2E7D32',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
