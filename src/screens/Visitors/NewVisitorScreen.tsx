import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useVisitors } from '../../context/VisitorsContext';

export default function NewVisitorScreen() {
  const navigation = useNavigation<any>();
  const { addVisitor } = useVisitors();
  const [visitorName, setVisitorName] = useState('');
  const [purpose, setPurpose] = useState('');

  const canSubmit = visitorName.trim().length > 0 && purpose.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    addVisitor(visitorName.trim(), purpose.trim());
    Alert.alert(
      'Visitor Registered',
      `${visitorName.trim()} has been logged as checked in.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Register Visitor</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
          Visitor Name
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter visitor's full name"
          placeholderTextColor={colors.textMuted}
          value={visitorName}
          onChangeText={setVisitorName}
        />

        <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Purpose of Visit
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Friend visit, Delivery, Family"
          placeholderTextColor={colors.textMuted}
          value={purpose}
          onChangeText={setPurpose}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <Text style={[typography.button, { color: colors.white }]}>Register Visitor</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
});