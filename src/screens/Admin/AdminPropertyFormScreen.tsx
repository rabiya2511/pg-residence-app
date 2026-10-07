import React, { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
type PresetKey = (typeof GUIDELINE_PRESET_KEYS)[number];

export default function AdminPropertyFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
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

  // ---- One set of fields, used for both "register" and "edit" ----
  const [name, setName] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [city, setCity] = useState('');
  const [floors, setFloors] = useState(isEdit ? '' : '4');
  const [branchManager, setBranchManager] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [standardRent, setStandardRent] = useState('');
  const [autoGenRooms, setAutoGenRooms] = useState('10'); // register only
  const [googleReviewLink, setGoogleReviewLink] = useState('');
  const [selectedGuidelinePreset, setSelectedGuidelinePreset] = useState<PresetKey | null>(null);
  const [houseGuidelines, setHouseGuidelines] = useState('');
  const [showOptionalConfig, setShowOptionalConfig] = useState(isEdit);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');

  const [pickerVisible, setPickerVisible] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const isCreatingRef = useRef(false);
  const images = existing?.images ?? [];

  // Fill the form with the saved values once the property has loaded (only once,
  // so it never overwrites what the admin is typing).
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!existing || loadedRef.current) return;
    loadedRef.current = true;
    setName(existing.name ?? '');
    setFullAddress(existing.addressDetails?.streetNo ?? '');
    setCity(existing.addressDetails?.city ?? '');
    setFloors(existing.floors ? String(existing.floors) : '');
    setBranchManager(existing.branchManager ?? '');
    setContactPhone(existing.contactPhone ?? '');
    setStandardRent(existing.standardRent ? String(existing.standardRent) : '');
    setGoogleReviewLink(existing.googleReviewLink ?? '');
    setHouseGuidelines(existing.houseGuidelines ?? '');
    setSelectedGuidelinePreset(
      GUIDELINE_PRESET_KEYS.find((k) => HOUSE_GUIDELINE_PRESETS[k] === existing.houseGuidelines) ?? null
    );
    setLogoUri(existing.logoUri ?? null);
    setUpiId(existing.upiId ?? '');
    setWhatsappGroupLink(existing.whatsappGroupLink ?? '');
  }, [existing]);

  const applyGuidelinePreset = (key: PresetKey) => {
    setSelectedGuidelinePreset(key);
    setHouseGuidelines(HOUSE_GUIDELINE_PRESETS[key]);
  };

  const pickLogo = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.length) {
      setLogoUri(result.assets[0].uri);
    }
  } catch {
    // The system photo picker is missing (common on emulators): fall back to the file browser.
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length) {
        setLogoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Unable to Open Gallery', 'Could not open the photo picker on this device.');
    }
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

  const validate = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a property name.');
      return false;
    }
    if (!fullAddress.trim()) {
      Alert.alert('Missing Address', 'Please enter the full address.');
      return false;
    }
    return true;
  };

  const buildAddress = (): PropertyAddress => ({
    streetNo: fullAddress.trim(),
    landmark: existing?.addressDetails?.landmark ?? '',
    city: city.trim(),
    pinCode: existing?.addressDetails?.pinCode ?? '',
  });

  const handleCreateProperty = () => {
    if (!validate()) return;
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;

    const floorsNum = Number(floors) || 0;
    const roomsNum = Number(autoGenRooms) || 0;
    const rentNum = Number(standardRent) || undefined;

    const created = addProperty(name.trim(), {
      addressDetails: buildAddress(),
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
    if (!validate()) return;
    updatePropertyDetails(existing.id, {
      name: name.trim(),
      addressDetails: buildAddress(),
      floors: Number(floors) || undefined,
      branchManager: branchManager.trim(),
      contactPhone: contactPhone.trim(),
      standardRent: Number(standardRent) || undefined,
      googleReviewLink: googleReviewLink.trim(),
      houseGuidelines: houseGuidelines.trim(),
      logoUri,
      upiId: upiId.trim() || null,
      whatsappGroupLink: whatsappGroupLink.trim() || null,
    });
    Alert.alert('Property Updated', 'Changes have been saved.');
  };

  const formReady = !isEdit || !!existing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>
          {isEdit ? 'Edit Property' : 'Register New Property'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!formReady ? (
            <Text style={[typography.body, { color: colors.text, textAlign: 'center', marginTop: spacing.xl }]}>
              Loading property...
            </Text>
          ) : (
            <>
              {!isEdit && (
                <Text style={[typography.caption, styles.intro]}>
                  Add a new hostel or PG branch under your multi-property portfolio.
                </Text>
              )}

              {/* ───── Basic details ───── */}
              <Section icon="business-outline" title="Basic Details">
                <Field label="Property Name *" value={name} onChangeText={setName} placeholder="e.g. Lokansh Aditya Ladies PG" />
                <Field label="Full Address *" value={fullAddress} onChangeText={setFullAddress} placeholder="e.g. 12 MG Road, Near City Mall" />
                <View style={styles.row}>
                  <Field label="City" value={city} onChangeText={setCity} placeholder="Bangalore" containerStyle={styles.rowField} />
                  <Field label="Floors" value={floors} onChangeText={setFloors} placeholder="4" keyboardType="numeric" containerStyle={styles.rowField} />
                </View>
              </Section>

              {/* ───── Contact & pricing ───── */}
              <Section icon="call-outline" title="Contact & Pricing">
                <View style={styles.row}>
                  <Field label="Branch Manager" value={branchManager} onChangeText={setBranchManager} placeholder="Name" containerStyle={styles.rowField} />
                  <Field label="Contact Phone" value={contactPhone} onChangeText={setContactPhone} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" containerStyle={styles.rowField} />
                </View>
                <View style={styles.row}>
                  <Field label="Standard Rent (₹)" value={standardRent} onChangeText={setStandardRent} placeholder="12000" keyboardType="numeric" containerStyle={styles.rowField} />
                  {!isEdit && (
                    <Field label="Auto Gen Rooms" value={autoGenRooms} onChangeText={setAutoGenRooms} placeholder="10" keyboardType="numeric" containerStyle={styles.rowField} />
                  )}
                </View>
                <Field
                  label="Google Review Link"
                  value={googleReviewLink}
                  onChangeText={setGoogleReviewLink}
                  placeholder="https://g.page/..."
                  icon="star"
                />
              </Section>

              {/* ───── House guidelines ───── */}
              <Section
                icon="document-text-outline"
                title="House Guidelines"
                right={
                  <TouchableOpacity
                    onPress={() => { setSelectedGuidelinePreset(null); setHouseGuidelines(''); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[typography.caption, { color: colors.primary }]}>Clear</Text>
                  </TouchableOpacity>
                }
              >
                <Text style={[typography.caption, styles.hint]}>
                  Pick a preset template, then edit it or write your own rules.
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
              </Section>

              {/* ───── Branding & payments (collapsible) ───── */}
              <Section
                icon="wallet-outline"
                title="Logo, UPI & WhatsApp"
                collapsible
                open={showOptionalConfig}
                onToggle={() => setShowOptionalConfig(!showOptionalConfig)}
              >
                <Text style={[typography.caption, styles.label]}>Property Logo</Text>
                <TouchableOpacity style={styles.logoPicker} activeOpacity={0.8} onPress={pickLogo}>
                  {logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logoPreview} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                      <Text style={[typography.caption, styles.tileText]}>Upload Logo</Text>
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
              </Section>

              {/* ───── Photos + rooms (edit mode only) ───── */}
              {isEdit && existing && (
                <>
                  <Section icon="images-outline" title={`Property Photos (${images.length})`}>
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
                        <Ionicons
                          name={checkingDuplicates ? 'hourglass-outline' : 'camera-outline'}
                          size={24}
                          color={colors.textMuted}
                        />
                        <Text style={[typography.caption, styles.tileText]}>
                          {checkingDuplicates ? 'Checking...' : 'Add Photo'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[typography.caption, styles.hint, { marginTop: spacing.sm }]}>
                      These photos are visible to residents in their dashboard.
                    </Text>
                  </Section>

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
            </>
          )}
        </ScrollView>

        {/* Fixed action bar */}
        {formReady && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={() => navigation.goBack()}>
              <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={isEdit ? handleSaveDetails : handleCreateProperty}
            >
              <Text style={[typography.button, { color: colors.white }]}>
                {isEdit ? 'Save Changes' : 'Create Property'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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

// A white card with an icon + title, used to group related fields.
function Section({
  icon,
  title,
  children,
  right,
  collapsible,
  open = true,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const header = (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={[typography.bodyBold, { color: colors.text, flex: 1 }]}>{title}</Text>
      {right}
      {collapsible && (
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      )}
    </View>
  );

  return (
    <View style={styles.sectionCard}>
      {collapsible ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onToggle}>
          {header}
        </TouchableOpacity>
      ) : (
        header
      )}
      {(!collapsible || open) && <View style={styles.sectionBody}>{children}</View>}
    </View>
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
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  intro: { color: colors.text, marginBottom: spacing.md },

  // Section cards
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionBody: {
    marginTop: spacing.md,
  },

  // Fields
  field: { marginBottom: spacing.md },
  label: { color: colors.textMuted, marginBottom: spacing.xs },
  hint: { color: colors.textMuted, marginBottom: spacing.sm },
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
  rowField: { flex: 1 },

  // Guidelines
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  guidelinesInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: 'top',
  },

  // Upload tiles
  logoPicker: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  logoPreview: { width: '100%', height: '100%' },
  tileText: {
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
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
  image: { width: '100%', height: '100%' },
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
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageRoomsButton: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Fixed action bar
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Photo picker sheet
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