import { useEffect, useState } from 'react';
import {
  Title,
  Stack,
  Paper,
  Table,
  Button,
  Group,
  Text,
  TextInput,
  Textarea,
  Modal,
  Tabs,
  Badge,
  ActionIcon,
  LoadingOverlay,
  Select,
  ScrollArea
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';
import { MessageSquare, Send, Plus, Edit, Trash2 } from 'lucide-react';

interface SentMessage {
  id: string;
  channel: string;
  recipient_phone: string;
  recipient_name?: string;
  body: string;
  status: 'sent' | 'failed';
  error_message?: string;
  client_id?: string;
  booking_id?: string;
  template_id?: string;
  created_at: string;
  clients?: { id: string; full_name: string; full_name_ar?: string };
  bookings?: { id: string; booking_number: string };
}

interface MessageTemplate {
  id: string;
  name: string;
  name_ar?: string;
  body: string;
  channel: string;
  created_at: string;
}

const PLACEHOLDER_HINT = '{{client_name}}, {{booking_number}}, {{total}}, {{remaining}}, {{paid}}, {{pilgrim_name}}';

export function MessagesPage({ hideTitle = false }: { hideTitle?: boolean }) {
  const { t } = useTranslation();
  const [sent, setSent] = useState<SentMessage[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', name_ar: '', body: '' });

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTemplateId, setSendTemplateId] = useState<string | null>(null);
  const [sendForm, setSendForm] = useState({
    recipient_phone: '',
    recipient_name: '',
    client_id: '',
    booking_id: ''
  });
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Array<{ id: string; full_name: string; full_name_ar?: string; phone: string }>>([]);
  const [clientBookings, setClientBookings] = useState<Array<{ id: string; booking_number: string }>>([]);
  const [sending, setSending] = useState(false);

  const fetchSent = async () => {
    try {
      const data = await api.getSentMessages({
        status: statusFilter || undefined,
        limit: 50
      });
      setSent(data || []);
    } catch (error) {
      console.error('Error fetching sent messages:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await api.getMessageTemplates();
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSent(), fetchTemplates()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    fetchSent();
  }, [statusFilter]);

  useEffect(() => {
    if (clientSearch.length >= 2) {
      api.getClients(clientSearch).then((data: any) => setClients(data || []));
    } else {
      setClients([]);
    }
  }, [clientSearch]);

  useEffect(() => {
    if (sendForm.client_id) {
      api.getBookings({ search: '' }).then((data: any) => {
        const list = Array.isArray(data) ? data : [];
        const forClient = list.filter((b: any) => b.client_id === sendForm.client_id);
        setClientBookings(forClient.map((b: any) => ({ id: b.id, booking_number: b.booking_number })));
      });
    } else {
      setClientBookings([]);
    }
  }, [sendForm.client_id]);

  const openTemplateModal = (template?: MessageTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({ name: template.name, name_ar: template.name_ar || '', body: template.body });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: '', name_ar: '', body: '' });
    }
    setTemplateModalOpen(true);
  };

  const saveTemplate = async () => {
    try {
      if (editingTemplate) {
        await api.updateMessageTemplate(editingTemplate.id, templateForm);
        notifications.show({ title: t('success'), message: t('pilgrim_updated'), color: 'green' });
      } else {
        await api.createMessageTemplate(templateForm);
        notifications.show({ title: t('success'), message: t('pilgrim_created'), color: 'green' });
      }
      setTemplateModalOpen(false);
      fetchTemplates();
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm(t('confirm_delete'))) return;
    try {
      await api.deleteMessageTemplate(id);
      notifications.show({ title: t('success'), message: t('pilgrim_deleted'), color: 'green' });
      fetchTemplates();
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    }
  };

  const openSendModal = (templateId: string) => {
    setSendTemplateId(templateId);
    setSendForm({ recipient_phone: '', recipient_name: '', client_id: '', booking_id: '' });
    setClientSearch('');
    setSendModalOpen(true);
  };

  const selectClient = (client: { id: string; full_name: string; full_name_ar?: string; phone: string }) => {
    setSendForm((f) => ({
      ...f,
      client_id: client.id,
      recipient_phone: client.phone,
      recipient_name: client.full_name_ar || client.full_name
    }));
  };

  const sendMessage = async () => {
    if (!sendForm.recipient_phone.trim()) {
      notifications.show({ title: t('error'), message: t('phone') + ' required', color: 'red' });
      return;
    }
    setSending(true);
    try {
      await api.sendMessage({
        template_id: sendTemplateId || undefined,
        recipient_phone: sendForm.recipient_phone.trim(),
        recipient_name: sendForm.recipient_name || undefined,
        client_id: sendForm.client_id || undefined,
        booking_id: sendForm.booking_id || undefined
      });
      notifications.show({ title: t('success'), message: 'SMS sent', color: 'green' });
      setSendModalOpen(false);
      fetchSent();
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack gap="lg">
      {!hideTitle && <Title order={2}>{t('messages') || 'الرسائل'}</Title>}

      <Tabs defaultValue="sent">
        <Tabs.List>
          <Tabs.Tab value="sent" leftSection={<MessageSquare size={16} />}>
            {t('messages_sent') || 'الرسائل المرسلة'}
          </Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<Send size={16} />}>
            {t('messages_templates') || 'القوالب'}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="sent" pt="md">
          <Paper p="md" withBorder pos="relative">
            <LoadingOverlay visible={loading} />
            <Group mb="md">
              <Select
                placeholder={t('status')}
                data={[
                  { value: '', label: t('all') || 'الكل' },
                  { value: 'sent', label: t('message_status_sent') || 'مرسل' },
                  { value: 'failed', label: t('message_status_failed') || 'فشل' }
                ]}
                value={statusFilter || ''}
                onChange={(v) => setStatusFilter(v || null)}
                clearable
                w={150}
              />
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('sent_at') || 'التاريخ'}</Table.Th>
                  <Table.Th>{t('recipient') || 'المستلم'}</Table.Th>
                  <Table.Th>{t('message_body') || 'النص'}</Table.Th>
                  <Table.Th>{t('booking') || 'الحجز'}</Table.Th>
                  <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sent.length === 0 && !loading && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Group justify="center" py="xl">
                        <Text c="dimmed">{t('no_pilgrims') || 'لا توجد رسائل'}</Text>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )}
                {sent.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>
                      <Text size="sm">{new Date(m.created_at).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{m.recipient_name || m.recipient_phone}</Text>
                      <Text size="xs" c="dimmed">{m.recipient_phone}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2}>{m.body}</Text>
                    </Table.Td>
                    <Table.Td>
                      {m.bookings?.booking_number ? (
                        <Badge variant="light" color="teal">{m.bookings.booking_number}</Badge>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={m.status === 'sent' ? 'green' : 'red'} variant="light">
                        {m.status === 'sent' ? (t('message_status_sent') || 'مرسل') : (t('message_status_failed') || 'فشل')}
                      </Badge>
                      {m.error_message && (
                        <Text size="xs" c="red" mt={4}>{m.error_message}</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="templates" pt="md">
          <Paper p="md" withBorder pos="relative">
            <LoadingOverlay visible={loading} />
            <Group justify="space-between" mb="md">
              <Text size="sm" c="dimmed">{t('placeholders') || 'المتغيرات'}: {PLACEHOLDER_HINT}</Text>
              <Button leftSection={<Plus size={16} />} onClick={() => openTemplateModal()}>
                {t('add_pilgrim') || 'إضافة قالب'}
              </Button>
            </Group>
            <Stack gap="sm">
              {templates.length === 0 && !loading && (
                <Text c="dimmed" ta="center" py="xl">{t('no_pilgrims') || 'لا توجد قوالب'}</Text>
              )}
              {templates.map((tmpl) => (
                <Paper key={tmpl.id} p="md" withBorder radius="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{tmpl.name_ar || tmpl.name}</Text>
                      <Text size="sm" c="dimmed" lineClamp={2}>{tmpl.body}</Text>
                    </div>
                    <Group>
                      <Button size="xs" variant="light" leftSection={<Send size={14} />} onClick={() => openSendModal(tmpl.id)}>
                        {t('send_sms') || 'إرسال'}
                      </Button>
                      <ActionIcon variant="subtle" onClick={() => openTemplateModal(tmpl)}>
                        <Edit size={16} />
                      </ActionIcon>
                      <ActionIcon color="red" variant="subtle" onClick={() => deleteTemplate(tmpl.id)}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Create/Edit Template Modal */}
      <Modal
        opened={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={editingTemplate ? (t('edit_pilgrim') || 'تعديل القالب') : (t('add_pilgrim') || 'إضافة قالب')}
        size="md"
      >
        <Stack>
          <TextInput
            label={t('template_name') || 'اسم القالب'}
            placeholder="Payment reminder"
            value={templateForm.name}
            onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.currentTarget.value }))}
          />
          <TextInput
            label={t('template_name_ar') || 'الاسم بالعربية'}
            placeholder="تذكير بالدفع"
            value={templateForm.name_ar}
            onChange={(e) => setTemplateForm((f) => ({ ...f, name_ar: e.currentTarget.value }))}
          />
          <Textarea
            label={t('template_body') || 'نص الرسالة'}
            placeholder={`Hello {{client_name}}, booking {{booking_number}} balance: {{remaining}} MAD`}
            value={templateForm.body}
            onChange={(e) => setTemplateForm((f) => ({ ...f, body: e.currentTarget.value }))}
            minRows={4}
          />
          <Text size="xs" c="dimmed">{t('placeholders') || 'المتغيرات'}: {PLACEHOLDER_HINT}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setTemplateModalOpen(false)}>{t('cancel')}</Button>
            <Button onClick={saveTemplate}>{t('save')}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Send SMS Modal */}
      <Modal
        opened={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title={t('send_sms') || 'إرسال رسالة'}
        size="md"
      >
        <Stack>
          <TextInput
            label={t('search_client') || 'ابحث عن عميل'}
            placeholder={t('search_client') || 'ابحث...'}
            value={clientSearch}
            onChange={(e) => setClientSearch(e.currentTarget.value)}
          />
          {clients.length > 0 && (
            <ScrollArea h={120} type="scroll">
              <Stack gap={4}>
                {clients.map((c) => (
                  <Paper key={c.id} p="xs" withBorder style={{ cursor: 'pointer' }} onClick={() => selectClient(c)}>
                    <Text size="sm">{c.full_name_ar || c.full_name}</Text>
                    <Text size="xs" c="dimmed">{c.phone}</Text>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
          )}
          <TextInput
            label={t('recipient') || 'رقم الهاتف'}
            placeholder="+212 6XX XXX XXX"
            value={sendForm.recipient_phone}
            onChange={(e) => setSendForm((f) => ({ ...f, recipient_phone: e.currentTarget.value }))}
            required
          />
          <TextInput
            label={t('recipient_name') || 'اسم المستلم'}
            placeholder="Optional"
            value={sendForm.recipient_name}
            onChange={(e) => setSendForm((f) => ({ ...f, recipient_name: e.currentTarget.value }))}
          />
          {clientBookings.length > 0 && (
            <Select
              label={t('booking') || 'الحجز'}
              placeholder={t('all') || 'الكل'}
              data={clientBookings.map((b) => ({ value: b.id, label: b.booking_number }))}
              value={sendForm.booking_id || null}
              onChange={(v) => setSendForm((f) => ({ ...f, booking_id: v || '' }))}
              clearable
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSendModalOpen(false)}>{t('cancel')}</Button>
            <Button loading={sending} onClick={sendMessage} leftSection={<Send size={16} />}>
              {t('send_sms') || 'إرسال'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
