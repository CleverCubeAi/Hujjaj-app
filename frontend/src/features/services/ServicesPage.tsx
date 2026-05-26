import React, { useEffect, useState } from 'react';
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
  NumberInput,
  Select,
  Switch,
  Textarea,
  LoadingOverlay,
  Box
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Car, Users, Utensils, MapPin, Shield, MoreHorizontal } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  price: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  transport: <Car size={16} />,
  guide: <Users size={16} />,
  meals: <Utensils size={16} />,
  tours: <MapPin size={16} />,
  insurance: <Shield size={16} />,
  other: <MoreHorizontal size={16} />
};

const categoryColors: Record<string, string> = {
  transport: 'blue',
  guide: 'green',
  meals: 'orange',
  tours: 'grape',
  insurance: 'cyan',
  other: 'gray'
};

export function ServicesPage() {
  const { t } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    description: '',
    price: 0,
    category: 'other',
    is_active: true
  });

  const categories = [
    { value: 'transport', label: 'النقل' },
    { value: 'guide', label: 'المرشد' },
    { value: 'meals', label: 'الوجبات' },
    { value: 'tours', label: 'الجولات' },
    { value: 'insurance', label: 'التأمين' },
    { value: 'other', label: 'أخرى' }
  ];

  const fetchServices = async () => {
    setLoading(true);
    try {
      const data = await api.getServices();
      setServices(data);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      name_ar: '',
      description: '',
      price: 0,
      category: 'other',
      is_active: true
    });
    setEditingService(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      name_ar: service.name_ar || '',
      description: service.description || '',
      price: service.price,
      category: service.category,
      is_active: service.is_active
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingService) {
        await api.updateService(editingService.id, form);
      } else {
        await api.createService(form);
      }
      setModalOpen(false);
      resetForm();
      fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm_delete') || 'Are you sure?')) return;
    try {
      await api.deleteService(id);
      fetchServices();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      await api.updateService(service.id, { is_active: !service.is_active });
      fetchServices();
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('extra_services') || 'خدمات إضافية'}</Title>
        <Button leftSection={<Plus size={18} />} onClick={openCreateModal}>
          {t('add')} {t('service') || 'خدمة'}
        </Button>
      </Group>

      <Paper p="md" radius="lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFD0' }}>
        <Box pos="relative">
          <LoadingOverlay visible={loading} />
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('category') || 'الفئة'}</Table.Th>
                <Table.Th>{t('name') || 'الاسم'}</Table.Th>
                <Table.Th>{t('description') || 'الوصف'}</Table.Th>
                <Table.Th>{t('price') || 'السعر'}</Table.Th>
                <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                <Table.Th>{t('actions') || 'إجراءات'}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {services.map((service) => (
                <Table.Tr key={service.id} style={{ opacity: service.is_active ? 1 : 0.5 }}>
                  <Table.Td>
                    <Badge 
                      leftSection={categoryIcons[service.category]}
                      color={categoryColors[service.category]}
                      variant="light"
                    >
                      {categories.find(c => c.value === service.category)?.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>{service.name_ar || service.name}</Text>
                      {service.name_ar && (
                        <Text size="xs" c="dimmed">{service.name}</Text>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {service.description || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600}>{service.price.toLocaleString('en')} MAD</Text>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={service.is_active}
                      onChange={() => toggleActive(service)}
                      size="sm"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" onClick={() => openEditModal(service)}>
                        <Edit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(service.id)}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {services.length === 0 && !loading && (
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
        title={editingService ? t('edit') : t('add')}
        size="md"
      >
        <Stack>
          <Group grow>
            <TextInput
              label={t('name') || 'الاسم (English)'}
              placeholder="Service name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
              required
            />
            <TextInput
              label={t('name_ar') || 'الاسم بالعربية'}
              placeholder="اسم الخدمة"
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.currentTarget.value })}
              dir="rtl"
            />
          </Group>

          <Select
            label={t('category') || 'الفئة'}
            data={categories}
            value={form.category}
            onChange={(value) => setForm({ ...form, category: value || 'other' })}
          />

          <NumberInput
            label={t('price') || 'السعر (MAD)'}
            value={form.price}
            onChange={(value) => setForm({ ...form, price: Number(value) || 0 })}
            min={0}
            required
          />

          <Textarea
            label={t('description') || 'الوصف'}
            placeholder="Description..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
            rows={3}
          />

          <Switch
            label={t('active') || 'نشط'}
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })}
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
