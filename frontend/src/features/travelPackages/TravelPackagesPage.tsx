import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper, Title, Button, Group, Table, Badge, Text, Select, LoadingOverlay, ActionIcon, Stack,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { Plus, Pencil, Archive } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';

const mad = (n: number) => `${Number(n || 0).toLocaleString('en')} د.م`;

const statusColor: Record<string, string> = {
  draft: 'gray',
  published: 'teal',
  archived: 'orange',
};

export function TravelPackagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === 'agency_admin' || role === 'manager';
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getTravelPackages({
        season_id: seasonId || undefined,
        status: status || undefined,
      });
      setPackages(data || []);
    } catch (error: any) {
      notifications.show({ color: 'red', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getSeasons().then((rows: any) => setSeasons(rows || [])).catch(() => setSeasons([]));
  }, []);

  useEffect(() => {
    load();
  }, [seasonId, status]);

  const archive = async (id: string) => {
    try {
      await api.archiveTravelPackage(id);
      await load();
    } catch (error: any) {
      notifications.show({ color: 'red', message: error.message });
    }
  };

  return (
    <Paper p="xl" radius="lg" pos="relative" style={{ backgroundColor: '#F8F6F0', border: '1px solid #E2D9C8' }}>
      <LoadingOverlay visible={loading} />
      <Group justify="space-between" mb="lg" wrap="wrap">
        <Title order={2}>{t('travel_packages') || 'باقات الرحلات'}</Title>
        {canEdit && (
          <Button leftSection={<Plus size={16} />} onClick={() => navigate('/travel-packages/new')}>
            {t('new_travel_package') || 'باقة جديدة'}
          </Button>
        )}
      </Group>
      <Group mb="md" grow>
        <Select
          placeholder={t('season') || 'الموسم'}
          clearable
          data={seasons.map((s) => ({ value: s.id, label: s.name }))}
          value={seasonId}
          onChange={setSeasonId}
        />
        {canEdit && (
          <Select
            placeholder={t('status') || 'الحالة'}
            clearable
            data={[
              { value: 'draft', label: t('draft') || 'مسودة' },
              { value: 'published', label: t('published') || 'منشورة' },
              { value: 'archived', label: t('archived') || 'مؤرشفة' },
            ]}
            value={status}
            onChange={setStatus}
          />
        )}
      </Group>
      {packages.length === 0 ? (
        <Text c="dimmed">{t('no_travel_packages') || 'لا توجد باقات'}</Text>
      ) : (
        <Table.ScrollContainer minWidth={720}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('package_name') || 'الاسم'}</Table.Th>
                <Table.Th>{t('season') || 'الموسم'}</Table.Th>
                <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                <Table.Th>{t('separate_total') || 'منفصل'}</Table.Th>
                <Table.Th>{t('package_price') || 'سعر الباقة'}</Table.Th>
                <Table.Th>{t('bundle_saving') || 'التوفير'}</Table.Th>
                <Table.Th>{t('places_left') || 'الأماكن'}</Table.Th>
                {canEdit && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {packages.map((pkg) => (
                <Table.Tr key={pkg.id}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text fw={600}>{pkg.name_ar || pkg.name}</Text>
                      <Text size="xs" c="dimmed">{pkg.flight?.code || ''}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>{pkg.season?.name || '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={statusColor[pkg.status] || 'gray'} variant="light">
                      {t(pkg.status) || pkg.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{mad(pkg.calculated_price)}</Table.Td>
                  <Table.Td>{mad(pkg.selling_price)}</Table.Td>
                  <Table.Td>{mad(pkg.saving)}</Table.Td>
                  <Table.Td>{pkg.places_left ?? '—'}</Table.Td>
                  {canEdit && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <ActionIcon variant="subtle" onClick={() => navigate(`/travel-packages/${pkg.id}`)} disabled={pkg.status === 'archived'}>
                          <Pencil size={16} />
                        </ActionIcon>
                        {pkg.status !== 'archived' && (
                          <ActionIcon variant="subtle" color="orange" onClick={() => archive(pkg.id)}>
                            <Archive size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}
