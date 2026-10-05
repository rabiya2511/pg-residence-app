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
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useMockAuth } from '../../context/MockAuthContext';

export default function OtpVerificationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const phone: string = route.params?.phone ?? '';
  const { verifyOtp, requestOtp, authError } = useMockAuth();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (otp.trim().length < 6) {
      Alert.alert('Incomplete Code', 'Please enter the 6-digit code from the SMS.');
      return;
    }
    setVerifying(true);
    const success = await verifyOtp(otp);
    // On success the app switches screens by itself, so only reset the button on failure.
    if (!success) setVerifying(false);
  };

  const handleResend = async () => {
    setResending(true);
    const sent = await requestOtp(phone);
    setResending(false);
    if (sent) {
      setOtp('');
      Alert.alert('Code Sent', 'A new code has been sent to your number.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={[typography.heading1, { color: colors.text, marginTop: spacing.lg }]}>
            Verify OTP
          </Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
            Enter the 6-digit code sent to {phone}
          </Text>

          <View style={styles.field}>
            <Text style={[typography.caption, styles.label]}>OTP</Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter 6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              editable={!verifying}
            />
            {!!authError && (
              <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>{authError}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, verifying && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleVerify}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.button, { color: colors.white }]}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={resending || verifying}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
              {resending ? 'Sending...' : "Didn't get a code? Resend"}
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
    padding: spacing.lg,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    padding: spacing.xs,
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
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.xs,
  },
});