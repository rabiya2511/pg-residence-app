import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { faqs, supportContact } from '../../constants/mockData';
import SectionHeader from '../../components/common/SectionHeader';
import FAQAccordionItem from '../../components/help/FAQAccordionItem';

export default function HelpSupportScreen() {
  const navigation = useNavigation<any>();

    const handleCall = () => {
    Linking.openURL(`tel:${supportContact.phone}`).catch(() => {
        Alert.alert('Unable to Call', `Please dial ${supportContact.phone} manually.`);
    });
    };

    const handleEmail = () => {
    Linking.openURL(`mailto:${supportContact.email}`).catch(() => {
        Alert.alert('No Email App Found', `You can reach us at ${supportContact.email}`);
    });
};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.heading3, { color: colors.text }]}>Help & Support</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Contact options */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactCard} activeOpacity={0.8} onPress={handleCall}>
            <Ionicons name="call-outline" size={22} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} activeOpacity={0.8} onPress={handleEmail}>
            <Ionicons name="mail-outline" size={22} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SupportChat')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.text, marginTop: 4 }]}>Chat</Text>
          </TouchableOpacity>
        </View>

        <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
          Warden: {supportContact.wardenName}
        </Text>

        {/* FAQs */}
        <View style={styles.section}>
          <SectionHeader title="Frequently Asked Questions" />
          {faqs.map((faq) => (
            <FAQAccordionItem key={faq.id} faq={faq} />
          ))}
        </View>
      </ScrollView>
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
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    marginTop: spacing.lg,
  },
  contactRowFix: {},
});