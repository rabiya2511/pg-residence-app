import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useResident } from '../../context/ResidentContext';
import WhatsAppNotifyModal, { WhatsAppRecipient } from '../../components/admin/WhatsAppNotifyModal';

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { residentData } = useResident();
  const {
    amount = 0,
    month = '',
    paidOn = '',
    method = '',
    transactionId = '',
  } = route.params ?? {};

  const [downloading, setDownloading] = useState(false);
  const [whatsappVisible, setWhatsappVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWhatsappVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const receiptRows = [
    { label: 'Month', value: month },
    { label: 'Amount Paid', value: `₹${amount}` },
    { label: 'Payment Method', value: method },
    { label: 'Paid On', value: paidOn },
    { label: 'Transaction ID', value: transactionId },
  ];

  const invoiceRecipients: WhatsAppRecipient[] = [
    {
      id: residentData.name,
      name: residentData.name,
      message: `✅ Payment Received!\n\nHi ${residentData.name}, we've received your rent payment of ₹${amount} for ${month} via ${method}.\n\nTransaction ID: ${transactionId}\nPaid on: ${paidOn}\n\nYour invoice has been generated. — Lokansh Aditya PG Residency`,
    },
  ];

  const buildInvoiceHtml = () => `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #0F172A; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .sub { color: #64748B; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          td { padding: 10px 0; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
          td.label { color: #64748B; }
          td.value { text-align: right; font-weight: 600; }
          .badge { display: inline-block; background: #E3E8FB; color: #2143B4; padding: 4px 10px; border-radius: 999px; font-size: 12px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <h1>Payment Receipt</h1>
        <div class="sub">PG Residence App</div>
        <span class="badge">Paid</span>
        <table>
          ${receiptRows
            .map(
              (row) => `
            <tr>
              <td class="label">${row.label}</td>
              <td class="value">${row.value || '-'}</td>
            </tr>`
            )
            .join('')}
        </table>
      </body>
    </html>
  `;

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const { uri } = await Print.printToFileAsync({ html: buildInvoiceHtml() });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Invoice',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Invoice Ready', `Saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Download Failed', 'Something went wrong while generating the invoice. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        </View>
        <Text style={[typography.heading2, { color: colors.text, marginTop: spacing.lg }]}>
          Payment Successful
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs }]}>
          ₹{amount} has been paid successfully
        </Text>

        <View style={styles.receiptCard}>
          <View style={styles.receiptHeaderRow}>
            <Text style={[typography.heading3, { color: colors.text }]}>Receipt</Text>
            <View style={styles.statusBadge}>
              <Text style={[typography.caption, { color: colors.success }]}>Paid</Text>
            </View>
          </View>

          {receiptRows.map((row) => (
            <View key={row.label} style={styles.receiptRow}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{row.label}</Text>
              <Text style={[typography.bodyBold, { color: colors.text }]}>{row.value}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
                <Text style={[typography.button, { color: colors.primary, marginLeft: spacing.xs }]}>
                  Download Invoice
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Text style={[typography.button, { color: colors.white }]}>Done</Text>
        </TouchableOpacity>
      </View>

      <WhatsAppNotifyModal
        visible={whatsappVisible}
        onClose={() => setWhatsappVisible(false)}
        title="Invoice Sent"
        recipients={invoiceRecipients}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  footer: {
    padding: spacing.md,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});