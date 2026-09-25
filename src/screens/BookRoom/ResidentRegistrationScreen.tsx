import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { AdminGender } from '../../constants/mockData';
import TermsAgreement from '../../components/TermsAgreement';

type RegistrationParams = {
  propertyId: string;
  roomId: string;
  stayType: 'Monthly' | 'DayGuest';
  name: string;
  phone: string;
  email: string;
  gender: AdminGender;
  method: 'Cash' | 'UPI';
  numDays?: number;
  joiningDateISO: string;
  securityDeposit?: number;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
}) {
  return (
    <View style={styles.field}>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

export default function ResidentRegistrationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as RegistrationParams;
  const { bookMonthlyResident, bookDayGuestSelf } = useAdmin();

  // Pre-filled from the booking/payment step, still editable here so the
  // resident can correct a typo before finalizing registration.
  const [name, setName] = useState(params.name);
  const [phone, setPhone] = useState(params.phone);
  const [email, setEmail] = useState(params.email);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSaveAndFinish = () => {
  if (!name.trim() || !phone.trim() || !email.trim()) {
    Alert.alert('Missing Information', 'Name, phone, and email cannot be empty.');
    return;
  }
  if (!termsAgreed) {
    Alert.alert('Terms Required', 'Please read and accept the Terms and Conditions to complete your registration.');
    return;
  }

  setSubmitting(true);
  try {
    const joiningDate = new Date(params.joiningDateISO);

    if (params.stayType === 'Monthly') {
      bookMonthlyResident({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gender: params.gender,
        propertyId: params.propertyId,
        roomId: params.roomId,
        method: params.method,
        joiningDate,
        securityDeposit: params.securityDeposit ?? 0,
      });
    } else {
      bookDayGuestSelf({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gender: params.gender,
        propertyId: params.propertyId,
        roomId: params.roomId,
        numDays: params.numDays ?? 1,
        method: params.method,
        joiningDate,
      });
    }

    Alert.alert('Registration Complete', 'Welcome! Your registration has been saved.', [
      { text: 'OK', onPress: () => navigation.navigate('MainTabs') },
    ]);
  } finally {
    setSubmitting(false);
  }
};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.heading3, { color: colors.text }]}>Complete Registration</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.infoBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm, flex: 1 }]}>
              Payment received. Confirm your details below to finish registering.
            </Text>
          </View>

          <Field label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Rahul Singh" />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="e.g. rahul@example.com" keyboardType="email-address" />

          <TermsAgreement agreed={termsAgreed} onChange={setTermsAgreed} />

          <TouchableOpacity
            style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleSaveAndFinish}
            disabled={submitting}
          >
            <Text style={[typography.button, { color: colors.white }]}>
              {submitting ? 'Saving...' : 'Save & OK'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, marginBottom: spacing.xs },
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
});