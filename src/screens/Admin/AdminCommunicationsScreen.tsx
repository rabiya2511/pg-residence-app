import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useAdmin } from '../../context/AdminContext';
import { useCommunications, CommunicationMessage, MessageStatus } from '../../context/CommunicationsContext';
import {
  MessageCategory,
  Channel,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CHANNEL_LABELS,
  PLACEHOLDER_GROUPS,
  MessageTemplate,
} from '../../constants/communicationsData';

type TabKey = 'dashboard' | 'new' | 'templates' | 'scheduled' | 'sent' | 'drafts' | 'failed' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'new', label: 'New Message' },
  { key: 'templates', label: 'Templates' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'failed', label: 'Failed' },
  { key: 'history', label: 'History' },
];

const channelIcon = (c: Channel): any =>
  c === 'WhatsApp' ? 'logo-whatsapp' : c === 'SMS' ? 'chatbox-outline' : c === 'Email' ? 'mail-outline' : 'notifications-outline';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, { color: active ? colors.white : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatBox({ label, value, icon, color, onPress }: { label: string; value: number; icon: any; color: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.statBox} activeOpacity={0.85} onPress={onPress} disabled={!onPress}>
      <View style={styles.statTopRow}>
        <View style={[styles.statIconWrap, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        {onPress && <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />}
      </View>
      <Text style={[typography.heading2, { color: colors.text, marginTop: spacing.sm }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const STATUS_COLORS: Record<MessageStatus, string> = {
  Sent: colors.success,
  Scheduled: colors.warning,
  Draft: colors.textMuted,
  Failed: colors.error,
};

function MessageListCard({
  msg,
  onDelete,
  onSendNow,
  onRetry,
  onEditDraft,
}: {
  msg: CommunicationMessage;
  onDelete: () => void;
  onSendNow?: () => void;
  onRetry?: () => void;
  onEditDraft?: () => void;
}) {
  return (
    <View style={styles.msgCard}>
      <View style={styles.msgTopRow}>
        <View style={styles.msgAvatar}>
          <Ionicons name={channelIcon(msg.channel)} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>{msg.residentName}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {msg.roomLabel} · {CHANNEL_LABELS[msg.channel]} ·{' '}
            {new Date(msg.scheduledFor ?? msg.sentAt ?? msg.createdAt).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[msg.status]}20` }]}>
          <Text style={[typography.caption, { color: STATUS_COLORS[msg.status], fontWeight: '700' }]}>{msg.status}</Text>
        </View>
      </View>

      {!!msg.subject && (
        <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.sm }]} numberOfLines={1}>
          {msg.subject}
        </Text>
      )}
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
        {msg.body}
      </Text>

      {msg.status === 'Failed' && !!msg.failReason && (
        <Text style={[typography.caption, { color: colors.error, marginTop: 4 }]}>{msg.failReason}</Text>
      )}

      <View style={styles.msgFooterRow}>
        {msg.status === 'Sent' && <Text style={[typography.caption, { color: colors.textMuted }]}>Sent by: {msg.sentBy}</Text>}
        <View style={{ flex: 1 }} />
        {onSendNow && (
          <TouchableOpacity style={styles.inlineAction} onPress={onSendNow}>
            <Text style={[typography.caption, { color: colors.success, fontWeight: '700' }]}>Send Now</Text>
          </TouchableOpacity>
        )}
        {onRetry && (
          <TouchableOpacity style={styles.inlineAction} onPress={onRetry}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Retry</Text>
          </TouchableOpacity>
        )}
        {onEditDraft && (
          <TouchableOpacity style={styles.inlineAction} onPress={onEditDraft}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Edit</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.inlineAction} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminCommunicationsScreen() {
  const navigation = useNavigation<any>();
  const { residents, rooms, properties } = useAdmin();
  const {
    templates,
    messages,
    loading,
    addTemplate,
    deleteTemplate,
    resolvePlaceholders,
    sendNow,
    scheduleMessage,
    saveDraft,
    sendScheduledNow,
    retryFailed,
    deleteMessage,
  } = useCommunications();

  const [tab, setTab] = useState<TabKey>('dashboard');
  const [busy, setBusy] = useState(false);

  // ----- New Message compose state -----
  const [residentPickerVisible, setResidentPickerVisible] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [category, setCategory] = useState<MessageCategory>('Welcome');
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
  const [pickerStep, setPickerStep] = useState<null | 'date' | 'time'>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [placeholderGroup, setPlaceholderGroup] = useState<'All' | string>('All');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // ----- Templates tab state -----
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<MessageCategory | 'All'>('All');
  const [newTemplateModal, setNewTemplateModal] = useState(false);
  const [ntCategory, setNtCategory] = useState<MessageCategory>('Welcome');
  const [ntName, setNtName] = useState('');
  const [ntSubject, setNtSubject] = useState('');
  const [ntBody, setNtBody] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);

  const selectedResident = residents.find((r) => r.id === selectedResidentId);
  const property = properties[0];

  const fail = (title: string, e: any) => Alert.alert(title, e?.message ?? 'Something went wrong. Please try again.');

  const resetCompose = () => {
    setSelectedResidentId(null);
    setSelectedTemplateId(null);
    setSubject('');
    setBody('');
    setDeliveryMode('now');
    setScheduleDate(new Date(Date.now() + 60 * 60 * 1000));
    setPickerStep(null);
    setEditingDraftId(null);
  };

  const handleUseTemplate = (t: MessageTemplate) => {
    setCategory(t.category);
    setSelectedTemplateId(t.id);
    setSubject(t.subject);
    setBody(t.body);
    setTab('new');
  };

  const insertPlaceholder = (token: string) => setBody((prev) => (prev ? `${prev} ${token}` : token));

  const handlePreview = () => {
    if (!selectedResidentId) {
      Alert.alert('Select a Resident', 'Please choose a recipient first.');
      return;
    }
    setPreviewVisible(true);
  };

  const validateCompose = (): boolean => {
    if (!selectedResidentId) {
      Alert.alert('Select a Resident', 'Please choose a recipient first.');
      return false;
    }
    if (!body.trim()) {
      Alert.alert('Empty Message', 'Please write a message before continuing.');
      return false;
    }
    return true;
  };

  const handleSaveAsTemplate = async () => {
    if (!body.trim()) {
      Alert.alert('Empty Message', 'Write a message body first.');
      return;
    }
    try {
      await addTemplate({ category, name: subject.trim() || 'Untitled Template', subject, body });
      Alert.alert('Saved', 'Template saved. You can find it under Templates.');
    } catch (e) {
      fail('Could not save template', e);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedResidentId) {
      Alert.alert('Select a Resident', 'Please choose a recipient first.');
      return;
    }
    try {
      setBusy(true);
      await saveDraft({ residentId: selectedResidentId, category, channel, subject, body }, editingDraftId ?? undefined);
      resetCompose();
      setTab('drafts');
    } catch (e) {
      fail('Could not save draft', e);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!validateCompose() || !selectedResidentId) return;
    const input = { residentId: selectedResidentId, category, channel, subject, body };

    try {
      setBusy(true);
      if (deliveryMode === 'schedule') {
        if (scheduleDate.getTime() <= Date.now()) {
          Alert.alert('Pick a Future Time', 'The scheduled time must be later than now.');
          return;
        }
        await scheduleMessage(input, scheduleDate.getTime());
        // A scheduled draft replaces the draft it came from.
        if (editingDraftId) await deleteMessage(editingDraftId);
        resetCompose();
        setTab('scheduled');
        return;
      }

      const result = await sendNow(input);
      if (editingDraftId) await deleteMessage(editingDraftId);
      resetCompose();
      setTab(result.ok ? 'sent' : 'failed');
      if (!result.ok) Alert.alert('Could Not Send', result.message);
    } catch (e) {
      fail('Could not send message', e);
    } finally {
      setBusy(false);
    }
  };

  const loadDraftIntoCompose = (msg: CommunicationMessage) => {
    setSelectedResidentId(msg.residentId);
    setCategory(msg.category ?? 'GeneralNotification');
    setChannel(msg.channel);
    setSubject(msg.rawSubject);
    setBody(msg.rawBody);
    setEditingDraftId(msg.id);
    setTab('new');
  };

  const confirmDeleteMessage = (id: string) =>
    Alert.alert('Delete Message', 'Remove this message permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(id).catch((e) => fail('Could not delete', e)) },
    ]);

  const confirmDeleteTemplate = (t: MessageTemplate) =>
    Alert.alert('Delete Template', `Remove "${t.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(t.id).catch((e) => fail('Could not delete', e)) },
    ]);

  const handleCreateTemplate = async () => {
    if (!ntName.trim() || !ntBody.trim()) {
      Alert.alert('Missing Information', 'Please give the template a name and a message body.');
      return;
    }
    try {
      await addTemplate({ category: ntCategory, name: ntName.trim(), subject: ntSubject.trim(), body: ntBody.trim() });
      const created = ntName.trim();
      setNtName('');
      setNtSubject('');
      setNtBody('');
      setNewTemplateModal(false);
      Alert.alert('Template Created', `"${created}" is now available in Templates.`);
    } catch (e) {
      fail('Could not create template', e);
    }
  };

  // ----- derived lists -----
  const sentMessages = useMemo(() => messages.filter((m) => m.status === 'Sent').sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0)), [messages]);
  const scheduledMessages = useMemo(
    () => messages.filter((m) => m.status === 'Scheduled').sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0)),
    [messages]
  );
  const draftMessages = useMemo(() => messages.filter((m) => m.status === 'Draft').sort((a, b) => b.createdAt - a.createdAt), [messages]);
  const failedMessages = useMemo(() => messages.filter((m) => m.status === 'Failed').sort((a, b) => b.createdAt - a.createdAt), [messages]);
  const allHistory = useMemo(() => [...messages].sort((a, b) => b.createdAt - a.createdAt), [messages]);

  const filteredTemplates = useMemo(
    () => (templateCategoryFilter === 'All' ? templates : templates.filter((t) => t.category === templateCategoryFilter)),
    [templates, templateCategoryFilter]
  );

  const resolvedPreviewBody = selectedResidentId ? resolvePlaceholders(body, selectedResidentId) : body;
  const resolvedPreviewSubject = selectedResidentId ? resolvePlaceholders(subject, selectedResidentId) : subject;

  // ----- schedule date/time picker -----
  const onPickerChange = (e: any, selected?: Date) => {
    if (Platform.OS === 'ios') {
      if (selected) setScheduleDate(selected);
      return;
    }
    // Android shows a date dialog, then a time dialog.
    if (e.type === 'dismissed' || !selected) {
      setPickerStep(null);
      return;
    }
    const d = new Date(scheduleDate);
    if (pickerStep === 'date') {
      d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setScheduleDate(d);
      setPickerStep('time');
    } else {
      d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setScheduleDate(d);
      setPickerStep(null);
    }
  };

  // ----- renderers -----
  const renderDashboard = () => (
    <>
      <View style={styles.bannerCard}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading3, { color: colors.text }]}>Resident Communications</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{property?.name ?? 'My PG'}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Dispatch onboarding, dues, payment reminders and notices via WhatsApp, SMS, Email and in-app alerts with dynamic resident placeholders.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.newMessageButton}
        activeOpacity={0.85}
        onPress={() => {
          resetCompose();
          setTab('new');
        }}
      >
        <Ionicons name="add" size={18} color={colors.white} />
        <Text style={[typography.button, { color: colors.white, marginLeft: 6 }]}>New Message</Text>
      </TouchableOpacity>

      <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Communication Summary</Text>
      <View style={styles.statGrid}>
        <StatBox label="Total Sent" value={sentMessages.length} icon="send" color={colors.success} onPress={() => setTab('sent')} />
        <StatBox label="Scheduled" value={scheduledMessages.length} icon="time-outline" color={colors.warning} onPress={() => setTab('scheduled')} />
        <StatBox label="Drafts & Pending" value={draftMessages.length} icon="mail-outline" color={colors.primary} onPress={() => setTab('drafts')} />
        <StatBox label="Failed Dispatches" value={failedMessages.length} icon="alert-circle-outline" color={colors.error} onPress={() => setTab('failed')} />
      </View>

      <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Quick Navigation</Text>
      <View style={styles.quickNavRow}>
        <TouchableOpacity style={styles.quickNavCard} onPress={() => setTab('templates')}>
          <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.text, marginTop: 6 }]}>Templates</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{templates.length} records</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickNavCard} onPress={() => setTab('scheduled')}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.text, marginTop: 6 }]}>Scheduled</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{scheduledMessages.length} records</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickNavCard} onPress={() => setTab('history')}>
          <Ionicons name="reload-outline" size={20} color={colors.primary} />
          <Text style={[typography.bodyBold, { color: colors.text, marginTop: 6 }]}>History</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{allHistory.length} records</Text>
        </TouchableOpacity>
      </View>

      <Text style={[typography.heading3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Recent Dispatches</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : allHistory.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>No messages yet.</Text>
      ) : (
        allHistory.slice(0, 5).map((m) => <MessageListCard key={m.id} msg={m} onDelete={() => confirmDeleteMessage(m.id)} />)
      )}
    </>
  );

  const renderNewMessage = () => (
    <>
      {!!editingDraftId && (
        <View style={styles.editingBanner}>
          <Ionicons name="create-outline" size={16} color={colors.warning} />
          <Text style={[typography.caption, { color: colors.text, marginLeft: 6, flex: 1 }]}>Editing a saved draft</Text>
          <TouchableOpacity onPress={resetCompose}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Start over</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[typography.caption, styles.label]}>Property Branch</Text>
      <View style={styles.readonlyField}>
        <Text style={[typography.body, { color: colors.text }]}>{property?.name ?? 'My PG'}</Text>
      </View>

      <Text style={[typography.caption, styles.label, { marginTop: spacing.md }]}>Recipient Resident</Text>
      <TouchableOpacity style={styles.selectField} onPress={() => setResidentPickerVisible(true)}>
        <Ionicons name="person-outline" size={16} color={colors.primary} />
        <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
          {selectedResident
            ? `${selectedResident.name} (${rooms.find((r) => r.id === selectedResident.roomId)?.roomNumber ?? '—'})`
            : 'Select a resident'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={[typography.caption, styles.label, { marginTop: spacing.md }]}>Message Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xs }}>
        {CATEGORY_ORDER.map((c) => (
          <Chip key={c} label={CATEGORY_LABELS[c]} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      <Text style={[typography.caption, styles.label, { marginTop: spacing.md }]}>Template</Text>
      <TouchableOpacity style={styles.selectField} onPress={() => setTemplatePickerVisible(true)}>
        <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {templates.find((t) => t.id === selectedTemplateId)?.name ?? 'Choose a template (optional)'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={[typography.caption, styles.label, { marginTop: spacing.md }]}>Communication Method</Text>
      <View style={styles.channelRow}>
        {(['WhatsApp', 'SMS', 'Email', 'InApp'] as Channel[]).map((c) => (
          <TouchableOpacity key={c} style={[styles.channelButton, channel === c && styles.channelButtonActive]} onPress={() => setChannel(c)}>
            <Ionicons name={channelIcon(c)} size={18} color={channel === c ? colors.primary : colors.textMuted} />
            <Text style={[typography.caption, { color: channel === c ? colors.primary : colors.textMuted, marginTop: 4, fontWeight: '700' }]}>
              {CHANNEL_LABELS[c]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.deliveryCard}>
        <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>Delivery Mode</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <TouchableOpacity style={styles.radioRow} onPress={() => setDeliveryMode('now')}>
            <View style={[styles.radioOuter, deliveryMode === 'now' && styles.radioOuterActive]}>
              {deliveryMode === 'now' && <View style={styles.radioInner} />}
            </View>
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.xs }]}>Send Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.radioRow} onPress={() => setDeliveryMode('schedule')}>
            <View style={[styles.radioOuter, deliveryMode === 'schedule' && styles.radioOuterActive]}>
              {deliveryMode === 'schedule' && <View style={styles.radioInner} />}
            </View>
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.xs }]}>Schedule</Text>
          </TouchableOpacity>
        </View>

        {deliveryMode === 'schedule' && (
          <>
            <TouchableOpacity style={[styles.selectField, { marginTop: spacing.sm }]} onPress={() => setPickerStep('date')}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>
                {scheduleDate.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
              Scheduled messages are saved to your account. Open the Scheduled tab and tap "Send Now" when the time comes; automatic sending needs a server.
            </Text>
            {Platform.OS === 'ios' && pickerStep && (
              <>
                <DateTimePicker value={scheduleDate} mode="datetime" display="inline" minimumDate={new Date()} onChange={onPickerChange} />
                <TouchableOpacity style={styles.doneButton} onPress={() => setPickerStep(null)}>
                  <Text style={[typography.button, { color: colors.white }]}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>

      <Text style={[typography.caption, styles.label, { marginTop: spacing.md }]}>Subject (Optional)</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        placeholder="e.g. Welcome to {{PropertyName}}!"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.placeholderCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typography.bodyBold, { color: colors.text }]}>Insert Dynamic Placeholder</Text>
          <Text style={[typography.caption, { color: colors.primary }]}>Tap to insert</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          <Chip label="All" active={placeholderGroup === 'All'} onPress={() => setPlaceholderGroup('All')} />
          {PLACEHOLDER_GROUPS.map((g) => (
            <Chip key={g.key} label={g.label} active={placeholderGroup === g.key} onPress={() => setPlaceholderGroup(g.key)} />
          ))}
        </ScrollView>
        <View style={styles.tokenWrap}>
          {(placeholderGroup === 'All'
            ? PLACEHOLDER_GROUPS.flatMap((g) => g.tokens)
            : PLACEHOLDER_GROUPS.find((g) => g.key === placeholderGroup)?.tokens ?? []
          ).map((token) => (
            <TouchableOpacity key={token} style={styles.tokenChip} onPress={() => insertPlaceholder(token)}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>{token}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[typography.caption, styles.label, { marginTop: spacing.md }]}>Message Content</Text>
      <TextInput
        style={[styles.input, styles.bodyInput]}
        value={body}
        onChangeText={setBody}
        placeholder="Write your message..."
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.secondaryActionsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveAsTemplate}>
          <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>Save as Template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveDraft} disabled={busy}>
          <Ionicons name="save-outline" size={16} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sendRow}>
        <TouchableOpacity style={styles.previewButton} onPress={handlePreview}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text style={[typography.button, { color: colors.primary, marginLeft: 6 }]}>Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sendButton, busy && { opacity: 0.7 }]} onPress={handleSend} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={16} color={colors.white} />
              <Text style={[typography.button, { color: colors.white, marginLeft: 6 }]}>
                {deliveryMode === 'schedule' ? 'Schedule Message' : 'Send Message'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderTemplates = () => (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.sm }}>
        <Chip label="All" active={templateCategoryFilter === 'All'} onPress={() => setTemplateCategoryFilter('All')} />
        {CATEGORY_ORDER.map((c) => (
          <Chip key={c} label={CATEGORY_LABELS[c]} active={templateCategoryFilter === c} onPress={() => setTemplateCategoryFilter(c)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={[typography.bodyBold, { color: colors.text }]}>
          {filteredTemplates.length} Templates for {property?.name ?? 'My PG'}
        </Text>
        <TouchableOpacity onPress={() => setNewTemplateModal(true)}>
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>+ New Template</Text>
        </TouchableOpacity>
      </View>

      {filteredTemplates.map((t) => (
        <View key={t.id} style={styles.templateCard}>
          <View style={styles.templateBadgeRow}>
            <View style={[styles.templateBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>{CATEGORY_LABELS[t.category]}</Text>
            </View>
            {t.isDefault && (
              <View style={[styles.templateBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '700' }]}>Default</Text>
              </View>
            )}
            {!t.isDefault && (
              <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => confirmDeleteTemplate(t)}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[typography.bodyBold, { color: colors.text, marginTop: spacing.sm }]}>{t.name}</Text>
          {!!t.subject && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
              Subject: {t.subject}
            </Text>
          )}
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
            {t.body}
          </Text>
          <View style={styles.templateActionRow}>
            <TouchableOpacity style={styles.templatePreviewButton} onPress={() => setPreviewTemplate(t)}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.templateUseButton} onPress={() => handleUseTemplate(t)}>
              <Text style={[typography.caption, { color: colors.white, fontWeight: '700' }]}>Use in Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </>
  );

  const renderList = (list: CommunicationMessage[], emptyText: string, kind: 'scheduled' | 'sent' | 'drafts' | 'failed' | 'history') => (
    <>
      <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>
        {kind === 'scheduled' ? 'Scheduled' : kind === 'sent' ? 'Sent Communications' : kind === 'drafts' ? 'Drafts' : kind === 'failed' ? 'Failed' : 'History'} ({list.length})
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : list.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{emptyText}</Text>
      ) : (
        list.map((m) => (
          <MessageListCard
            key={m.id}
            msg={m}
            onDelete={() => confirmDeleteMessage(m.id)}
            onSendNow={kind === 'scheduled' ? () => sendScheduledNow(m.id).catch((e) => fail('Could not send', e)) : undefined}
            onRetry={kind === 'failed' ? () => retryFailed(m.id).catch((e) => fail('Could not retry', e)) : undefined}
            onEditDraft={kind === 'drafts' ? () => loadDraftIntoCompose(m) : undefined}
          />
        ))
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={[typography.heading3, { color: colors.text }]}>Communications & Messages</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="business-outline" size={12} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]} numberOfLines={1}>
              {property?.name ?? 'My PG'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            resetCompose();
            setTab('new');
          }}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
            <Text style={[typography.body, { color: tab === t.key ? colors.primary : colors.textMuted, fontWeight: tab === t.key ? '700' : '500' }]}>
              {t.label}
            </Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tab === 'dashboard' && renderDashboard()}
        {tab === 'new' && renderNewMessage()}
        {tab === 'templates' && renderTemplates()}
        {tab === 'scheduled' && renderList(scheduledMessages, 'No scheduled messages.', 'scheduled')}
        {tab === 'sent' && renderList(sentMessages, 'No messages sent yet.', 'sent')}
        {tab === 'drafts' && renderList(draftMessages, 'No drafts saved.', 'drafts')}
        {tab === 'failed' && renderList(failedMessages, 'No failed dispatches.', 'failed')}
        {tab === 'history' && renderList(allHistory, 'No communication history yet.', 'history')}
      </ScrollView>

      {/* Android date, then time dialog */}
      {Platform.OS === 'android' && pickerStep && (
        <DateTimePicker value={scheduleDate} mode={pickerStep} display="default" minimumDate={new Date()} onChange={onPickerChange} />
      )}

      {/* Resident picker */}
      <Modal visible={residentPickerVisible} transparent animationType="fade" onRequestClose={() => setResidentPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setResidentPickerVisible(false)}>
          <View style={styles.modalSheet}>
            <ScrollView style={{ maxHeight: 400 }}>
              {residents.length === 0 && <Text style={[typography.caption, { color: colors.textMuted, padding: spacing.md }]}>No residents yet.</Text>}
              {residents.map((r) => {
                const room = rooms.find((rm) => rm.id === r.roomId);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedResidentId(r.id);
                      setResidentPickerVisible(false);
                    }}
                  >
                    <Text style={[typography.body, { color: colors.text }]}>
                      {r.name} ({room?.roomNumber ?? '—'})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Template picker (for New Message) */}
      <Modal visible={templatePickerVisible} transparent animationType="fade" onRequestClose={() => setTemplatePickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTemplatePickerVisible(false)}>
          <View style={styles.modalSheet}>
            <ScrollView style={{ maxHeight: 400 }}>
              {templates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedTemplateId(t.id);
                    setSubject(t.subject);
                    setBody(t.body);
                    setCategory(t.category);
                    setTemplatePickerVisible(false);
                  }}
                >
                  <Text style={[typography.body, { color: colors.text }]}>{t.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{CATEGORY_LABELS[t.category]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Preview modal for compose */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[typography.heading3, { color: colors.text }]}>Message Preview</Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400, padding: spacing.md }}>
              {!!resolvedPreviewSubject && <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>{resolvedPreviewSubject}</Text>}
              <Text style={[typography.body, { color: colors.text }]}>{resolvedPreviewBody}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Preview modal for a template */}
      <Modal visible={!!previewTemplate} transparent animationType="fade" onRequestClose={() => setPreviewTemplate(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[typography.heading3, { color: colors.text, flex: 1 }]} numberOfLines={1}>{previewTemplate?.name}</Text>
              <TouchableOpacity onPress={() => setPreviewTemplate(null)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400, padding: spacing.md }}>
              <Text style={[typography.bodyBold, { color: colors.text, marginBottom: spacing.sm }]}>{previewTemplate?.subject}</Text>
              <Text style={[typography.body, { color: colors.text }]}>{previewTemplate?.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
              
      {/* New Template modal */}
      <Modal visible={newTemplateModal} transparent animationType="fade" onRequestClose={() => setNewTemplateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[typography.heading3, { color: colors.text }]}>New Template</Text>
              <TouchableOpacity onPress={() => setNewTemplateModal(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 480, padding: spacing.md }} keyboardShouldPersistTaps="handled">
              <Text style={[typography.caption, styles.label]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                {CATEGORY_ORDER.map((c) => (
                  <Chip key={c} label={CATEGORY_LABELS[c]} active={ntCategory === c} onPress={() => setNtCategory(c)} />
                ))}
              </ScrollView>
              <Text style={[typography.caption, styles.label]}>Template Name</Text>
              <TextInput style={styles.input} value={ntName} onChangeText={setNtName} placeholder="e.g. Late Night Noise Reminder" placeholderTextColor={colors.textMuted} />
              <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Subject</Text>
              <TextInput style={styles.input} value={ntSubject} onChangeText={setNtSubject} placeholder="Subject line" placeholderTextColor={colors.textMuted} />
              <Text style={[typography.caption, styles.label, { marginTop: spacing.sm }]}>Message Body</Text>
              <TextInput
                style={[styles.input, styles.bodyInput]}
                value={ntBody}
                onChangeText={setNtBody}
                placeholder="Write your template... use {{ResidentName}} etc."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity style={[styles.sendButton, { marginTop: spacing.md }]} onPress={handleCreateTemplate}>
                <Text style={[typography.button, { color: colors.white }]}>Create Template</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { padding: spacing.xs },
  tabScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabContent: { paddingHorizontal: spacing.md },
  tabItem: { paddingVertical: spacing.sm, marginRight: spacing.lg, alignItems: 'center' },
  tabUnderline: { height: 2, backgroundColor: colors.primary, width: '100%', marginTop: 4, borderRadius: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  bannerCard: { flexDirection: 'row', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md },
  newMessageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statBox: { width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  statTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statIconWrap: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  quickNavRow: { flexDirection: 'row', gap: spacing.sm },
  quickNavCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  label: { color: colors.textMuted, marginBottom: spacing.xs },
  editingBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  readonlyField: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectField: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', includeFontPadding: false, textAlignVertical: 'center' },
  channelRow: { flexDirection: 'row', gap: spacing.sm },
  channelButton: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  channelButtonActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  deliveryCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  radioRow: { flexDirection: 'row', alignItems: 'center' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  doneButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: 15 },
  bodyInput: { minHeight: 140, marginTop: spacing.xs },
  placeholderCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  tokenWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  tokenChip: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  secondaryActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm },
  sendRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  previewButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md },
  sendButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md },
  templateCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  templateBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  templateBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  templateActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  templatePreviewButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm },
  templateUseButton: { flex: 1, alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm },
  msgCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  msgTopRow: { flexDirection: 'row', alignItems: 'center' },
  msgAvatar: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  msgFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  inlineAction: { marginLeft: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalSheet: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.sm },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  modalOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});