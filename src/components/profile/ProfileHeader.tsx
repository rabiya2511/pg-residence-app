import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';

type Props = {
  name: string;
  email: string;
  phone: string;
  photoUri?: string;
  onEditPress?: () => void;
};

export default function ProfileHeader({ name, email, phone, photoUri, onEditPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={40} color={colors.primary} />
        )}
      </View>
      <Text style={[typography.heading2, { color: colors.text, marginTop: spacing.sm }]}>
        {name}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>{email}</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>{phone}</Text>

      <TouchableOpacity
        style={styles.editButton}
        activeOpacity={0.8}
        onPress={onEditPress}
      >
        <Text style={[typography.button, { color: colors.primary }]}>Edit Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 88,
    height: 88,
  },
  editButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
});