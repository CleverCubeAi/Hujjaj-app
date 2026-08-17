import { useEffect, useState } from 'react';
import {
  Paper,
  Title,
  Group,
  Select,
  Table,
  Progress,
  Badge,
  Text,
  Card,
  SimpleGrid,
  LoadingOverlay,
  Modal,
  Stack,
  ActionIcon
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Eye } from 'lucide-react';

interface PrepaymentExpense {
  id: string;
  description: string;
  amount: number;
  linked_resource_type: 'accommodation' | 'flight';
  linked_resource_id: string;
  accommodations?: { name: string; name_ar?: string };
  flights?: { code: string; departure_date: string };
  total_quantity: number;
  used_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  paid_date: string;
}

export function PrepaymentBalances() {
  const { t } = useTranslation();
  const [prepayments, setPrepayments] = useState<PrepaymentExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | null>('all');
  const [viewingAllocations, setViewingAllocations] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<any[]>([]);

  const fetchPrepayments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (resourceTypeFilter && resourceTypeFilter !== 'all') {
        params.resource_type = resourceTypeFilter;
      }
      const data = await api.getPrepaymentBalances(params);
      setPrepayments(data || []);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load prepayment balances',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrepayments();
  }, [resourceTypeFilter]);

  const handleViewAllocations = async (expenseId: string) => {
    try {
      const data = await api.getExpenseAllocations(expenseId);
      setAllocations(data || []);
      setViewingAllocations(expenseId);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load allocations',
        color: 'red'
      });
    }
  };

  const totalPrepayments = prepayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalUsed = prepayments.reduce((acc, p) => acc + (Number(p.used_quantity) * Number(p.unit_cost)), 0);
  const totalRemaining = prepayments.reduce((acc, p) => acc + (Number(p.remaining_quantity) * Number(p.unit_cost)), 0);

  return (
    <Paper p="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {t('prepayment_balances') || 'أرصدة الدفعات المقدمة'}
        </Title>
        <Select
          value={resourceTypeFilter}
          onChange={(value) => setResourceTypeFilter(value)}
          data={[
            { value: 'all', label: t('all') || 'الكل' },
            { value: 'accommodation', label: t('accommodations') || 'السكن' },
            { value: 'flight', label: t('flights') || 'الرحلات' }
          ]}
          style={{ width: 200 }}
        />
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('total_prepayments') || 'إجمالي الدفعات المقدمة'}</Text>
          <Text fw={700} size="xl" c="gold">{totalPrepayments.toLocaleString()} MAD</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('total_used') || 'المستخدم'}</Text>
          <Text fw={700} size="xl" c="orange">{totalUsed.toLocaleString()} MAD</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase">{t('total_remaining') || 'المتبقي'}</Text>
          <Text fw={700} size="xl" c="green">{totalRemaining.toLocaleString()} MAD</Text>
        </Card>
      </SimpleGrid>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('resource') || 'المورد'}</Table.Th>
            <Table.Th>{t('description') || 'الوصف'}</Table.Th>
            <Table.Th>{t('total_quantity') || 'الكمية الإجمالية'}</Table.Th>
            <Table.Th>{t('used') || 'مستخدم'}</Table.Th>
            <Table.Th>{t('remaining') || 'متبقي'}</Table.Th>
            <Table.Th>{t('usage') || 'الاستخدام'}</Table.Th>
            <Table.Th>{t('total_amount') || 'المبلغ الإجمالي'}</Table.Th>
            <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {prepayments.map((prepayment) => {
            const usagePercent = prepayment.total_quantity 
              ? ((prepayment.used_quantity || 0) / prepayment.total_quantity) * 100 
              : 0;
            
            return (
              <Table.Tr key={prepayment.id}>
                <Table.Td>
                  <Badge color={prepayment.linked_resource_type === 'accommodation' ? 'teal' : 'gold'}>
                    {prepayment.linked_resource_type === 'accommodation' 
                      ? t('accommodation') || 'السكن'
                      : t('flight') || 'الرحلة'}
                  </Badge>
                  <Text size="sm" mt={4}>
                    {prepayment.linked_resource_type === 'accommodation'
                      ? prepayment.accommodations?.name_ar || prepayment.accommodations?.name || '-'
                      : prepayment.flights?.code || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>{prepayment.description}</Table.Td>
                <Table.Td>{prepayment.total_quantity}</Table.Td>
                <Table.Td>{prepayment.used_quantity || 0}</Table.Td>
                <Table.Td>
                  <Badge color={prepayment.remaining_quantity && prepayment.remaining_quantity > 0 ? 'green' : 'red'}>
                    {prepayment.remaining_quantity || 0}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Text size="xs">{usagePercent.toFixed(1)}%</Text>
                    <Progress 
                      value={usagePercent}
                      size="sm"
                      color={usagePercent < 50 ? 'green' : usagePercent < 90 ? 'yellow' : 'red'}
                    />
                  </Stack>
                </Table.Td>
                <Table.Td>{Number(prepayment.amount).toLocaleString()} MAD</Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="teal"
                    onClick={() => handleViewAllocations(prepayment.id)}
                  >
                    <Eye size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {/* Allocations Modal */}
      <Modal
        opened={!!viewingAllocations}
        onClose={() => {
          setViewingAllocations(null);
          setAllocations([]);
        }}
        title={t('expense_allocations') || 'توزيعات المصروف'}
        size="lg"
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('booking_number') || 'رقم الحجز'}</Table.Th>
              <Table.Th>{t('client') || 'العميل'}</Table.Th>
              <Table.Th>{t('quantity') || 'الكمية'}</Table.Th>
              <Table.Th>{t('allocated_at') || 'تاريخ التوزيع'}</Table.Th>
              <Table.Th>{t('allocated_by') || 'تم التوزيع بواسطة'}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allocations.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">{t('no_allocations') || 'لا توجد توزيعات'}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              allocations.map((alloc) => (
                <Table.Tr key={alloc.id}>
                  <Table.Td>{alloc.bookings?.booking_number || '-'}</Table.Td>
                  <Table.Td>
                    {alloc.bookings?.clients?.full_name_ar || alloc.bookings?.clients?.full_name || '-'}
                  </Table.Td>
                  <Table.Td>{alloc.quantity}</Table.Td>
                  <Table.Td>{new Date(alloc.allocated_at).toLocaleDateString()}</Table.Td>
                  <Table.Td>{alloc.users?.full_name || '-'}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Modal>
    </Paper>
  );
}
