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
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';

// Computes a content hash for an image file so we can detect true duplicates
// (same photo picked twice) even though the camera/file picker gives each
// pick a different cache file path every time.
async function getImageHash(uri: string): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    console.log('[DupCheck] hash for', uri, '=', hash);
    return hash;
  } catch (err) {
    console.log('[DupCheck] FAILED to hash', uri, err);
    return null;
  }
}
export default function AdminPropertyFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { properties, addProperty, addPropertyImages, removePropertyImage } = useAdmin();

  const propertyId: string | undefined = route.params?.propertyId;
  const isEdit = !!propertyId;
  const existing = isEdit ? properties.find((p) => p.id === propertyId) : undefined;

  const [name, setName] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const images = existing?.images ?? [];

  // Filters out any candidate photo whose content hash matches a photo
  // already saved on this property, and returns only the genuinely new ones.
  const filterOutDuplicates = async (candidateUris: string[]): Promise<string[]> => {
    if (!existing) return candidateUris;

    const existingHashes = await Promise.all(existing.images.map(getImageHash));
    const existingHashSet = new Set(existingHashes.filter((h): h is string => h !== null));

    const uniqueUris: string[] = [];
    let duplicateCount = 0;

    for (const uri of candidateUris) {
      const hash = await getImageHash(uri);
      if (hash && existingHashSet.has(hash)) {
        duplicateCount++;
        continue;
      }
      if (hash) existingHashSet.add(hash); // also catch duplicates within the same batch
      uniqueUris.push(uri);
    }

    if (duplicateCount > 0) {
      Alert.alert(
        'Duplicate Photo Skipped',
        `${duplicateCount} photo${duplicateCount > 1 ? 's were' : ' was'} already in this property's gallery and skipped.`
      );
    }

    return uniqueUris;
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets?.length && existing) {
        setPickerVisible(false);
        setCheckingDuplicates(true);
        const uniqueUris = await filterOutDuplicates([result.assets[0].uri]);
        if (uniqueUris.length > 0) {
          addPropertyImages(existing.id, uniqueUris);
        }
        setCheckingDuplicates(false);
      } else {
        setPickerVisible(false);
      }
    } catch {
      Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
      setPickerVisible(false);
      setCheckingDuplicates(false);
    }
  };

  const browseFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets?.length && existing) {
        setPickerVisible(false);
        setCheckingDuplicates(true);
        const uniqueUris = await filterOutDuplicates(result.assets.map((a) => a.uri));
        if (uniqueUris.length > 0) {
          addPropertyImages(existing.id, uniqueUris);
        }
        setCheckingDuplicates(false);
      } else {
        setPickerVisible(false);
      }
    } catch {
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
      setPickerVisible(false);
      setCheckingDuplicates(false);
    }
  };

  const handleRemoveImage = (uri: string) => {
    if (!existing) return;
    Alert.alert('Remove Photo', 'Remove this photo from the property gallery?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePropertyImage(existing.id, uri) },
    ]);
  };

  const handleCreateProperty = () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a property name.');
      return;
    }
    const created = addProperty(name.trim());
    // Immediately drop into edit mode for the newly created property so the
    // admin can start adding photos right away, without a separate step.
    navigation.replace('AdminPropertyForm', { propertyId: created.id });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>
          {isEdit ? 'Property Photos' : 'Add Property'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!isEdit && (
            <View style={styles.field}>
              <Text style={[typography.caption, styles.label]}>Property Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Lokansh Aditya Men's PG"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}

          {isEdit && existing && (
            <>
              <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
                {existing.name}
              </Text>

              <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>
                Property Photos ({images.length})
              </Text>
              <View style={styles.imageGrid}>
                {images.map((uri) => (
                  <View key={uri} style={styles.imageSlot}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeBadge}
                      activeOpacity={0.8}
                      onPress={() => handleRemoveImage(uri)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addImageSlot}
                  activeOpacity={0.8}
                  onPress={() => setPickerVisible(true)}
                  disabled={checkingDuplicates}
                >
                  <Ionicons name={checkingDuplicates ? 'hourglass-outline' : 'camera-outline'} size={24} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    {checkingDuplicates ? 'Checking...' : 'Add Photo'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                These photos are visible to residents in their dashboard.
              </Text>
            </>
          )}

          {!isEdit && (
            <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleCreateProperty}>
              <Text style={[typography.button, { color: colors.white }]}>Create Property</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.optionOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.optionSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Add Property Photo
            </Text>
            <TouchableOpacity style={styles.optionRow} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={browseFiles}>
              <Ionicons name="folder-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                Browse Files (multiple)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancel} onPress={() => setPickerVisible(false)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
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
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageSlot: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageSlot: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  optionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionCancel: { alignItems: 'center', paddingTop: spacing.md },
});