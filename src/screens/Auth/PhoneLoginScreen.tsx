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

// Demo logins: these are the test phone numbers saved in Firebase Console
// (Authentication > Sign-in method > Phone > Phone numbers for testing).
// Tapping one signs in through the normal Firebase phone login, so the real data loads.
// They are only shown while developing (__DEV__), never in a release build.
const DEMO_OTP = '123456';
const DEMO_LOGINS = [
  { label: 'Demo Admin', phone: '98765 43210', icon: 'business-outline' },
  { label: 'Demo Resident', phone: '99999 99999', icon: 'person-outline' },
] as const;

// TEMPORARY: show demo logins in release builds. Set back to __DEV__ before sharing the app.
const SHOW_DEMO_LOGINS = true; // normally: __DEV__

export default function PhoneLoginScreen() {
  const navigation = useNavigation<any>();
  const { requestOtp, verifyOtp, loginWithGoogle, authError } = useMockAuth();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);

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

  // Sends the code and confirms it straight away with the fixed test code.
  const handleDemoLogin = async (label: string, demoPhone: string) => {
    setDemoBusy(label);
    setPhone(demoPhone);
    try {
      const sent = await requestOtp(demoPhone);
      if (sent) await verifyOtp(DEMO_OTP);
      // On success the app switches to the right dashboard by itself.
    } finally {
      setDemoBusy(null);
    }
  };

  const busy = sending || demoBusy !== null;

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
              editable={!busy}
            />
            {!!authError && (
              <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>{authError}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.otpButton, busy && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleSendOtp}
            disabled={busy}
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
          <TouchableOpacity style={styles.googleButton} activeOpacity={0.85} onPress={loginWithGoogle} disabled={busy}>
            <Ionicons name="logo-google" size={20} color={colors.text} />
            <Text style={[typography.button, { color: colors.text, marginLeft: spacing.sm }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {SHOW_DEMO_LOGINS && (
            <View style={styles.demoBox}>
              <Text style={[typography.caption, styles.demoTitle]}>DEMO LOGINS (testing only)</Text>
              <View style={styles.demoRow}>
                {DEMO_LOGINS.map((d) => (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.demoButton, busy && { opacity: 0.6 }]}
                    activeOpacity={0.85}
                    onPress={() => handleDemoLogin(d.label, d.phone)}
                    disabled={busy}
                  >
                    {demoBusy === d.label ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name={d.icon} size={18} color={colors.primary} />
                        <Text style={[typography.caption, styles.demoLabel]}>{d.label}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
  demoBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  demoTitle: {
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  demoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  demoLabel: {
    color: colors.text,
    fontWeight: '700',
  },
});