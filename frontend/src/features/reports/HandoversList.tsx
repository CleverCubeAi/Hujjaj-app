import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  Badge,
  Group,
  Text,
  Select,
  Button,
  Stack,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  Box
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Eye, RefreshCw, Filter } from 'lucide-react';

interface Handover {
  id: string;
  handover_type: 'sales_to_admin' | 'expense_reimbursement';
  amount: number;
  handover_date: string;
  payment_method: 'wire' | 'check' | 'cash';
  payment_reference?: string;
  status: 'sent' | 'pending' | 'received' | 'refused' | 'canceled';
  notes?: string;
  created_at: string;
  creator?: { id: string; full_name: string };
  recipient?: { id: string; full_name: string };
  seasons?: { id: string; name: string };
}

interface HandoversListProps {
  seasonId?: string | null;
  onViewDetails: (handover: Handover) => void;
  refreshTrigger?: number;
}

export function HandoversList({ seasonId, onViewDetails, refreshTrigger }: HandoversListProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [handovers, setHandovers] = useState<Handover[]>([]);

  // Filters
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchHandovers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (seasonId) params.season_id = seasonId;
      if (filterType) params.handover_type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterDateFrom) params.date_from = filterDateFrom.toISOString().split('T')[0];
      if (filterDateTo) params.date_to = filterDateTo.toISOString().split('T')[0];

      const data = await api.getHandovers(params);
      setHandovers(data || []);
    } catch (error) {
      console.error('Error fetching handovers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandovers();
  }, [seasonId, filterType, filterStatus, filterDateFrom, filterDateTo, refreshTrigger]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-MA');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'blue';
      case 'pending': return 'yellow';
      case 'received': return 'green';
      case 'refused': return 'red';
      case 'canceled': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'sent': t('status_sent') || 'مرسل',
      'pending': t('status_pending') || 'قيد المراجعة',
      'received': t('status_received') || 'تم الاستلام',
      'refused': t('status_refused') || 'مرفوض',
      'canceled': t('status_canceled') || 'ملغى'
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type: string) => {
    return type === 'sales_to_admin'
      ? (t('sales_to_admin') || 'تسليم مبلغ للإدارة')
      : (t('expense_reimbursement') || 'استرداد مصاريف');
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'cash': t('cash') || 'نقداً',
      'wire': t('wire_transfer') || 'تحويل بنكي',
      'check': t('check') || 'شيك'
    };
    return labels[method] || method;
  };

  return (
    <Paper p="md" withBorder radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="lg">{t('financial_handovers') || 'التسليمات المالية'}</Text>
          <Group>
            <Button
              variant="light"
              size="xs"
              leftSection={<Filter size={14} />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {t('filters') || 'فلاتر'}
            </Button>
            <ActionIcon variant="light" onClick={fetchHandovers}>
              <RefreshCw size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {showFilters && (
          <Group grow>
            <Select
              placeholder={t('all_types') || 'جميع الأنواع'}
              value={filterType}
              onChange={setFilterType}
              clearable
              size="xs"
              data={[
                { value: 'sales_to_admin', label: t('sales_to_admin') || 'تسليم مبلغ للإدارة' },
                { value: 'expense_reimbursement', label: t('expense_reimbursement') || 'استرداد مصاريف' }
              ]}
            />
            <Select
              placeholder={t('all_statuses') || 'جميع الحالات'}
              value={filterStatus}
              onChange={setFilterStatus}
              clearable
              size="xs"
              data={[
                { value: 'sent', label: t('status_sent') || 'مرسل' },
                { value: 'pending', label: t('status_pending') || 'قيد المراجعة' },
                { value: 'received', label: t('status_received') || 'تم الاستلام' },
                { value: 'refused', label: t('status_refused') || 'مرفوض' },
                { value: 'canceled', label: t('status_canceled') || 'ملغى' }
              ]}
            />
            <DateInput
              placeholder={t('from_date') || 'من تاريخ'}
              value={filterDateFrom}
              onChange={setFilterDateFrom}
              clearable
              size="xs"
            />
            <DateInput
              placeholder={t('to_date') || 'إلى تاريخ'}
              value={filterDateTo}
              onChange={setFilterDateTo}
              clearable
              size="xs"
            />
          </Group>
        )}

        <Box pos="relative" mih={200}>
          <LoadingOverlay visible={loading} />
          
          {handovers.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('type') || 'النوع'}</Table.Th>
                  <Table.Th>{t('amount') || 'المبلغ'}</Table.Th>
                  <Table.Th>{t('date') || 'التاريخ'}</Table.Th>
                  <Table.Th>{t('payment_method') || 'طريقة الدفع'}</Table.Th>
                  <Table.Th>{t('from') || 'من'}</Table.Th>
                  <Table.Th>{t('to') || 'إلى'}</Table.Th>
                  <Table.Th>{t('status') || 'الحالة'}</Table.Th>
                  <Table.Th>{t('actions') || 'إجراءات'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {handovers.map((handover) => (
                  <Table.Tr key={handover.id}>
                    <Table.Td>
                      <Badge 
                        variant="light" 
                        color={handover.handover_type === 'sales_to_admin' ? 'blue' : 'orange'}
                        size="sm"
                      >
                        {getTypeLabel(handover.handover_type)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600}>{formatCurrency(handover.amount)}</Text>
                    </Table.Td>
                    <Table.Td>{formatDate(handover.handover_date)}</Table.Td>
                    <Table.Td>
                      {getPaymentMethodLabel(handover.payment_method)}
                      {handover.payment_reference && (
                        <Text size="xs" c="dimmed">#{handover.payment_reference}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>{handover.creator?.full_name || '-'}</Table.Td>
                    <Table.Td>{handover.recipient?.full_name || '-'}</Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(handover.status)} variant="light">
                        {getStatusLabel(handover.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={t('view_details') || 'عرض التفاصيل'}>
                        <ActionIcon 
                          variant="light" 
                          color="blue"
                          onClick={() => onViewDetails(handover)}
                        >
                          <Eye size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text ta="center" c="dimmed" py="xl">
              {t('no_handovers') || 'لا توجد تسليمات مالية'}
            </Text>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
