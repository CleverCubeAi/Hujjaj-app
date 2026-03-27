import { useEffect, useState } from 'react';
import { 
  Title, 
  Paper, 
  Table, 
  Button, 
  Group, 
  TextInput, 
  Modal, 
  Stack, 
  Text,
  ActionIcon,
  Badge,
  Box,
  Textarea,
  LoadingOverlay
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Plus, Search, Edit, Trash2, Phone, Mail, User } from 'lucide-react';

interface Client {
  id: string;
  full_name: string;
  full_name_ar?: string;
  email?: string;
  phone: string;
  address?: string;
  id_number?: string;
  notes?: string;
  created_at: string;
  bookings?: any[];
}

export function ClientsPage() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    full_name_ar: '',
    email: '',
    phone: '',
    address: '',
    id_number: '',
    notes: ''
  });

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await api.getClients(search);
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchClients();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const resetForm = () => {
    setForm({
      full_name: '',
      full_name_ar: '',
      email: '',
      phone: '',
      address: '',
      id_number: '',
      notes: ''
    });
    setEditingClient(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setForm({
      full_name: client.full_name,
      full_name_ar: client.full_name_ar || '',
      email: client.email || '',
      phone: client.phone,
      address: client.address || '',
      id_number: client.id_number || '',
      notes: client.notes || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, form);
      } else {
        await api.createClient(form);
      }
      setModalOpen(false);
      resetForm();
      fetchClients();
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm_delete') || 'Are you sure you want to delete this client?')) return;
    try {
      await api.deleteClient(id);
      fetchClients();
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('clients')}</Title>
        <Button leftSection={<Plus size={18} />} onClick={openCreateModal}>
          {t('add')} {t('client') || 'عميل'}
        </Button>
      </Group>

      <Paper p="md" radius="lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFD0' }}>
        <TextInput
          placeholder={t('search') || 'بحث...'}
          leftSection={<Search size={18} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mb="md"
        />

        <Box pos="relative">
          <LoadingOverlay visible={loading} />
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('name') || 'الاسم'}</Table.Th>
                <Table.Th>{t('phone') || 'الهاتف'}</Table.Th>
                <Table.Th>{t('email') || 'البريد'}</Table.Th>
                <Table.Th>{t('id_number') || 'رقم الهوية'}</Table.Th>
                <Table.Th>{t('bookings') || 'الحجوزات'}</Table.Th>
                <Table.Th>{t('actions') || 'إجراءات'}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clients.map((client) => (
                <Table.Tr key={client.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <User size={16} />
                      <div>
                        <Text size="sm" fw={500}>{client.full_name_ar || client.full_name}</Text>
                        {client.full_name_ar && (
                          <Text size="xs" c="dimmed">{client.full_name}</Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Phone size={14} />
                      {client.phone}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {client.email && (
                      <Group gap={4}>
                        <Mail size={14} />
                        {client.email}
                      </Group>
                    )}
                  </Table.Td>
                  <Table.Td>{client.id_number || '-'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="brown">
                      {client.bookings?.length || 0}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" onClick={() => openEditModal(client)}>
                        <Edit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(client.id)}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {clients.length === 0 && !loading && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="xl">
                      {t('no_data') || 'لا توجد بيانات'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Create/Edit Modal */}
      <Modal 
        opened={modalOpen} 
        onClose={() => { setModalOpen(false); resetForm(); }} 
        title={editingClient ? (t('edit') + ' ' + t('client')) : (t('add') + ' ' + (t('client') || 'عميل'))}
        size="lg"
      >
        <Stack>
          <Group grow>
            <TextInput
              label={t('full_name') || 'الاسم الكامل'}
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.currentTarget.value })}
              required
            />
            <TextInput
              label={t('full_name_ar') || 'الاسم بالعربية'}
              placeholder="الاسم الكامل"
              value={form.full_name_ar}
              onChange={(e) => setForm({ ...form, full_name_ar: e.currentTarget.value })}
              dir="rtl"
            />
          </Group>

          <Group grow>
            <TextInput
              label={t('phone') || 'الهاتف'}
              placeholder="+212 6XX XXX XXX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}
              required
              leftSection={<Phone size={16} />}
            />
            <TextInput
              label={t('email') || 'البريد الإلكتروني'}
              placeholder="email@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
              leftSection={<Mail size={16} />}
            />
          </Group>

          <TextInput
            label={t('id_number') || 'رقم الهوية (CIN)'}
            placeholder="XXXX"
            value={form.id_number}
            onChange={(e) => setForm({ ...form, id_number: e.currentTarget.value })}
          />

          <TextInput
            label={t('address') || 'العنوان'}
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.currentTarget.value })}
          />

          <Textarea
            label={t('notes') || 'ملاحظات'}
            placeholder="Notes..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
            rows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => { setModalOpen(false); resetForm(); }}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              {t('save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
