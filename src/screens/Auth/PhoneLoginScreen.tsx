import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMockAuth } from '../../context/MockAuthContext';

export default function PhoneLoginScreen() {
  const navigation = useNavigation<any>();
  const { requestOtp, loginWithGoogle, authError } = useMockAuth();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendOtp = async () => {
    if (phone.trim().replace(/[^\d]/g, '').length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }
    setSending(true);
    const sent = await requestOtp(phone);
    setSending(false);
    // If sending failed, the reason is shown under the number (authError).
    if (sent) {
      navigation.navigate('OtpVerification', { phone: phone.trim() });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={[typography.heading1, { color: colors.text }]}>Welcome</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
            Sign in with your phone number to continue
          </Text>

          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              editable={!sending}
            />
            {!!authError && (
              <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>{authError}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.otpButton, sending && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleSendOtp}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.button, { color: colors.white }]}>Get OTP</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={[typography.caption, { color: colors.textMuted, marginHorizontal: spacing.sm }]}>
              OR
            </Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Real Google sign-in is added in a later step; for now this just explains that. */}
          <TouchableOpacity style={styles.googleButton} activeOpacity={0.85} onPress={loginWithGoogle}>
            <Ionicons name="logo-google" size={20} color={colors.text} />
            <Text style={[typography.button, { color: colors.text, marginLeft: spacing.sm }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  field: {
    marginTop: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  otpButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});