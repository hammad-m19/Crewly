import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';
import { apiFetch } from '../../lib/api';
import { LoginResponse } from '@crewly/shared';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
        skipAuth: true,
      });

      if (result.success && result.data) {
        const { token, refreshToken, user } = result.data;
        await login(token, refreshToken, user);
        // Navigation guard in _layout.tsx will handle redirect
      } else {
        Alert.alert(
          'Login Failed',
          result.error?.message || 'Invalid credentials. Please try again.'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo / Branding */}
        <View style={styles.brandingSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🏗️</Text>
          </View>
          <Text style={styles.appName}>Crewly</Text>
          <Text style={styles.tagline}>Construction Management</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign In</Text>
          <Text style={styles.formSubtitle}>Enter your credentials to continue</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor={colors.neutral[400]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={colors.neutral[400]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showPasswordText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Contact your administrator for account access
        </Text>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[800],
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  brandingSection: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  logoIcon: {
    fontSize: 40,
  },
  appName: {
    ...typography.heading1,
    color: colors.text.inverse,
    letterSpacing: 1,
  },
  tagline: {
    ...typography.body,
    color: colors.primary[200],
    marginTop: spacing.xs,
  },
  formCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    ...shadows.lg,
  },
  formTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginBottom: spacing['2xl'],
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  passwordInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text.primary,
  },
  showPasswordButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  showPasswordText: {
    ...typography.label,
    color: colors.primary[500],
  },
  loginButton: {
    height: 52,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.md,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    ...typography.button,
    color: colors.text.inverse,
  },
  footer: {
    ...typography.caption,
    color: colors.primary[300],
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
});
