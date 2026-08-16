import { useEffect, useState } from 'react';
import {
  Paper, Table, Button, Group, Modal, Stack, TextInput, NumberInput, Switch, Title, Badge, Select, Textarea,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';

const empty = {
  slug: '',
  name_ar: '',
  name_fr: '',
  description_ar: '',
  description_fr: '',
  price_amount: 0,
  currency: 'MAD',
  billing_period: 'monthly',
  trial_days: 0,
  is_public: true,
  is_default: false,
  is_active: true,
  sort_order: 0,
  max_users: 3 as number | string,
  max_branches: 1 as number | string,
  max_seasons: 2 as number | string,
  email: false,
  sms: false,
  white_label: false,
  llm: false,
  inventory: true,
  reports: true,
  discounts: true,
};

export function PackagesPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(empty);

  const load = async () => setRows(await api.getPlatformPackages());
  useEffect(() => { load().catch(() => undefined); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      ...empty,
      ...row,
      ...row.features,
      max_users: row.features?.max_users ?? '',
      max_branches: row.features?.max_branches ?? '',
      max_seasons: row.features?.max_seasons ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      slug: form.slug,
      name_ar: form.name_ar,
      name_fr: form.name_fr,
      description_ar: form.description_ar,
      description_fr: form.description_fr,
      price_amount: Number(form.price_amount || 0),
      currency: form.currency,
      billing_period: form.billing_period,
      trial_days: Number(form.trial_days || 0),
      is_public: form.is_public,
      is_default: form.is_default,
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
      features: {
        max_users: form.max_users === '' ? null : Number(form.max_users),
        max_branches: form.max_branches === '' ? null : Number(form.max_branches),
        max_seasons: form.max_seasons === '' ? null : Number(form.max_seasons),
        email: form.email,
        sms: form.sms,
        white_label: form.white_label,
        llm: form.llm,
        inventory: form.inventory,
        reports: form.reports,
        discounts: form.discounts,
      },
    };
    try {
      if (editing) await api.updatePlatformPackage(editing.id, payload);
      else await api.createPlatformPackage(payload);
      setOpen(false);
      load();
      notifications.show({ title: t('success'), message: t('saved') || 'Saved', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{t('packages') || 'الباقات'}</Title>
        <Button color="teal" leftSection={<Plus size={16} />} onClick={openCreate}>{t('create') || 'إنشاء'}</Button>
      </Group>
      <Paper>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('name')}</Table.Th>
              <Table.Th>{t('price') || 'السعر'}</Table.Th>
              <Table.Th>{t('period') || 'الفترة'}</Table.Th>
              <Table.Th>{t('agencies')}</Table.Th>
              <Table.Th>{t('status')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(row)}>
                <Table.Td>{i18n.language === 'fr' ? row.name_fr : row.name_ar}</Table.Td>
                <Table.Td>{Number(row.price_amount).toLocaleString()} {row.currency}</Table.Td>
                <Table.Td>{row.billing_period}</Table.Td>
                <Table.Td>{row.agency_count || 0}</Table.Td>
                <Table.Td>
                  <Badge color={row.is_active ? 'green' : 'gray'}>{row.is_active ? t('active') : t('inactive')}</Badge>
                  {row.is_default && <Badge ml="xs">{t('default') || 'افتراضي'}</Badge>}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
      <Modal opened={open} onClose={() => setOpen(false)} title={editing ? t('edit') : t('create')} size="lg">
        <Stack>
          <TextInput label="Slug" disabled={!!editing} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.currentTarget.value })} />
          <TextInput label={t('name') + ' AR'} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.currentTarget.value })} />
          <TextInput label={t('name') + ' FR'} value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.currentTarget.value })} />
          <Textarea label={t('description') + ' AR'} value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.currentTarget.value })} />
          <Textarea label={t('description') + ' FR'} value={form.description_fr} onChange={(e) => setForm({ ...form, description_fr: e.currentTarget.value })} />
          <NumberInput label={t('price')} value={form.price_amount} onChange={(v) => setForm({ ...form, price_amount: Number(v || 0) })} />
          <Select label={t('period')} value={form.billing_period} data={['monthly', 'yearly', 'once']} onChange={(v) => setForm({ ...form, billing_period: v || 'monthly' })} />
          <NumberInput label={t('max_users') || 'المستخدمون'} value={form.max_users as number} onChange={(v) => setForm({ ...form, max_users: v as any })} />
          <NumberInput label={t('max_branches') || 'الفروع'} value={form.max_branches as number} onChange={(v) => setForm({ ...form, max_branches: v as any })} />
          <NumberInput label={t('max_seasons') || 'المواسم'} value={form.max_seasons as number} onChange={(v) => setForm({ ...form, max_seasons: v as any })} />
          {(['email', 'sms', 'white_label', 'llm', 'inventory', 'reports', 'discounts'] as const).map((k) => (
            <Switch key={k} checked={!!form[k]} label={k} onChange={(e) => setForm({ ...form, [k]: e.currentTarget.checked })} />
          ))}
          <Switch checked={form.is_public} label={t('public') || 'عام'} onChange={(e) => setForm({ ...form, is_public: e.currentTarget.checked })} />
          <Switch checked={form.is_default} label={t('default') || 'افتراضي'} onChange={(e) => setForm({ ...form, is_default: e.currentTarget.checked })} />
          <Switch checked={form.is_active} label={t('active')} onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })} />
          <Button color="teal" onClick={save}>{t('save')}</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
