import { useEffect, useState } from 'react';
import { Paper, Table, Button, Group, Select, Title, Badge, TextInput, Modal, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

export function PaymentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<any>(null);
  const [note, setNote] = useState('');

  const load = async () => {
    const data = await api.getPlatformInvoices({ status: status || undefined });
    setRows(data);
  };
  useEffect(() => { load().catch(() => undefined); }, [status]);

  const act = async (fn: () => Promise<any>) => {
    try {
      await fn();
      load();
      notifications.show({ title: t('success'), message: t('saved') || 'OK', color: 'green' });
    } catch (error: any) {
      notifications.show({ title: t('error'), message: error.message, color: 'red' });
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{t('payments') || 'المدفوعات'}</Title>
        <Select
          clearable
          placeholder={t('status')}
          value={status}
          onChange={setStatus}
          data={['open', 'paid', 'failed', 'void', 'refunded'].map((v) => ({ value: v, label: v }))}
        />
      </Group>
      <Paper>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t('agency')}</Table.Th>
              <Table.Th>{t('packages')}</Table.Th>
              <Table.Th>{t('amount') || 'المبلغ'}</Table.Th>
              <Table.Th>{t('status')}</Table.Th>
              <Table.Th>{t('date')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.number}</Table.Td>
                <Table.Td>
                  <Button variant="subtle" onClick={() => navigate(`/agencies/${row.agency_id}`)}>{row.agency_name}</Button>
                </Table.Td>
                <Table.Td>{row.package_slug}</Table.Td>
                <Table.Td>{Number(row.amount).toLocaleString()} {row.currency}</Table.Td>
                <Table.Td><Badge>{row.status}</Badge></Table.Td>
                <Table.Td>{new Date(row.created_at).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {row.status === 'open' && (
                      <Button size="xs" onClick={() => setNoteOpen(row)}>{t('mark_paid') || 'مدفوع'}</Button>
                    )}
                    {row.status === 'open' && (
                      <Button size="xs" variant="default" onClick={() => act(() => api.voidPlatformInvoice(row.id))}>{t('void') || 'إلغاء'}</Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
      <Modal opened={!!noteOpen} onClose={() => setNoteOpen(null)} title={t('mark_paid') || 'Mark paid'}>
        <TextInput label={t('note') || 'ملاحظة'} value={note} onChange={(e) => setNote(e.currentTarget.value)} mb="md" />
        <Button color="brown" onClick={() => act(async () => {
          await api.markPlatformInvoicePaid(noteOpen.id, note);
          setNoteOpen(null);
          setNote('');
        })}>{t('save')}</Button>
      </Modal>
    </Stack>
  );
}
