import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

type Step = 'email' | 'security' | 'newPassword' | 'success';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { forgotPassword, verifySecurityAnswer, resetPasswordWithSecurity } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const handleGetSecurityQuestion = async () => {
    if (!email.trim()) {
      Alert.alert(t('error'), t('emailRequired'));
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword(email.trim().toLowerCase());
      if (response.security_question) {
        setSecurityQuestion(response.security_question);
        setStep('security');
      }
    } catch (error: any) {
      Alert.alert(t('error'), error.message || (i18n.language === 'es' ? 'Email no encontrado' : 'Email not found'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswer = async () => {
    if (!securityAnswer.trim()) {
      Alert.alert(t('error'), i18n.language === 'es' ? 'Ingresa tu respuesta' : 'Enter your answer');
      return;
    }

    setLoading(true);
    try {
      const verified = await verifySecurityAnswer(email.trim().toLowerCase(), securityAnswer.trim());
      if (verified) {
        setStep('newPassword');
      }
    } catch (error: any) {
      Alert.alert(t('error'), error.message || (i18n.language === 'es' ? 'Respuesta incorrecta' : 'Incorrect answer'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      Alert.alert(t('error'), t('passwordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('error'), i18n.language === 'es' ? 'La contraseña debe tener al menos 6 caracteres' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithSecurity(email.trim().toLowerCase(), securityAnswer.trim(), newPassword);
      setStep('success');
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderEmailStep = () => (
    <>
      <Text style={styles.title}>
        {i18n.language === 'es' ? 'Recuperar Contraseña' : 'Reset Password'}
      </Text>
      <Text style={styles.subtitle}>
        {i18n.language === 'es' 
          ? 'Ingresa tu correo electrónico para verificar tu identidad' 
          : 'Enter your email to verify your identity'}
      </Text>

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

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleGetSecurityQuestion}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>
            {i18n.language === 'es' ? 'Continuar' : 'Continue'}
          </Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderSecurityStep = () => (
    <>
      <Text style={styles.title}>
        {i18n.language === 'es' ? 'Pregunta de Seguridad' : 'Security Question'}
      </Text>
      <Text style={styles.subtitle}>
        {i18n.language === 'es' 
          ? 'Responde tu pregunta de seguridad para verificar tu identidad' 
          : 'Answer your security question to verify your identity'}
      </Text>

      <View style={styles.questionBox}>
        <Ionicons name="help-circle" size={24} color="#2E7D32" />
        <Text style={styles.questionText}>{securityQuestion}</Text>
      </View>

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
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleVerifyAnswer}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>
            {i18n.language === 'es' ? 'Verificar' : 'Verify'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backLink} onPress={() => setStep('email')}>
        <Text style={styles.backLinkText}>
          {i18n.language === 'es' ? '← Cambiar email' : '← Change email'}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderNewPasswordStep = () => (
    <>
      <Text style={styles.title}>
        {i18n.language === 'es' ? 'Nueva Contraseña' : 'New Password'}
      </Text>
      <Text style={styles.subtitle}>
        {i18n.language === 'es' 
          ? 'Crea una nueva contraseña para tu cuenta' 
          : 'Create a new password for your account'}
      </Text>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={i18n.language === 'es' ? 'Nueva contraseña' : 'New password'}
          placeholderTextColor="#999"
          value={newPassword}
          onChangeText={setNewPassword}
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
          placeholder={i18n.language === 'es' ? 'Confirmar contraseña' : 'Confirm password'}
          placeholderTextColor="#999"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>
            {i18n.language === 'es' ? 'Cambiar Contraseña' : 'Change Password'}
          </Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={80} color="#2E7D32" />
      </View>
      <Text style={styles.title}>
        {i18n.language === 'es' ? '¡Contraseña Actualizada!' : 'Password Updated!'}
      </Text>
      <Text style={styles.subtitle}>
        {i18n.language === 'es' 
          ? 'Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.' 
          : 'Your password has been changed successfully. You can now log in with your new password.'}
      </Text>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={() => router.replace('/login')}
      >
        <Text style={styles.submitButtonText}>
          {i18n.language === 'es' ? 'Ir a Iniciar Sesión' : 'Go to Login'}
        </Text>
      </TouchableOpacity>
    </>
  );

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
          {step !== 'success' && (
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          )}

          {step !== 'success' && (
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="key" size={40} color="#fff" />
              </View>
            </View>
          )}

          {/* Progress indicator */}
          {step !== 'success' && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressDot, step === 'email' && styles.progressDotActive]} />
              <View style={styles.progressLine} />
              <View style={[styles.progressDot, step === 'security' && styles.progressDotActive]} />
              <View style={styles.progressLine} />
              <View style={[styles.progressDot, step === 'newPassword' && styles.progressDotActive]} />
            </View>
          )}

          <View style={styles.formContainer}>
            {step === 'email' && renderEmailStep()}
            {step === 'security' && renderSecurityStep()}
            {step === 'newPassword' && renderNewPasswordStep()}
            {step === 'success' && renderSuccessStep()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  progressDotActive: {
    backgroundColor: '#2E7D32',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  questionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  questionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#2E7D32',
    fontSize: 14,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
});
