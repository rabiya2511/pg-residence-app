import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import * as DocumentPicker from 'expo-document-picker';

function UploadSlot({
  label,
  uri,
  onUpload,
  onRemove,
}: {
  label: string;
  uri: string | null;
  onUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <TouchableOpacity style={styles.uploadSlot} activeOpacity={0.8} onPress={onUpload}>
      {uri ? (
        <View>
          <Image source={{ uri }} style={styles.thumbnail} />
          <TouchableOpacity style={styles.removeBadge} onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.placeholderThumb}>
          <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
        </View>
      )}
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{label}</Text>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: uri ? '#D1FAE5' : '#FEF3C7' },
        ]}
      >
        <Text style={[typography.caption, { color: uri ? colors.success : colors.warning }]}>
          {uri ? 'Uploaded' : 'Pending'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AdminIdentityDocumentsScreen() {
  const navigation = useNavigation();
  const { residents, identityDocuments, setIdentityDocumentUri, clearIdentityDocumentUri, rooms } = useAdmin();
  const [uploadTarget, setUploadTarget] = useState<{ residentId: string; side: 'front' | 'back' } | null>(null);

  const takePhoto = async (residentId: string, side: 'front' | 'back') => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow camera access to capture an ID image.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIdentityDocumentUri(residentId, side, result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
    }
  };

  const browseFiles = async (residentId: string, side: 'front' | 'back') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIdentityDocumentUri(residentId, side, result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    }
  };

  const handleUpload = (residentId: string, side: 'front' | 'back') => {
    setUploadTarget({ residentId, side });
  };

  const handlePickOption = (option: 'camera' | 'files') => {
    if (!uploadTarget) return;
    const { residentId, side } = uploadTarget;
    setUploadTarget(null);
    if (option === 'camera') {
      takePhoto(residentId, side);
    } else {
      browseFiles(residentId, side);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Identity Documents</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {residents.map((resident) => {
          const doc = identityDocuments.find((d) => d.residentId === resident.id);
          const bothUploaded = !!doc?.frontUri && !!doc?.backUri;
          return (
            <View key={resident.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={[typography.bodyBold, { color: colors.text }]}>{resident.name}</Text>
                <View
                  style={[
                    styles.overallBadge,
                    { backgroundColor: bothUploaded ? '#D1FAE5' : '#FEE2E2' },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: bothUploaded ? colors.success : colors.error },
                    ]}
                  >
                    {bothUploaded ? 'Complete' : 'Incomplete'}
                  </Text>
                </View>
              </View>

              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {resident.phone}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {resident.email}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Room {rooms.find((r) => r.id === resident.roomId)?.roomNumber ?? '—'}
              </Text>

              <View style={styles.uploadRow}>
                <UploadSlot
                  label="Front Side"
                  uri={doc?.frontUri ?? null}
                  onUpload={() => handleUpload(resident.id, 'front')}
                  onRemove={() => clearIdentityDocumentUri(resident.id, 'front')}
                />
                <UploadSlot
                  label="Back Side"
                  uri={doc?.backUri ?? null}
                  onUpload={() => handleUpload(resident.id, 'back')}
                  onRemove={() => clearIdentityDocumentUri(resident.id, 'back')}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!uploadTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setUploadTarget(null)}
      >
        <TouchableOpacity
          style={styles.optionOverlay}
          activeOpacity={1}
          onPress={() => setUploadTarget(null)}
        >
          <View style={styles.optionSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
              {uploadTarget?.side === 'front' ? 'Upload Front Side' : 'Upload Back Side'}
            </Text>

            <TouchableOpacity style={styles.optionRow} onPress={() => handlePickOption('camera')}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={() => handlePickOption('files')}>
              <Ionicons name="folder-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                Browse Files
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCancel} onPress={() => setUploadTarget(null)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overallBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  uploadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  uploadSlot: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  thumbnail: {
    width: 80,
    height: 56,
    borderRadius: radius.sm,
  },
  placeholderThumb: {
    width: 80,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
  },
  optionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
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
  optionCancel: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
});