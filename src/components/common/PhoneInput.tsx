import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { COUNTRIES, buildPhone, findCountry, parsePhone, splitPhone } from '../../utils/phone';

// A phone field with a labelled "Country Code" selector and the number box beside it.
// `value` / `onChange` use the international format, e.g. "+919876543210" ("" when empty).
// Older numbers such as "9876543210" are read as +91 automatically.
export default function PhoneInput({
  label,
  value,
  onChange,
  required,
  containerStyle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  containerStyle?: any;
}) {
  const [{ dial, national }, setParts] = useState(() => splitPhone(value));
  const [pickerOpen, setPickerOpen] = useState(false);

  // If the form changes the value from outside (e.g. it loads a saved resident), follow it.
  useEffect(() => {
    if (value !== buildPhone(dial, national)) setParts(splitPhone(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = findCountry(dial);
  const maxLen = country ? Math.max(...country.lengths) + 1 : 15; // +1 lets a leading 0 be typed

  const update = (nextDial: string, nextNational: string) => {
    setParts({ dial: nextDial, national: nextNational });
    onChange(buildPhone(nextDial, nextNational));
  };

  // Tell the admin what is wrong while they type, but only once they have typed something.
  const parsed = national ? parsePhone(buildPhone(dial, national)) : null;
  const complete = !!country && national.length >= Math.min(...country.lengths);
  const error = parsed && !parsed.ok && complete ? parsed.message : null;

  return (
    <View style={[styles.field, containerStyle]}>
      <View style={styles.labelRow}>
        <Text style={[typography.caption, styles.label, { flex: 0.9 }]}>Country Code</Text>
        <Text style={[typography.caption, styles.label, { flex: 2 }]}>
          {label}
          {required ? ' *' : ''}
        </Text>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.codeBox, { flex: 0.9 }]} activeOpacity={0.8} onPress={() => setPickerOpen(true)}>
          <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {country ? `${country.iso} +${country.dial}` : `+${dial}`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { flex: 2 }, !!error && { borderColor: colors.error }]}
          value={national}
          onChangeText={(t) => update(dial, t.replace(/\D/g, '').slice(0, maxLen))}
          placeholder={country?.example ?? 'Phone number'}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          maxLength={maxLen}
        />
      </View>

      {error ? (
        <Text style={[typography.caption, { color: colors.error, marginTop: 4 }]}>{error}</Text>
      ) : (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
          {country ? `${country.name}: ${country.hint}` : 'Choose a country code'}
        </Text>
      )}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={[typography.bodyBold, { color: colors.text, padding: spacing.md }]}>Select Country Code</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {COUNTRIES.map((c) => {
                const selected = c.dial === dial;
                return (
                  <TouchableOpacity
                    key={c.iso}
                    style={[styles.option, selected && { backgroundColor: colors.primaryLight }]}
                    onPress={() => {
                      update(c.dial, national);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{c.name}</Text>
                    <Text style={[typography.bodyBold, { color: colors.primary }]}>+{c.dial}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: spacing.sm }} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', gap: spacing.sm },
  label: { color: colors.textMuted, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, paddingBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});