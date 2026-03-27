import { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Stack,
  Title,
  ActionIcon,
  Badge,
  Textarea,
  LoadingOverlay,
  Switch,
  Text
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

interface ExpenseCategory {
  id: string | null;
  value?: string;
  name: string;
  name_ar?: string;
  description?: string;
  is_default?: boolean;
  is_active: boolean;
}

export function ExpenseCategories() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ExpenseCategory | null>(null);
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    description: '',
    is_active: true
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await api.getExpenseCategories();
      setCategories(data || []);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load categories',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      name_ar: '',
      description: '',
      is_active: true
    });
    setEditingCategory(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (category: ExpenseCategory) => {
    if (!category.id) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('cannot_edit_category') || 'Cannot edit this category',
        color: 'red'
      });
      return;
    }
    setEditingCategory(category);
    setForm({
      name: category.name,
      name_ar: category.name_ar || '',
      description: category.description || '',
      is_active: category.is_active
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingCategory && editingCategory.id) {
        await api.updateExpenseCategory(editingCategory.id, form);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('category_updated') || 'Category updated successfully',
          color: 'green'
        });
      } else {
        await api.createExpenseCategory(form);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('category_created') || 'Category created successfully',
          color: 'green'
        });
      }
      setModalOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save category',
        color: 'red'
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || !deleteConfirm.id) return;

    try {
      await api.deleteExpenseCategory(deleteConfirm.id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('category_deleted') || 'Category deleted successfully',
        color: 'green'
      });
      setDeleteConfirm(null);
      fetchCategories();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to delete category',
        color: 'red'
      });
    }
  };

  return (
    <Paper p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {t('expense_categories') || 'فئات المصاريف'}
        </Title>
        {isAdmin && (
          <Button leftSection={<Plus size={16} />} onClick={openCreateModal}>
            {t('add_category') || 'إضافة فئة'}
          </Button>
        )}
      </Group>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('name') || 'الاسم'}</Table.Th>
            <Table.Th>{t('name_ar') || 'الاسم بالعربية'}</Table.Th>
            <Table.Th>{t('description') || 'الوصف'}</Table.Th>
            <Table.Th>{t('status') || 'الحالة'}</Table.Th>
            {isAdmin && <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {categories.map((category) => (
            <Table.Tr key={category.id || category.value}>
              <Table.Td>{category.name}</Table.Td>
              <Table.Td>{category.name_ar || '-'}</Table.Td>
              <Table.Td>{category.description || '-'}</Table.Td>
              <Table.Td>
                <Badge color={category.is_active ? 'green' : 'gray'}>
                  {category.is_default ? t('default') || 'افتراضي' : category.is_active ? t('active') || 'نشط' : t('inactive') || 'غير نشط'}
                </Badge>
              </Table.Td>
              {isAdmin && (
                <Table.Td>
                  <Group gap="xs">
                    {category.id && (
                      <>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => openEditModal(category)}
                        >
                          <Edit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteConfirm(category)}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingCategory ? t('edit_category') || 'تعديل فئة' : t('add_category') || 'إضافة فئة'}
      >
        <Stack gap="md">
          <TextInput
            label={t('name') || 'الاسم'}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            required
          />

          <TextInput
            label={t('name_ar') || 'الاسم بالعربية'}
            value={form.name_ar}
            onChange={(e) => setForm({ ...form, name_ar: e.currentTarget.value })}
          />

          <Textarea
            label={t('description') || 'الوصف'}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
            rows={3}
          />

          {editingCategory && (
            <Switch
              label={t('active') || 'نشط'}
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })}
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => {
              setModalOpen(false);
              resetForm();
            }}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button onClick={handleSubmit}>
              {t('save') || 'حفظ'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('confirm_delete') || 'تأكيد الحذف'}
        size="sm"
      >
        <Stack>
          <Text>
            {t('confirm_delete_category') || 'Are you sure you want to delete this category?'}
          </Text>
          {deleteConfirm && (
            <Text size="sm" c="dimmed">
              {deleteConfirm.name}
            </Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button color="red" onClick={handleDelete}>
              {t('delete') || 'حذف'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
