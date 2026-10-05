import React, { useRef, useState } from 'react';
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
import { PropertyAddress, HOUSE_GUIDELINE_PRESETS } from '../../constants/mockData';

async function getImageHash(uri: string): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    return hash;
  } catch {
    return null;
  }
}

const GUIDELINE_PRESET_KEYS = ['Co-Living', 'Executive', 'Student'] as const;

export default function AdminPropertyFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    properties,
    addProperty,
    addPropertyImages,
    removePropertyImage,
    updatePropertyDetails,
    generateRoomsForProperty,
  } = useAdmin();

  const propertyId: string | undefined = route.params?.propertyId;
  const isEdit = !!propertyId;
  const existing = isEdit ? properties.find((p) => p.id === propertyId) : undefined;

  // ---- Add-mode fields ----
  const [name, setName] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [city, setCity] = useState('');
  const [floors, setFloors] = useState('4');
  const [branchManager, setBranchManager] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [standardRent, setStandardRent] = useState('');
  const [autoGenRooms, setAutoGenRooms] = useState('10');
  const [googleReviewLink, setGoogleReviewLink] = useState('');
  const [selectedGuidelinePreset, setSelectedGuidelinePreset] = useState<
    (typeof GUIDELINE_PRESET_KEYS)[number] | null
  >(null);
  const [houseGuidelines, setHouseGuidelines] = useState('');
  const [showOptionalConfig, setShowOptionalConfig] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');

  // ---- Edit-mode fields ----
  const [editedStreetNo, setEditedStreetNo] = useState(existing?.addressDetails?.streetNo ?? '');
  const [editedCity, setEditedCity] = useState(existing?.addressDetails?.city ?? '');
  const [editedBranchManager, setEditedBranchManager] = useState(existing?.branchManager ?? '');
  const [editedContactPhone, setEditedContactPhone] = useState(existing?.contactPhone ?? '');
  const [editedStandardRent, setEditedStandardRent] = useState(
    existing?.standardRent ? String(existing.standardRent) : ''
  );
  const [editedGoogleReviewLink, setEditedGoogleReviewLink] = useState(existing?.googleReviewLink ?? '');
  const [editedHouseGuidelines, setEditedHouseGuidelines] = useState(existing?.houseGuidelines ?? '');
  const [editedUpiId, setEditedUpiId] = useState(existing?.upiId ?? '');
  const [editedWhatsappGroupLink, setEditedWhatsappGroupLink] = useState(existing?.whatsappGroupLink ?? '');

  const [pickerVisible, setPickerVisible] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const isCreatingRef = useRef(false);
  const images = existing?.images ?? [];

  const applyGuidelinePreset = (key: (typeof GUIDELINE_PRESET_KEYS)[number]) => {
    setSelectedGuidelinePreset(key);
    setHouseGuidelines(HOUSE_GUIDELINE_PRESETS[key]);
  };

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.length) {
      setLogoUri(result.assets[0].uri);
    }
  };

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
      if (hash) existingHashSet.add(hash);
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
        if (uniqueUris.length > 0) addPropertyImages(existing.id, uniqueUris);
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
        if (uniqueUris.length > 0) addPropertyImages(existing.id, uniqueUris);
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
    if (!fullAddress.trim()) {
      Alert.alert('Missing Address', 'Please enter the full address.');
      return;
    }
    if (isCreatingRef.current) return;
      isCreatingRef.current = true;
    const floorsNum = Number(floors) || 0;
    const roomsNum = Number(autoGenRooms) || 0;
    const rentNum = Number(standardRent) || undefined;
    
    const addressDetails: PropertyAddress = {
      streetNo: fullAddress.trim(),
      landmark: '',
      city: city.trim(),
      pinCode: '',
    };

    const created = addProperty(name.trim(), {
      addressDetails,
      floors: floorsNum || undefined,
      branchManager: branchManager.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      standardRent: rentNum,
      googleReviewLink: googleReviewLink.trim() || undefined,
      houseGuidelines: houseGuidelines.trim() || undefined,
      logoUri,
      upiId: upiId.trim() || null,
      whatsappGroupLink: whatsappGroupLink.trim() || null,
    });

    if (floorsNum > 0 && roomsNum > 0) {
      generateRoomsForProperty(created.id, floorsNum, roomsNum, 2);
    }

    navigation.replace('AdminPropertyForm', { propertyId: created.id });
  };

  const handleSaveDetails = () => {
    if (!existing) return;
    updatePropertyDetails(existing.id, {
      addressDetails: {
        streetNo: editedStreetNo.trim(),
        landmark: existing.addressDetails?.landmark ?? '',
        city: editedCity.trim(),
        pinCode: existing.addressDetails?.pinCode ?? '',
      },
      branchManager: editedBranchManager.trim(),
      contactPhone: editedContactPhone.trim(),
      standardRent: Number(editedStandardRent) || undefined,
      googleReviewLink: editedGoogleReviewLink.trim(),
      houseGuidelines: editedHouseGuidelines.trim(),
      upiId: editedUpiId.trim() || null,
      whatsappGroupLink: editedWhatsappGroupLink.trim() || null,
    });
    Alert.alert('Property Updated', 'Changes have been saved.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>
          {isEdit ? 'Property Details' : 'Register New Property Branch'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!isEdit && (
            <>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
                Add a new hostel or PG branch under your multi-property portfolio.
              </Text>

              <Field label="Property Name *" value={name} onChangeText={setName} placeholder="e.g. Lokansh Aditya Ladies PG" />
              <Field label="Full Address *" value={fullAddress} onChangeText={setFullAddress} placeholder="e.g. 12 MG Road, Near City Mall" />

              <View style={styles.row}>
                <Field label="City" value={city} onChangeText={setCity} placeholder="Bangalore" containerStyle={styles.rowField} />
                <Field label="Floors" value={floors} onChangeText={setFloors} placeholder="4" keyboardType="numeric" containerStyle={styles.rowField} />
              </View>

              <View style={styles.row}>
                <Field label="Branch Manager" value={branchManager} onChangeText={setBranchManager} placeholder="Name" containerStyle={styles.rowField} />
                <Field label="Contact Phone" value={contactPhone} onChangeText={setContactPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" containerStyle={styles.rowField} />
              </View>

              <View style={styles.row}>
                <Field label="Standard Rent (₹)" value={standardRent} onChangeText={setStandardRent} placeholder="12000" keyboardType="numeric" containerStyle={styles.rowField} />
                <Field label="Auto Gen Rooms" value={autoGenRooms} onChangeText={setAutoGenRooms} placeholder="10" keyboardType="numeric" containerStyle={styles.rowField} />
              </View>

              <Field
                label=""
                value={googleReviewLink}
                onChangeText={setGoogleReviewLink}
                placeholder="Google Review Link"
                icon="star"
              />

              <View style={styles.guidelinesCard}>
                <View style={styles.guidelinesHeaderRow}>
                  <View style={styles.guidelinesTitleRow}>
                    <Ionicons name="hammer-outline" size={16} color={colors.warning} />
                    <Text style={[typography.bodyBold, { color: colors.warning, marginLeft: spacing.xs }]}>
                      Standard House Guidelines
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setSelectedGuidelinePreset(null); setHouseGuidelines(''); }}>
                    <Text style={[typography.caption, { color: colors.warning }]}>Reset Default</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                  Choose a preset guideline template or enter custom rules:
                </Text>
                <View style={styles.presetRow}>
                  {GUIDELINE_PRESET_KEYS.map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.presetChip, selectedGuidelinePreset === key && styles.presetChipActive]}
                      onPress={() => applyGuidelinePreset(key)}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: selectedGuidelinePreset === key ? colors.white : colors.text },
                        ]}
                      >
                        {key}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.guidelinesInput}
                  value={houseGuidelines}
                  onChangeText={setHouseGuidelines}
                  placeholder="Enter custom house rules..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={5}
                />
              </View>

              <TouchableOpacity
                style={styles.optionalToggle}
                onPress={() => setShowOptionalConfig(!showOptionalConfig)}
              >
                <Ionicons
                  name={showOptionalConfig ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.warning}
                />
                <Text style={[typography.caption, { color: colors.warning, marginLeft: spacing.xs }]}>
                  Configure Logo, UPI & WhatsApp Group (Optional)
                </Text>
              </TouchableOpacity>

              {showOptionalConfig && (
                <View style={styles.optionalSection}>
                  <TouchableOpacity style={styles.logoPicker} activeOpacity={0.8} onPress={pickLogo}>
                    {logoUri ? (
                      <Image source={{ uri: logoUri }} style={styles.logoPreview} />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                          Upload Property Logo
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Field label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="yourname@okhdfcbank" />
                  <Field
                    label="WhatsApp Group Link"
                    value={whatsappGroupLink}
                    onChangeText={setWhatsappGroupLink}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </View>
              )}

              <View style={styles.footerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createButton} activeOpacity={0.85} onPress={handleCreateProperty}>
                  <Text style={[typography.button, { color: colors.white }]}>Create Property</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isEdit && existing && (
            <>
              <Text style={[typography.heading3, { color: colors.text, marginBottom: spacing.sm }]}>
                {existing.name}
              </Text>

              <Field label="Street No. / Address Line" value={editedStreetNo} onChangeText={setEditedStreetNo} placeholder="e.g. 12 MG Road" />
              <Field label="City" value={editedCity} onChangeText={setEditedCity} placeholder="e.g. Bengaluru" />
              <Field label="Branch Manager" value={editedBranchManager} onChangeText={setEditedBranchManager} placeholder="Name" />
              <Field label="Contact Phone" value={editedContactPhone} onChangeText={setEditedContactPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" />
              <Field label="Standard Rent (₹)" value={editedStandardRent} onChangeText={setEditedStandardRent} placeholder="12000" keyboardType="numeric" />
              <Field label="Google Review Link" value={editedGoogleReviewLink} onChangeText={setEditedGoogleReviewLink} placeholder="https://g.page/..." />
              <Field label="UPI ID" value={editedUpiId} onChangeText={setEditedUpiId} placeholder="yourname@okhdfcbank" />
              <Field label="WhatsApp Group Link" value={editedWhatsappGroupLink} onChangeText={setEditedWhatsappGroupLink} placeholder="https://chat.whatsapp.com/..." />

              <View style={styles.field}>
                <Text style={[typography.caption, styles.label]}>House Guidelines</Text>
                <TextInput
                  style={styles.guidelinesInput}
                  value={editedHouseGuidelines}
                  onChangeText={setEditedHouseGuidelines}
                  placeholder="House rules for this property..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={5}
                />
              </View>

              <TouchableOpacity style={styles.saveAddressButton} activeOpacity={0.85} onPress={handleSaveDetails}>
                <Text style={[typography.caption, { color: colors.white }]}>Save Details</Text>
              </TouchableOpacity>

              <Text style={[typography.caption, styles.label, { marginTop: spacing.lg }]}>
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

              <TouchableOpacity
                style={styles.manageRoomsButton}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('AdminPropertyRooms', { propertyId: existing.id })}
              >
                <Ionicons name="bed-outline" size={18} color={colors.primary} />
                <Text style={[typography.button, { color: colors.primary, marginLeft: spacing.xs }]}>
                  Manage Floors & Rooms
                </Text>
              </TouchableOpacity>
            </>
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  icon,
  containerStyle,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: any;
}) {
  return (
    <View style={[styles.field, containerStyle]}>
      {!!label && <Text style={[typography.caption, styles.label]}>{label}</Text>}
      <View style={icon ? styles.inputWithIconWrap : undefined}>
        {icon && <Ionicons name={icon} size={16} color={colors.warning} style={styles.inputIcon} />}
        <TextInput
          style={[styles.input, icon && styles.inputWithIcon]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType ?? 'default'}
        />
      </View>
    </View>
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
  inputWithIconWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  inputWithIcon: {
    paddingLeft: spacing.xl + spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowField: {
    flex: 1,
  },
  guidelinesCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  guidelinesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  guidelinesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  guidelinesInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  optionalSection: {
    marginBottom: spacing.md,
  },
  logoPicker: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  saveAddressButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  manageRoomsButton: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
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