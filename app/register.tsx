import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const SECURITY_QUESTIONS = [
  "¿Cuál es el nombre de tu primera mascota?",
  "¿En qué ciudad naciste?",
  "¿Cuál es el nombre de tu madre?",
  "¿Cuál fue tu primer colegio?",
  "¿Cuál es tu comida favorita?",
  "¿Cuál es el nombre de tu mejor amigo de la infancia?",
  "¿Cuál es tu película favorita?",
  "¿Cuál es el segundo nombre de tu padre?",
];

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('nameRequired'));
      return;
    }
    if (!email.trim()) {
      Alert.alert(t('error'), t('emailRequired'));
      return;
    }
    if (!password) {
      Alert.alert(t('error'), t('passwordRequired'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('passwordMismatch'));
      return;
    }
    if (!securityQuestion) {
      Alert.alert(t('error'), i18n.language === 'es' ? 'Selecciona una pregunta de seguridad' : 'Select a security question');
      return;
    }
    if (!securityAnswer.trim()) {
      Alert.alert(t('error'), i18n.language === 'es' ? 'Ingresa la respuesta de seguridad' : 'Enter security answer');
      return;
    }

    setLoading(true);
    try {
      await register(
        email.trim().toLowerCase(), 
        password, 
        name.trim(),
        securityQuestion,
        securityAnswer.trim()
      );
      router.replace('/');
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>{t('register')}</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('name')}
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('email')}
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('password')}
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('confirmPassword')}
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* Security Question Section */}
            <Text style={styles.sectionTitle}>
              {i18n.language === 'es' ? 'Pregunta de Seguridad' : 'Security Question'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {i18n.language === 'es' 
                ? 'Para recuperar tu contraseña si la olvidas' 
                : 'To recover your password if you forget it'}
            </Text>

            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowQuestionPicker(true)}
            >
              <Ionicons name="help-circle-outline" size={20} color="#666" style={styles.inputIcon} />
              <Text style={[styles.pickerButtonText, !securityQuestion && styles.placeholderText]}>
                {securityQuestion || (i18n.language === 'es' ? 'Seleccionar pregunta...' : 'Select question...')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.inputContainer}>
              <Ionicons name="chatbubble-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={i18n.language === 'es' ? 'Tu respuesta' : 'Your answer'}
                placeholderTextColor="#999"
                value={securityAnswer}
                onChangeText={setSecurityAnswer}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>{t('register')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>{t('haveAccount')} </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>{t('login')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Question Picker Modal */}
      <Modal
        visible={showQuestionPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuestionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {i18n.language === 'es' ? 'Seleccionar Pregunta' : 'Select Question'}
              </Text>
              <TouchableOpacity onPress={() => setShowQuestionPicker(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SECURITY_QUESTIONS}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.questionItem,
                    securityQuestion === item && styles.questionItemSelected
                  ]}
                  onPress={() => {
                    setSecurityQuestion(item);
                    setShowQuestionPicker(false);
                  }}
                >
                  <Text style={[
                    styles.questionItemText,
                    securityQuestion === item && styles.questionItemTextSelected
                  ]}>
                    {item}
                  </Text>
                  {securityQuestion === item && (
                    <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              )}
            />
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  registerButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#2E7D32',
    fontSize: 14,
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  questionItemSelected: {
    backgroundColor: '#E8F5E9',
  },
  questionItemText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  questionItemTextSelected: {
    color: '#2E7D32',
    fontWeight: '500',
  },
});
