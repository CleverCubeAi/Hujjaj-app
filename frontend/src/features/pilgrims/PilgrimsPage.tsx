import { useEffect, useState } from 'react';
import { 
  Table, Title, Button, Group, Modal, TextInput, Stack, Paper, 
  Badge, Card, Text, SimpleGrid, Select, ActionIcon,
  LoadingOverlay, Alert, Checkbox, Divider, ScrollArea,
  Avatar, Image, Anchor
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { ImageUpload } from '../../components/common/ImageUpload';
import { 
  Plus, Users, Search, Edit, Trash2, 
  User, Phone, FileText, Link2, Eye
} from 'lucide-react';

interface Client {
  id: string;
  full_name: string;
  full_name_ar?: string;
  phone: string;
  email?: string;
}

interface Pilgrim {
  id: string;
  full_name: string;
  full_name_ar?: string;
  gender: 'male' | 'female';
  date_of_birth?: string;
  passport_number?: string;
  phone?: string;
  photo_url?: string | null;
  passport_scan_url?: string | null;
  status: string;
  client_id?: string;
  booking_id?: string;
  clients?: Client;
  bookings?: {
    id: string;
    booking_number: string;
  };
  flights?: { code: string; departure_date: string };
  accommodations?: { name: string; name_ar?: string };
  seasons?: { name: string; type: string };
}

interface PilgrimForm {
  full_name: string;
  full_name_ar: string;
  gender: string;
  date_of_birth: Date | null;
  passport_number: string;
  phone: string;
  photo_url: string | null;
  passport_scan_url: string | null;
  client_id: string | null;
  create_as_client: boolean;
  email: string;
}

const initialForm: PilgrimForm = {
  full_name: '',
  full_name_ar: '',
  gender: '',
  date_of_birth: null,
  passport_number: '',
  phone: '',
  photo_url: null,
  passport_scan_url: null,
  client_id: null,
  create_as_client: false,
  email: ''
};

export function PilgrimsPage() {
  const { t } = useTranslation();
  const [pilgrims, setPilgrims] = useState<Pilgrim[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPilgrim, setEditingPilgrim] = useState<Pilgrim | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Pilgrim | null>(null);
  const [viewPilgrim, setViewPilgrim] = useState<Pilgrim | null>(null);
  const [form, setForm] = useState<PilgrimForm>(initialForm);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');

  const fetchPilgrims = async () => {
    setLoading(true);
    try {
      const data = await api.getPilgrims();
      // Deduplicate by pilgrim id (in case API ever returns same row twice)
      const byId = new Map<string, Pilgrim>();
      (data || []).forEach((p: Pilgrim) => byId.set(p.id, p));
      setPilgrims(Array.from(byId.values()));
    } catch (error) {
      console.error('Error fetching pilgrims:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchClients = async (query: string) => {
    if (query.length >= 2) {
      try {
        const data = await api.getClients(query);
        setClients(data || []);
      } catch (error) {
        console.error('Error searching clients:', error);
      }
    } else {
      setClients([]);
    }
  };

  useEffect(() => {
    fetchPilgrims();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (clientSearch) searchClients(clientSearch);
    }, 300);
    return () => clearTimeout(debounce);
  }, [clientSearch]);

  const handleOpenCreate = () => {
    setForm(initialForm);
    setEditingPilgrim(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (pilgrim: Pilgrim) => {
    // Parse date_of_birth safely
    let parsedDate: Date | null = null;
    if (pilgrim.date_of_birth) {
      const dateObj = new Date(pilgrim.date_of_birth);
      // Check if the date is valid
      if (!isNaN(dateObj.getTime())) {
        parsedDate = dateObj;
      }
    }
    
    setForm({
      full_name: pilgrim.full_name || '',
      full_name_ar: pilgrim.full_name_ar || '',
      gender: pilgrim.gender || '',
      date_of_birth: parsedDate,
      passport_number: pilgrim.passport_number || '',
      phone: pilgrim.phone || '',
      photo_url: pilgrim.photo_url || null,
      passport_scan_url: pilgrim.passport_scan_url || null,
      client_id: pilgrim.client_id || null,
      create_as_client: false,
      email: ''
    });
    setEditingPilgrim(pilgrim);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.passport_number?.trim()) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('passport_required') || 'رقم الجواز إلزامي',
        color: 'red'
      });
      return;
    }
    try {
      let clientId = form.client_id;

      // Create client if requested
      if (form.create_as_client && !clientId) {
        const newClient = await api.createClient({
          full_name: form.full_name,
          full_name_ar: form.full_name_ar,
          phone: form.phone,
          email: form.email || undefined
        });
        clientId = newClient.id;
      }

      // Handle date_of_birth - ensure it's properly formatted
      let formattedDateOfBirth: string | null = null;
      if (form.date_of_birth) {
        // Check if it's a Date object or a string
        if (form.date_of_birth instanceof Date) {
          formattedDateOfBirth = form.date_of_birth.toISOString().split('T')[0];
        } else if (typeof form.date_of_birth === 'string') {
          // If it's already a string, use it directly (after validation)
          formattedDateOfBirth = form.date_of_birth;
        }
      }

      const pilgrimData = {
        full_name: form.full_name,
        full_name_ar: form.full_name_ar,
        gender: form.gender,
        date_of_birth: formattedDateOfBirth,
        passport_number: form.passport_number,
        phone: form.phone,
        photo_url: form.photo_url || undefined,
        passport_scan_url: form.passport_scan_url || undefined,
        client_id: clientId
      };

      if (editingPilgrim) {
        await api.updatePilgrim(editingPilgrim.id, pilgrimData);
      } else {
        await api.createPilgrim(pilgrimData);
      }

      setModalOpen(false);
      setForm(initialForm);
      setEditingPilgrim(null);
      fetchPilgrims();
      notifications.show({
        title: t('success') || 'نجاح',
        message: editingPilgrim ? t('pilgrim_updated') || 'تم تحديث المعتمر' : t('pilgrim_created') || 'تم إضافة المعتمر',
        color: 'green'
      });
    } catch (error: any) {
      console.error('Error saving pilgrim:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('error_saving') || 'خطأ في الحفظ',
        color: 'red'
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deletePilgrim(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchPilgrims();
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('pilgrim_deleted') || 'تم حذف المعتمر',
        color: 'green'
      });
    } catch (error: any) {
      console.error('Error deleting pilgrim:', error);
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || t('error_deleting') || 'خطأ في الحذف',
        color: 'red'
      });
    }
  };

  // Filter pilgrims
  const filteredPilgrims = pilgrims.filter(p => {
    const matchesSearch = !search || 
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name_ar?.includes(search) ||
      p.passport_number?.includes(search) ||
      p.phone?.includes(search);
    
    const matchesGender = !genderFilter || p.gender === genderFilter;
    
    return matchesSearch && matchesGender;
  });

  /** One row per distinct person by passport_number; primary pilgrim + all booking numbers */
  type DisplayRow = { pilgrim: Pilgrim; bookingNumbers: string[] };
  const displayRows: DisplayRow[] = (() => {
    // Group by passport: same passport = same person; no passport = each record is its own row
    const personKey = (p: Pilgrim) => {
      const passport = (p.passport_number || '').trim().toLowerCase();
      if (passport) return `passport:${passport}`;
      return `id:${p.id}`;
    };
    const groups = new Map<string, Pilgrim[]>();
    filteredPilgrims.forEach(p => {
      const key = personKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });
    const rows = Array.from(groups.values()).map(group => {
      const primary = group[0];
      const bookingNumbers = [...new Set(group.map(p => p.bookings?.booking_number).filter(Boolean) as string[])];
      return { pilgrim: primary, bookingNumbers };
    });
    // Sort by passport_number (nulls last)
    return rows.sort((a, b) => {
      const pa = (a.pilgrim.passport_number || '').trim().toLowerCase();
      const pb = (b.pilgrim.passport_number || '').trim().toLowerCase();
      if (!pa && !pb) return 0;
      if (!pa) return 1;
      if (!pb) return -1;
      return pa.localeCompare(pb);
    });
  })();

  // Stats aligned with listing (unique persons by passport)
  const totalCount = displayRows.length;
  const maleCount = displayRows.filter(r => r.pilgrim.gender === 'male').length;
  const femaleCount = displayRows.filter(r => r.pilgrim.gender === 'female').length;
  const linkedToClient = displayRows.filter(r => r.pilgrim.client_id).length;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('pilgrims') || 'المعتمرين'}</Title>
        <Button leftSection={<Plus size={16} />} onClick={handleOpenCreate}>
          {t('add_pilgrim') || 'إضافة معتمر'}
        </Button>
      </Group>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Card withBorder p="md">
          <Group>
            <Users size={24} color="#0C7774" />
            <div>
              <Text size="xs" c="dimmed">{t('total_pilgrims') || 'إجمالي المعتمرين'}</Text>
              <Text fw={700} size="xl">{totalCount}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md" style={{ backgroundColor: '#e3f2fd' }}>
          <Group>
            <User size={24} color="#1976d2" />
            <div>
              <Text size="xs" c="dimmed">{t('male') || 'ذكور'}</Text>
              <Text fw={700} size="xl" c="blue">{maleCount}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md" style={{ backgroundColor: '#fce4ec' }}>
          <Group>
            <User size={24} color="#c2185b" />
            <div>
              <Text size="xs" c="dimmed">{t('female') || 'إناث'}</Text>
              <Text fw={700} size="xl" c="pink">{femaleCount}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder p="md" style={{ backgroundColor: '#e8f5e9' }}>
          <Group>
            <Link2 size={24} color="#388e3c" />
            <div>
              <Text size="xs" c="dimmed">{t('linked_to_client') || 'مرتبط بعميل'}</Text>
              <Text fw={700} size="xl" c="green">{linkedToClient}</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Paper p="md" withBorder>
        <Group align="flex-end" wrap="wrap">
          <TextInput
            placeholder={t('search_pilgrims') || 'بحث بالاسم أو رقم الجواز...'}
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            placeholder={t('gender') || 'الجنس'}
            data={[
              { value: '', label: t('all') || 'الكل' },
              { value: 'male', label: t('male') || 'ذكر' },
              { value: 'female', label: t('female') || 'أنثى' }
            ]}
            value={genderFilter}
            onChange={setGenderFilter}
            clearable
            w={150}
          />
        </Group>
      </Paper>

      {/* Table */}
      <Paper p="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 56 }}></Table.Th>
              <Table.Th>{t('name') || 'الاسم'}</Table.Th>
              <Table.Th>{t('gender') || 'الجنس'}</Table.Th>
              <Table.Th>{t('passport_number') || 'رقم الجواز'}</Table.Th>
              <Table.Th>{t('phone') || 'الهاتف'}</Table.Th>
              <Table.Th>{t('client') || 'العميل'}</Table.Th>
              <Table.Th>{t('booking') || 'الحجز'}</Table.Th>
              <Table.Th>{t('actions') || 'إجراءات'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {displayRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text ta="center" c="dimmed" py="xl">
                    {t('no_pilgrims') || 'لا يوجد معتمرين'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              displayRows.map(({ pilgrim, bookingNumbers }) => (
                <Table.Tr key={pilgrim.id}>
                  <Table.Td>
                    {pilgrim.photo_url ? (
                      <Avatar src={pilgrim.photo_url} size={40} radius="xl" alt="" />
                    ) : (
                      <Avatar color={pilgrim.gender === 'male' ? 'blue' : 'pink'} size={40} radius="xl">
                        <User size={20} />
                      </Avatar>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text fw={500}>{pilgrim.full_name_ar || pilgrim.full_name}</Text>
                      {pilgrim.full_name_ar && pilgrim.full_name && (
                        <Text size="xs" c="dimmed">{pilgrim.full_name}</Text>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      color={pilgrim.gender === 'male' ? 'blue' : 'pink'} 
                      variant="light"
                    >
                      {pilgrim.gender === 'male' ? t('male') || 'ذكر' : t('female') || 'أنثى'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{pilgrim.passport_number || '-'}</Table.Td>
                  <Table.Td>{pilgrim.phone || '-'}</Table.Td>
                  <Table.Td>
                    {pilgrim.clients ? (
                      <Badge variant="light" color="green">
                        {pilgrim.clients.full_name_ar || pilgrim.clients.full_name}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {bookingNumbers.length > 0 ? (
                      <Group gap={4} wrap="wrap">
                        {bookingNumbers.map((bn) => (
                          <Badge key={bn} variant="light" color="teal" size="sm">
                            {bn}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        color="blue"
                        onClick={() => setViewPilgrim(pilgrim)}
                        title={t('view_details') || 'عرض التفاصيل'}
                      >
                        <Eye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        color="gray"
                        onClick={() => handleOpenEdit(pilgrim)}
                        title={t('edit') || 'تعديل'}
                      >
                        <Edit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        color="red"
                        onClick={() => setDeleteConfirm(pilgrim)}
                        title={t('delete') || 'حذف'}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create/Edit Modal */}
      <Modal 
        opened={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingPilgrim ? (t('edit_pilgrim') || 'تعديل معتمر') : (t('add_pilgrim') || 'إضافة معتمر')}
        size="lg"
      >
        <Stack>
          {/* Client Linking Section */}
          <Paper p="md" withBorder style={{ backgroundColor: '#f5f5f5' }}>
            <Text fw={600} mb="sm">{t('client_linking') || 'ربط بالعميل'}</Text>
            
            {!form.create_as_client && (
              <>
                <TextInput
                  placeholder={t('search_client') || 'ابحث عن عميل...'}
                  leftSection={<Search size={16} />}
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.currentTarget.value)}
                  mb="sm"
                />
                
                {clients.length > 0 && (
                  <ScrollArea h={120} mb="sm">
                    <Stack gap="xs">
                      {clients.map((client) => (
                        <Card 
                          key={client.id} 
                          p="xs" 
                          withBorder
                          style={{
                            cursor: 'pointer',
                            backgroundColor: form.client_id === client.id ? '#e8f5e9' : undefined,
                            borderColor: form.client_id === client.id ? '#4caf50' : undefined
                          }}
                          onClick={() => {
                            setForm({ 
                              ...form, 
                              client_id: client.id,
                              full_name: form.full_name || client.full_name,
                              full_name_ar: form.full_name_ar || client.full_name_ar || '',
                              phone: form.phone || client.phone
                            });
                          }}
                        >
                          <Group justify="space-between">
                            <div>
                              <Text size="sm" fw={500}>{client.full_name_ar || client.full_name}</Text>
                              <Text size="xs" c="dimmed">{client.phone}</Text>
                            </div>
                            {form.client_id === client.id && (
                              <Badge color="green" size="sm">{t('selected') || 'محدد'}</Badge>
                            )}
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  </ScrollArea>
                )}
                
                {form.client_id && (
                  <Button 
                    variant="subtle" 
                    color="red" 
                    size="xs"
                    onClick={() => setForm({ ...form, client_id: null })}
                  >
                    {t('remove_link') || 'إزالة الربط'}
                  </Button>
                )}
              </>
            )}
            
            <Divider my="sm" />
            
            <Checkbox
              label={t('create_as_client') || 'إنشاء هذا المعتمر كعميل جديد'}
              description={t('create_as_client_desc') || 'سيتم إضافة هذا المعتمر إلى قائمة العملاء'}
              checked={form.create_as_client}
              onChange={(e) => setForm({ 
                ...form, 
                create_as_client: e.currentTarget.checked,
                client_id: e.currentTarget.checked ? null : form.client_id
              })}
              disabled={!!form.client_id}
            />
          </Paper>

          <Divider />

          {/* Pilgrim Info */}
          <SimpleGrid cols={2}>
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
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <Select
              label={t('gender') || 'الجنس'}
              data={[
                { value: 'male', label: t('male') || 'ذكر' },
                { value: 'female', label: t('female') || 'أنثى' }
              ]}
              value={form.gender}
              onChange={(v) => setForm({ ...form, gender: v || '' })}
              required
            />
            <DateInput
              label={t('date_of_birth') || 'تاريخ الميلاد'}
              placeholder={t('select_date') || 'اختر التاريخ'}
              value={form.date_of_birth}
              onChange={(v) => {
                if (v === null || v === undefined) {
                  setForm({ ...form, date_of_birth: null });
                  return;
                }
                const d = typeof v === 'string' ? new Date(v) : (v as Date);
                setForm({ ...form, date_of_birth: !isNaN(d.getTime()) ? d : null });
              }}
              valueFormat="YYYY-MM-DD"
              clearable
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <TextInput
              label={t('passport_number') || 'رقم الجواز'}
              placeholder="AB1234567"
              value={form.passport_number}
              onChange={(e) => setForm({ ...form, passport_number: e.currentTarget.value })}
              leftSection={<FileText size={16} />}
              required
            />
            <TextInput
              label={t('phone') || 'الهاتف'}
              placeholder="+212 6XX XXX XXX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}
              leftSection={<Phone size={16} />}
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <div>
              <Text size="sm" fw={500} mb={4}>{t('pilgrim_photo') || 'صورة المعتمر'}</Text>
              <Text size="xs" c="dimmed" mb={4}>{t('optional') || 'اختياري'}</Text>
              <ImageUpload
                folder="pilgrims"
                value={form.photo_url}
                onChange={(url) => setForm({ ...form, photo_url: url })}
                variant="avatar"
                size={80}
                placeholder={form.full_name_ar || form.full_name}
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>{t('passport_scan') || 'نسخة جواز السفر'}</Text>
              <Text size="xs" c="dimmed" mb={4}>{t('optional') || 'اختياري'}</Text>
              <ImageUpload
                folder="pilgrims"
                value={form.passport_scan_url}
                onChange={(url) => setForm({ ...form, passport_scan_url: url })}
                variant="default"
                size={120}
                placeholder={t('passport_scan_upload') || 'رفع صورة الجواز'}
              />
            </div>
          </SimpleGrid>

          {form.create_as_client && (
            <TextInput
              label={t('email') || 'البريد الإلكتروني'}
              placeholder="email@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
              description={t('email_for_client') || 'سيتم استخدامه لسجل العميل'}
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button onClick={handleSave} disabled={!form.full_name || !form.gender || !form.passport_number?.trim()}>
              {editingPilgrim ? (t('save') || 'حفظ') : (t('add') || 'إضافة')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Details Modal */}
      <Modal
        opened={!!viewPilgrim}
        onClose={() => setViewPilgrim(null)}
        title={t('pilgrim_details') || 'تفاصيل المعتمر'}
        size="md"
      >
        {viewPilgrim && (
          <Stack>
            <Card withBorder p="md">
              <Group mb="md">
                {viewPilgrim.photo_url ? (
                  <Avatar src={viewPilgrim.photo_url} size={64} radius="xl" />
                ) : (
                  <User size={32} color={viewPilgrim.gender === 'male' ? '#1976d2' : '#c2185b'} />
                )}
                <div>
                  <Text size="xl" fw={700}>{viewPilgrim.full_name_ar || viewPilgrim.full_name}</Text>
                  {viewPilgrim.full_name_ar && viewPilgrim.full_name && (
                    <Text c="dimmed">{viewPilgrim.full_name}</Text>
                  )}
                </div>
              </Group>
              
              <SimpleGrid cols={2}>
                <div>
                  <Text size="xs" c="dimmed">{t('gender') || 'الجنس'}</Text>
                  <Badge color={viewPilgrim.gender === 'male' ? 'blue' : 'pink'}>
                    {viewPilgrim.gender === 'male' ? t('male') || 'ذكر' : t('female') || 'أنثى'}
                  </Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">{t('passport_number') || 'رقم الجواز'}</Text>
                  <Text fw={500}>{viewPilgrim.passport_number || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">{t('phone') || 'الهاتف'}</Text>
                  <Text fw={500}>{viewPilgrim.phone || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">{t('date_of_birth') || 'تاريخ الميلاد'}</Text>
                  <Text fw={500}>
                    {viewPilgrim.date_of_birth 
                      ? new Date(viewPilgrim.date_of_birth).toLocaleDateString('en')
                      : '-'}
                  </Text>
                </div>
              </SimpleGrid>
              {(viewPilgrim.photo_url || viewPilgrim.passport_scan_url) && (
                <SimpleGrid cols={2} mt="md">
                  {viewPilgrim.photo_url && (
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>{t('pilgrim_photo') || 'صورة المعتمر'}</Text>
                      <Avatar src={viewPilgrim.photo_url} size={80} radius="md" />
                    </div>
                  )}
                  {viewPilgrim.passport_scan_url && (
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>{t('passport_scan') || 'نسخة جواز السفر'}</Text>
                      <Anchor href={viewPilgrim.passport_scan_url} target="_blank" rel="noopener noreferrer">
                        <Image src={viewPilgrim.passport_scan_url} w={120} h={90} fit="cover" radius="sm" style={{ cursor: 'pointer' }} />
                      </Anchor>
                      <Text size="xs" c="dimmed" mt={4}>{t('click_to_view') || 'انقر للعرض'}</Text>
                    </div>
                  )}
                </SimpleGrid>
              )}
            </Card>

            {viewPilgrim.clients && (
              <Card withBorder p="md">
                <Text fw={600} mb="sm">{t('linked_client') || 'العميل المرتبط'}</Text>
                <Group>
                  <Badge color="green" size="lg">
                    {viewPilgrim.clients.full_name_ar || viewPilgrim.clients.full_name}
                  </Badge>
                  <Text size="sm" c="dimmed">{viewPilgrim.clients.phone}</Text>
                </Group>
              </Card>
            )}

            {viewPilgrim.bookings && (
              <Card withBorder p="md">
                <Text fw={600} mb="sm">{t('booking') || 'الحجز'}</Text>
                <Badge color="teal" size="lg">{viewPilgrim.bookings.booking_number}</Badge>
              </Card>
            )}

            {viewPilgrim.seasons && (
              <Card withBorder p="md">
                <Text fw={600} mb="sm">{t('season') || 'الموسم'}</Text>
                <Badge color="blue" size="lg">{viewPilgrim.seasons.name}</Badge>
              </Card>
            )}
          </Stack>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('confirm_delete') || 'تأكيد الحذف'}
        size="sm"
      >
        {deleteConfirm && (
          <Stack>
            <Alert color="red">
              {t('delete_pilgrim_warning') || 'هل أنت متأكد من حذف هذا المعتمر؟'}
            </Alert>
            <Text fw={500} ta="center">
              {deleteConfirm.full_name_ar || deleteConfirm.full_name}
            </Text>
            <Group justify="center">
              <Button variant="default" onClick={() => setDeleteConfirm(null)}>
                {t('cancel') || 'إلغاء'}
              </Button>
              <Button color="red" onClick={handleDelete}>
                {t('delete') || 'حذف'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
