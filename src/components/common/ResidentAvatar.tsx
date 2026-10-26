import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

type Props = { uri?: string | null; name?: string; size?: number };

// Shows the resident's photo, or their first initial when there is no photo
// (or the photo can't be loaded).
export default function ResidentAvatar({ uri, name, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const box = { width: size, height: size, borderRadius: size / 2 };
  const initial = name?.trim().charAt(0).toUpperCase();

  if (uri && !failed) {
    return <Image source={{ uri }} style={[styles.image, box]} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[styles.fallback, box]}>
      {initial ? (
        <Text style={{ color: colors.white, fontWeight: '700', fontSize: size * 0.42 }}>{initial}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color={colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  fallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});