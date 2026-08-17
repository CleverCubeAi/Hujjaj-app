import { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Stack,
  Select,
  Title,
  ActionIcon,
  Badge,
  LoadingOverlay,
  Text,
  Avatar,
  Box,
  Accordion,
  Checkbox,
  NumberInput,
  SimpleGrid
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Plus, Search, Edit, Trash2, Building2, Percent } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { ImageUpload } from '../../components/common/ImageUpload';

interface Branch {
  id: string;
  name: string;
  city: string | null;
  is_headquarters: boolean;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  branch_id: string | null;
  branch: Branch | null;
  created_at: string;
  avatar_url?: string;
}

interface DiscountSetting {
  id: string;
  name: string;
  name_ar?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  is_default: boolean;
  is_active: boolean;
}

interface DiscountPermission {
  discount_setting_id: string;
  usage_limit: number | null;
  reset_period: 'daily' | 'weekly' | 'monthly' | 'never';
  is_active: boolean;
}

export function TeamManagement() {
  const { t } = useTranslation();
  const { user: currentUser, role: currentUserRole } = useAuth();
  const isAdmin = currentUserRole === 'agency_admin' || currentUserRole === 'super_admin';
  
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    user_role: 'agent',
    branch_id: null as string | null,
    avatar_url: null as string | null
  });

  // Discount permissions state
  const [discountSettings, setDiscountSettings] = useState<DiscountSetting[]>([]);
  const [userDiscountPermissions, setUserDiscountPermissions] = useState<DiscountPermission[]>([]);

  useEffect(() => {
    fetchBranches();
    fetchDiscountSettings();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [branchFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const fetchBranches = async () => {
    try {
      const data = await api.getBranches({ active_only: true });
      setBranches(data);
    } catch (error: any) {
      console.error('Failed to load branches:', error);
    }
  };

  const fetchDiscountSettings = async () => {
    try {
      const data = await api.getDiscountSettings({ active_only: true });
      setDiscountSettings(data);
    } catch (error: any) {
      console.error('Failed to load discount settings:', error);
    }
  };

  const fetchUserDiscountPermissions = async (userId: string) => {
    try {
      const data = await api.getUserPermissions(userId);
      const permissions = (data || []).map((p: any) => ({
        discount_setting_id: p.discount_setting_id,
        usage_limit: p.usage_limit,
        reset_period: p.reset_period || 'monthly',
        is_active: p.is_active !== false
      }));
      setUserDiscountPermissions(permissions);
    } catch (error: any) {
      console.error('Failed to load user discount permissions:', error);
      setUserDiscountPermissions([]);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: { search?: string; branch_id?: string } = {};
      if (search) params.search = search;
      if (branchFilter) params.branch_id = branchFilter;
      
      const data = await api.getUsers(params);
      setUsers(data);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load users',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      email: '',
      password: '',
      full_name: '',
      user_role: 'agent',
      branch_id: null,
      avatar_url: null
    });
    setEditingUser(null);
    setUserDiscountPermissions([]);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: '',
      full_name: user.full_name,
      user_role: user.role,
      branch_id: user.branch_id,
      avatar_url: user.avatar_url || null
    });
    // Load user's discount permissions
    fetchUserDiscountPermissions(user.id);
    setModalOpen(true);
  };

  // Toggle discount permission for user
  const toggleDiscountPermission = (discountId: string, enabled: boolean) => {
    if (enabled) {
      // Add permission
      setUserDiscountPermissions([
        ...userDiscountPermissions,
        { discount_setting_id: discountId, usage_limit: null, reset_period: 'monthly', is_active: true }
      ]);
    } else {
      // Remove permission
      setUserDiscountPermissions(userDiscountPermissions.filter(p => p.discount_setting_id !== discountId));
    }
  };

  // Update discount permission settings
  const updateDiscountPermission = (discountId: string, field: string, value: any) => {
    setUserDiscountPermissions(userDiscountPermissions.map(p => 
      p.discount_setting_id === discountId ? { ...p, [field]: value } : p
    ));
  };

  const handleSave = async () => {
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          full_name: form.full_name,
          user_role: form.user_role,
          email: form.email,
          branch_id: form.branch_id,
          avatar_url: form.avatar_url
        });
        
        // Save discount permissions
        if (userDiscountPermissions.length > 0 || discountSettings.some(d => !d.is_default)) {
          await api.bulkUpdateUserDiscountPermissions(editingUser.id, userDiscountPermissions.map(p => ({ ...p, usage_limit: p.usage_limit ?? undefined })));
        }
        
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('user_updated') || 'تم تحديث المستخدم بنجاح',
          color: 'green'
        });
      } else {
        const newUser = await api.createUser({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          user_role: form.user_role,
          branch_id: form.branch_id,
          avatar_url: form.avatar_url
        });
        
        // Save discount permissions for new user
        if (userDiscountPermissions.length > 0 && newUser?.id) {
          await api.bulkUpdateUserDiscountPermissions(newUser.id, userDiscountPermissions.map(p => ({ ...p, usage_limit: p.usage_limit ?? undefined })));
        }
        
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('user_created') || 'تم إنشاء المستخدم بنجاح',
          color: 'green'
        });
      }
      setModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save user',
        color: 'red'
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.deleteUser(deleteConfirm.id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('user_deleted') || 'تم حذف المستخدم بنجاح',
        color: 'green'
      });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to delete user',
        color: 'red'
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      agency_admin: 'red',
      manager: 'teal',
      agent: 'gray'
    };
    return (
      <Badge color={colors[role] || 'gray'}>
        {t(role) || role}
      </Badge>
    );
  };

  const getBranchBadge = (branch: Branch | null) => {
    if (!branch) {
      return (
        <Badge color="gray" variant="outline">
          {t('no_branch') || 'بدون فرع'}
        </Badge>
      );
    }
    return (
      <Badge 
        color={branch.is_headquarters ? 'gold' : 'teal'} 
        variant="light"
        leftSection={<Building2 size={12} />}
      >
        {branch.name}
        {branch.city && ` - ${branch.city}`}
      </Badge>
    );
  };

  // Build branch options for select dropdown
  const branchOptions = [
    { value: '', label: t('all_branches') || 'جميع الفروع' },
    { value: 'none', label: t('no_branch') || 'بدون فرع' },
    ...branches.map(b => ({
      value: b.id,
      label: `${b.name}${b.city ? ` - ${b.city}` : ''}${b.is_headquarters ? ` (${t('headquarters') || 'الرئيسي'})` : ''}`
    }))
  ];

  // Build branch options for form select (without "all branches" option)
  const branchFormOptions = [
    { value: '', label: t('no_branch') || 'بدون فرع (وصول كامل)' },
    ...branches.map(b => ({
      value: b.id,
      label: `${b.name}${b.city ? ` - ${b.city}` : ''}${b.is_headquarters ? ` (${t('headquarters') || 'الرئيسي'})` : ''}`
    }))
  ];

  return (
    <Paper p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {t('team_management') || 'إدارة الفريق'}
        </Title>
        {isAdmin && (
          <Button leftSection={<Plus size={16} />} onClick={openCreateModal}>
            {t('add_user') || 'إضافة مستخدم'}
          </Button>
        )}
      </Group>

      <Group mb="md" grow>
        <TextInput
          placeholder={t('search_users') || 'البحث عن المستخدمين...'}
          leftSection={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        {isAdmin && branches.length > 0 && (
          <Select
            placeholder={t('filter_by_branch') || 'تصفية حسب الفرع'}
            leftSection={<Building2 size={16} />}
            data={branchOptions}
            value={branchFilter}
            onChange={setBranchFilter}
            clearable
          />
        )}
      </Group>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('name') || 'الاسم'}</Table.Th>
            <Table.Th>{t('email') || 'البريد الإلكتروني'}</Table.Th>
            <Table.Th>{t('role') || 'الدور'}</Table.Th>
            <Table.Th>{t('branch') || 'الفرع'}</Table.Th>
            <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td>
                <Group gap="xs">
                  <Avatar src={user.avatar_url} size="sm" radius="xl" color="teal">
                    {user.full_name?.[0]?.toUpperCase()}
                  </Avatar>
                  {user.full_name}
                </Group>
              </Table.Td>
              <Table.Td>{user.email}</Table.Td>
              <Table.Td>{getRoleBadge(user.role)}</Table.Td>
              <Table.Td>{getBranchBadge(user.branch)}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {isAdmin && (
                    <ActionIcon
                      variant="subtle"
                      color="teal"
                      onClick={() => openEditModal(user)}
                    >
                      <Edit size={16} />
                    </ActionIcon>
                  )}
                  {isAdmin && user.id !== currentUser?.id && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => setDeleteConfirm(user)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {users.length === 0 && !loading && (
        <Text c="dimmed" ta="center" py="xl">
          {t('no_users_found') || 'لم يتم العثور على مستخدمين'}
        </Text>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingUser ? t('edit_user') || 'تعديل مستخدم' : t('add_user') || 'إضافة مستخدم'}
      >
        <Stack gap="md">
          <Box>
            <Text size="sm" fw={500} mb="xs">{t('profile_photo') || 'صورة الملف الشخصي'}</Text>
            <Group justify="center">
              <ImageUpload
                value={form.avatar_url}
                onChange={(url) => setForm({ ...form, avatar_url: url })}
                folder="avatars"
                variant="avatar"
                size={80}
                placeholder={form.full_name}
              />
            </Group>
          </Box>

          <TextInput
            label={t('full_name') || 'الاسم الكامل'}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.currentTarget.value })}
            required
          />

          <TextInput
            label={t('email') || 'البريد الإلكتروني'}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
            required
            type="email"
            disabled={!!editingUser}
          />

          {!editingUser && (
            <TextInput
              label={t('password') || 'كلمة المرور'}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
              required
            />
          )}

          <Select
            label={t('role') || 'الدور'}
            value={form.user_role}
            onChange={(value) => setForm({ ...form, user_role: value || 'agent' })}
            data={[
              { value: 'agency_admin', label: t('agency_admin') || 'مدير الوكالة' },
              { value: 'manager', label: t('manager') || 'مدير' },
              { value: 'agent', label: t('agent') || 'وكيل' }
            ]}
            disabled={editingUser?.id === currentUser?.id}
          />

          <Select
            label={t('branch') || 'الفرع'}
            description={branches.length > 0 
              ? (t('branch_description') || 'اختر الفرع الذي سيعمل به المستخدم. بدون فرع = وصول كامل للبيانات')
              : (t('no_branches_create_first') || 'لا توجد فروع. أنشئ فرعاً أولاً من الإعدادات > الفروع')
            }
            placeholder={t('select_branch') || 'اختر الفرع'}
            leftSection={<Building2 size={16} />}
            value={form.branch_id || ''}
            onChange={(value) => setForm({ ...form, branch_id: value || null })}
            data={branchFormOptions}
            clearable
            disabled={branches.length === 0}
          />

          {/* Discount Permissions Section */}
          {discountSettings.filter(d => !d.is_default).length > 0 && (
            <Accordion variant="contained">
              <Accordion.Item value="discounts">
                <Accordion.Control icon={<Percent size={16} />}>
                  <Text size="sm" fw={500}>{t('discount_permissions') || 'صلاحيات الخصومات'}</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Text size="xs" c="dimmed">
                      {t('discount_permissions_desc') || 'الخصومات الافتراضية متاحة للجميع. اختر الخصومات الإضافية المتاحة لهذا المستخدم.'}
                    </Text>
                    {discountSettings.filter(d => !d.is_default && d.is_active).map((discount) => {
                      const permission = userDiscountPermissions.find(p => p.discount_setting_id === discount.id);
                      const isEnabled = !!permission;
                      
                      return (
                        <Box key={discount.id} p="sm" style={{ backgroundColor: isEnabled ? '#f0fdf4' : '#f9f9f9', borderRadius: 8 }}>
                          <Group justify="space-between" mb={isEnabled ? 'sm' : 0}>
                            <Checkbox
                              label={
                                <Group gap="xs">
                                  <Text size="sm" fw={500}>{discount.name}</Text>
                                  <Badge size="xs" color={discount.discount_type === 'percent' ? 'teal' : 'gold'}>
                                    {discount.discount_type === 'percent' ? `${discount.discount_value}%` : `${discount.discount_value} MAD`}
                                  </Badge>
                                </Group>
                              }
                              checked={isEnabled}
                              onChange={(e) => toggleDiscountPermission(discount.id, e.currentTarget.checked)}
                            />
                          </Group>
                          
                          {isEnabled && (
                            <SimpleGrid cols={2} mt="xs">
                              <NumberInput
                                label={t('usage_limit') || 'حد الاستخدام'}
                                description={t('leave_empty_unlimited') || 'اتركه فارغاً للاستخدام غير المحدود'}
                                value={permission?.usage_limit || ''}
                                onChange={(v) => updateDiscountPermission(discount.id, 'usage_limit', v || null)}
                                min={1}
                                size="xs"
                              />
                              <Select
                                label={t('reset_period') || 'فترة التجديد'}
                                value={permission?.reset_period || 'monthly'}
                                onChange={(v) => updateDiscountPermission(discount.id, 'reset_period', v || 'monthly')}
                                data={[
                                  { value: 'daily', label: t('daily') || 'يومي' },
                                  { value: 'weekly', label: t('weekly') || 'أسبوعي' },
                                  { value: 'monthly', label: t('monthly') || 'شهري' },
                                  { value: 'never', label: t('never') || 'أبداً' }
                                ]}
                                size="xs"
                              />
                            </SimpleGrid>
                          )}
                        </Box>
                      );
                    })}
                    {discountSettings.filter(d => !d.is_default && d.is_active).length === 0 && (
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        {t('no_custom_discounts') || 'لا توجد خصومات مخصصة. جميع الخصومات افتراضية ومتاحة للجميع.'}
                      </Text>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => {
              setModalOpen(false);
              resetForm();
            }}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button onClick={handleSave}>
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
        {deleteConfirm && (
          <Stack>
            <Text>
              {t('confirm_delete_user') || 'Are you sure you want to delete this user?'}
            </Text>
            <Text fw={500} ta="center">
              {deleteConfirm.full_name} ({deleteConfirm.email})
            </Text>
            {deleteConfirm.branch && (
              <Text size="sm" c="dimmed" ta="center">
                {t('branch')}: {deleteConfirm.branch.name}
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
        )}
      </Modal>
    </Paper>
  );
}
