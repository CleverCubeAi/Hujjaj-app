import React, { useEffect, useState } from 'react';
import { Table, Badge, Title, Button, Group, Modal, TextInput, Select, Stack, Paper, ActionIcon, Menu } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';

interface Season {
  id: string;
  name: string;
  type: 'hajj' | 'omra' | 'ramadan';
  start_date: string;
  end_date: string;
  status: string;
}

interface FormState {
  name: string;
  type: string;
  start_date: Date | null;
  end_date: Date | null;
  status: string;
}

const emptyForm: FormState = { name: '', type: 'omra', start_date: null, end_date: null, status: 'draft' };

const formatDateForApi = (date: Date | null): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

export function SeasonsList() {
  const { t } = useTranslation();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);

  const fetchSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data);
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  const openCreateModal = () => {
    setEditingSeason(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (season: Season) => {
    setEditingSeason(season);
    setForm({
      name: season.name,
      type: season.type,
      start_date: parseDate(season.start_date),
      end_date: parseDate(season.end_date),
      status: season.status || 'draft',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      console.error('Please fill all required fields');
      return;
    }
    
    const startDateStr = formatDateForApi(form.start_date);
    const endDateStr = formatDateForApi(form.end_date);
    
    if (!startDateStr || !endDateStr) {
      console.error('Invalid date format');
      return;
    }
    
    try {
      const payload = {
        name: form.name,
        type: form.type,
        start_date: startDateStr,
        end_date: endDateStr,
        status: form.status,
      };

      if (editingSeason) {
        await api.updateSeason(editingSeason.id, payload);
      } else {
        await api.createSeason(payload);
      }
      
      setModalOpen(false);
      setForm(emptyForm);
      setEditingSeason(null);
      fetchSeasons();
    } catch (error) {
      console.error('Error saving season:', error);
    }
  };

  const handleDelete = async () => {
    if (!seasonToDelete) return;
    
    try {
      await api.deleteSeason(seasonToDelete.id);
      setDeleteConfirmOpen(false);
      setSeasonToDelete(null);
      fetchSeasons();
    } catch (error) {
      console.error('Error deleting season:', error);
    }
  };

  const confirmDelete = (season: Season) => {
    setSeasonToDelete(season);
    setDeleteConfirmOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'draft': return 'gray';
      case 'completed': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('seasons')}</Title>
        <Button leftSection={<Plus size={16} />} onClick={openCreateModal}>
          {t('add_season')}
        </Button>
      </Group>

      <Paper shadow="sm" p="md">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('name')}</Table.Th>
              <Table.Th>{t('type')}</Table.Th>
              <Table.Th>{t('start_date')}</Table.Th>
              <Table.Th>{t('end_date')}</Table.Th>
              <Table.Th>{t('status')}</Table.Th>
              <Table.Th>{t('actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {seasons.map((season) => (
              <Table.Tr key={season.id}>
                <Table.Td>{season.name}</Table.Td>
                <Table.Td><Badge>{t(season.type) || season.type}</Badge></Table.Td>
                <Table.Td>{season.start_date}</Table.Td>
                <Table.Td>{season.end_date}</Table.Td>
                <Table.Td>
                  <Badge color={getStatusColor(season.status)}>{t(season.status || 'draft')}</Badge>
                </Table.Td>
                <Table.Td>
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <MoreVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<Edit size={14} />} onClick={() => openEditModal(season)}>
                        {t('edit')}
                      </Menu.Item>
                      <Menu.Item leftSection={<Trash2 size={14} />} color="red" onClick={() => confirmDelete(season)}>
                        {t('delete')}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create/Edit Modal */}
      <Modal 
        opened={modalOpen} 
        onClose={() => { setModalOpen(false); setEditingSeason(null); }} 
        title={editingSeason ? t('edit_season') : t('add_new_season')}
      >
        <Stack>
          <TextInput
            label={t('season_name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Select
            label={t('type')}
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value || 'omra' })}
            data={[
              { value: 'hajj', label: t('hajj') },
              { value: 'omra', label: t('omra') },
              { value: 'ramadan', label: t('ramadan') },
            ]}
          />
          <DateInput
            label={t('start_date')}
            required
            valueFormat="YYYY-MM-DD"
            value={form.start_date}
            onChange={(date) => {
              const validDate = date ? (date instanceof Date ? date : new Date(date)) : null;
              setForm({ ...form, start_date: validDate });
            }}
          />
          <DateInput
            label={t('end_date')}
            required
            valueFormat="YYYY-MM-DD"
            value={form.end_date}
            onChange={(date) => {
              const validDate = date ? (date instanceof Date ? date : new Date(date)) : null;
              setForm({ ...form, end_date: validDate });
            }}
          />
          {editingSeason && (
            <Select
              label={t('status')}
              value={form.status}
              onChange={(value) => setForm({ ...form, status: value || 'draft' })}
              data={[
                { value: 'draft', label: t('draft') },
                { value: 'active', label: t('active') },
                { value: 'completed', label: t('completed') },
              ]}
            />
          )}
          <Button 
            onClick={handleSubmit}
            disabled={!form.name || !form.start_date || !form.end_date}
          >
            {editingSeason ? t('update_season') : t('create_season')}
          </Button>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setSeasonToDelete(null); }}
        title={t('confirm_delete')}
        size="sm"
      >
        <Stack>
          <p>{t('confirm_delete_season', { name: seasonToDelete?.name || '' })}</p>
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>{t('cancel')}</Button>
            <Button color="red" onClick={handleDelete}>{t('delete')}</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
