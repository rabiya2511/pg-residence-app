import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { RESIDENT_COMPLAINT_CATEGORIES, MAX_COMPLAINT_PHOTOS } from '../../constants/complaintOptions';
import { useComplaints } from '../../context/ComplaintsContext';

export default function NewComplaintScreen() {
  const navigation = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const canSubmit = selectedCategory !== null && title.trim().length >= 3 && description.trim().length > 0;

  const { addComplaint } = useComplaints();

  const addPhoto = (uri?: string) => {
    if (uri) setPhotos((prev) => [...prev, uri].slice(0, MAX_COMPLAINT_PHOTOS));
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_COMPLAINT_PHOTOS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_COMPLAINT_PHOTOS} photos.`);
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission Needed', 'Allow camera access in your phone settings to take a photo.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!res.canceled) addPhoto(res.assets?.[0]?.uri);
    } catch (e: any) {
      console.warn('camera failed:', e?.message ?? e);
      Alert.alert('Camera Error', 'Could not open the camera.');
    }
  };

  // Choose a picture from the device's files (works without a gallery app or a Google account).
  const pickFromFiles = async () => {
    if (photos.length >= MAX_COMPLAINT_PHOTOS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_COMPLAINT_PHOTOS} photos.`);
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.length) addPhoto(res.assets[0].uri);
    } catch (e: any) {
      console.warn('files failed:', e?.message ?? e);
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    addComplaint(selectedCategory!, description.trim(), photos, title.trim());
    Alert.alert('Complaint Submitted', 'Your complaint has been logged. The PG team will review it shortly.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>New Complaint</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
          Category
        </Text>
        <View style={styles.categoryGrid}>
          {RESIDENT_COMPLAINT_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    typography.body,
                    { color: isSelected ? colors.white : colors.text },
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Title
        </Text>
        <TextInput
          style={styles.titleInput}
          placeholder="Short summary, e.g. Fan making noise"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Description
        </Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={5}
          placeholder="Describe the issue in detail..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Photos (optional, up to {MAX_COMPLAINT_PHOTOS})
        </Text>
        <View style={styles.photoRow}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => setPhotos((prev) => prev.filter((p) => p !== uri))}
                hitSlop={6}
              >
                <Ionicons name="close" size={14} color={colors.white} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {photos.length < MAX_COMPLAINT_PHOTOS && (
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={18} color={colors.primary} />
              <Text style={styles.photoBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={pickFromFiles} activeOpacity={0.8}>
              <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
              <Text style={styles.photoBtnText}>Files</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <Text style={[typography.button, { color: colors.white }]}>Submit Complaint</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: { padding: spacing.xs },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  titleInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 120,
    fontSize: 15,
    color: colors.text,
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoWrap: { width: 84, height: 84 },
  photo: { width: 84, height: 84, borderRadius: radius.md },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  photoBtnText: { color: colors.primary, fontWeight: '600', marginLeft: 6 },
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
  submitButtonDisabled: { backgroundColor: colors.border },
});