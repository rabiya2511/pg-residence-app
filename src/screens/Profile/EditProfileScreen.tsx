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
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useResident } from '../../context/ResidentContext';

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

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { residentData, updateResidentData } = useResident();

  const [name, setName] = useState(residentData.name);
  const [phone, setPhone] = useState(residentData.phone);
  const [email, setEmail] = useState(residentData.email);
  const [dob, setDob] = useState(residentData.dob);
  const [gender, setGender] = useState(residentData.gender);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(residentData.profileImageUri);
  const [occupation, setOccupation] = useState(residentData.occupation);
  const [occupationAddress, setOccupationAddress] = useState(residentData.occupationAddress);
  const [nativePlace, setNativePlace] = useState(residentData.nativePlace);
  const [emergencyContact1, setEmergencyContact1] = useState(residentData.emergencyContact1);
  const [emergencyContact2, setEmergencyContact2] = useState(residentData.emergencyContact2);
  const [companyIdProofUri, setCompanyIdProofUri] = useState<string | null>(residentData.companyIdProofUri);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [idProofOptionsVisible, setIdProofOptionsVisible] = useState(false);

  // Browses local files on disk for an image, instead of the system Photo
  // Picker (ImagePicker.launchImageLibraryAsync), which crashes on emulators
  // that lack Google Play Services / the Photo Picker activity.
  const handleBrowseFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        setProfileImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    } finally {
      setPhotoOptionsVisible(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.length) {
        setProfileImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
    } finally {
      setPhotoOptionsVisible(false);
    }
  };

  // Same file-browser-first pattern for the Company ID Proof upload —
  // avoids the same Photo Picker crash, and a company ID card is more
  // likely to already exist as a saved file/scan than to be photographed
  // fresh, so this is offered as its own upload control.
  const handleBrowseIdProofFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        setCompanyIdProofUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Unable to Open Files', 'Could not open the file browser on this device.');
    } finally {
      setIdProofOptionsVisible(false);
    }
  };

  const handleTakeIdProofPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Please allow camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets?.length) {
        setCompanyIdProofUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera Unavailable', 'Could not open the camera on this device.');
    } finally {
      setIdProofOptionsVisible(false);
    }
  };

  const removeIdProof = () => {
    Alert.alert('Remove Company ID Proof', 'Remove the uploaded document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setCompanyIdProofUri(null) },
    ]);
  };

  const handleSave = () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      Alert.alert('Missing Information', 'Name, phone, and email cannot be empty.');
      return;
    }

    updateResidentData({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      dob: dob.trim(),
      gender: gender.trim(),
      profileImageUri,
      occupation: occupation.trim(),
      occupationAddress: occupationAddress.trim(),
      nativePlace: nativePlace.trim(),
      emergencyContact1: emergencyContact1.trim(),
      emergencyContact2: emergencyContact2.trim(),
      companyIdProofUri,
    });

    Alert.alert('Profile Updated', 'Your changes have been saved.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Edit Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrap}
              activeOpacity={0.8}
              onPress={() => setPhotoOptionsVisible(true)}
            >
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color={colors.white} />
              </View>
            </TouchableOpacity>
            <Text style={[typography.caption, { color: colors.primary, marginTop: spacing.xs }]}>
              Change Photo
            </Text>
          </View>

          <Field label="Full Name" value={name} onChangeText={setName} placeholder="Full name" />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" />
          <Field label="Date of Birth" value={dob} onChangeText={setDob} placeholder="e.g. 15 Aug 1999" />
          <Field label="Gender" value={gender} onChangeText={setGender} placeholder="Gender" />
          <Field label="Occupation" value={occupation} onChangeText={setOccupation} placeholder="e.g. Software Engineer" />
          <Field label="Occupation Address" value={occupationAddress} onChangeText={setOccupationAddress} placeholder="Office / work address" />
          <Field label="Native Place" value={nativePlace} onChangeText={setNativePlace} placeholder="e.g. Hyderabad, Telangana" />
          <Field
            label="Emergency Contact 1"
            value={emergencyContact1}
            onChangeText={setEmergencyContact1}
            placeholder="+91 XXXXX XXXXX"
            keyboardType="phone-pad"
          />
          <Field
            label="Emergency Contact 2"
            value={emergencyContact2}
            onChangeText={setEmergencyContact2}
            placeholder="+91 XXXXX XXXXX"
            keyboardType="phone-pad"
          />

          <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Company ID Proof</Text>
          <View style={styles.idProofRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIdProofOptionsVisible(true)}
              style={styles.idProofTapArea}
            >
              {companyIdProofUri ? (
                <Image source={{ uri: companyIdProofUri }} style={styles.idProofThumbnail} />
              ) : (
                <View style={styles.idProofPlaceholder}>
                  <Ionicons name="card-outline" size={22} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    Upload ID
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {companyIdProofUri && (
              <TouchableOpacity
                style={styles.idProofRemoveBadge}
                activeOpacity={0.8}
                onPress={removeIdProof}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={14} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
            <Text style={[typography.button, { color: colors.white }]}>Save Changes</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={photoOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.optionOverlay}
          activeOpacity={1}
          onPress={() => setPhotoOptionsVisible(false)}
        >
          <View style={styles.optionSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Profile Photo
            </Text>
            <TouchableOpacity style={styles.optionRow} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={handleBrowseFiles}>
              <Ionicons name="folder-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Browse Files</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancel} onPress={() => setPhotoOptionsVisible(false)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={idProofOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIdProofOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.optionOverlay}
          activeOpacity={1}
          onPress={() => setIdProofOptionsVisible(false)}
        >
          <View style={styles.optionSheet}>
            <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
              Company ID Proof
            </Text>
            <TouchableOpacity style={styles.optionRow} onPress={handleTakeIdProofPhoto}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={handleBrowseIdProofFiles}>
              <Ionicons name="folder-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>Browse Files</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancel} onPress={() => setIdProofOptionsVisible(false)}>
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  field: {
    marginBottom: spacing.md,
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
  idProofRow: {
    marginBottom: spacing.md,
  },
  idProofTapArea: {
    alignSelf: 'flex-start',
  },
  idProofThumbnail: {
    width: 100,
    height: 70,
    borderRadius: radius.sm,
  },
  idProofPlaceholder: {
    width: 100,
    height: 70,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idProofRemoveBadge: {
    position: 'absolute',
    top: -6,
    left: 88,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
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