import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Paper,
  Select,
  Textarea,
  Button,
  Timeline,
  Divider,
  LoadingOverlay,
  Box,
  ThemeIcon,
  Alert
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface HandoverStatusModalProps {
  opened: boolean;
  onClose: () => void;
  onStatusChanged: () => void;
  handoverId: string | null;
  isAdmin: boolean;
}

interface StatusHistoryItem {
  id: string;
  old_status: string | null;
  new_status: string;
  notes: string | null;
  changed_at: string;
  changed_by_user?: { id: string; full_name: string };
}

interface HandoverDetails {
  id: string;
  handover_type: 'sales_to_admin' | 'expense_reimbursement';
  amount: number;
  handover_date: string;
  payment_method: 'wire' | 'check' | 'cash';
  payment_reference?: string;
  status: string;
  notes?: string;
  created_at: string;
  creator?: { id: string; full_name: string };
  recipient?: { id: string; full_name: string };
  seasons?: { id: string; name: string };
  status_history: StatusHistoryItem[];
}

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'sent': ['pending', 'canceled'],
  'pending': ['received', 'refused', 'canceled'],
  'received': [],
  'refused': [],
  'canceled': []
};

export function HandoverStatusModal({
  opened,
  onClose,
  onStatusChanged,
  handoverId,
  isAdmin
}: HandoverStatusModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [handover, setHandover] = useState<HandoverDetails | null>(null);
  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [statusNotes, setStatusNotes] = useState('');

  // Fetch handover details
  useEffect(() => {
    const fetchHandover = async () => {
      if (!handoverId || !opened) return;

      setLoading(true);
      try {
        const data = await api.getHandoverById(handoverId);
        setHandover(data);
        setNewStatus(null);
        setStatusNotes('');
      } catch (error) {
        console.error('Error fetching handover:', error);
        notifications.show({
          title: t('error'),
          message: t('error_fetching_handover') || 'خطأ في جلب بيانات التسليم',
          color: 'red'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHandover();
  }, [handoverId, opened]);

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

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-MA');
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Send size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'received': return <CheckCircle size={14} />;
      case 'refused': return <XCircle size={14} />;
      case 'canceled': return <Ban size={14} />;
      default: return <Clock size={14} />;
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

  const getAvailableTransitions = () => {
    if (!handover) return [];
    const transitions = VALID_TRANSITIONS[handover.status] || [];
    return transitions.map(status => ({
      value: status,
      label: getStatusLabel(status)
    }));
  };

  const handleUpdateStatus = async () => {
    if (!handover || !newStatus) return;

    if (newStatus === 'refused' && !statusNotes) {
      notifications.show({
        title: t('error'),
        message: t('notes_required_for_refusal') || 'الملاحظات مطلوبة عند الرفض',
        color: 'red'
      });
      return;
    }

    setUpdating(true);
    try {
      await api.updateHandoverStatus(handover.id, {
        status: newStatus,
        notes: statusNotes || undefined
      });

      notifications.show({
        title: t('success'),
        message: t('status_updated_success') || 'تم تحديث الحالة بنجاح',
        color: 'green'
      });

      onStatusChanged();
      onClose();
    } catch (error: any) {
      console.error('Error updating status:', error);
      notifications.show({
        title: t('error'),
        message: error.message || t('status_update_error') || 'خطأ في تحديث الحالة',
        color: 'red'
      });
    } finally {
      setUpdating(false);
    }
  };

  const canChangeStatus = isAdmin && handover && VALID_TRANSITIONS[handover.status]?.length > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('handover_details') || 'تفاصيل التسليم المالي'}
      size="lg"
    >
      <Box pos="relative" mih={300}>
        <LoadingOverlay visible={loading} />

        {handover && (
          <Stack gap="md">
            {/* Handover Summary */}
            <Paper p="md" withBorder radius="md" bg="gray.0">
              <Group justify="space-between" mb="sm">
                <Badge 
                  size="lg" 
                  variant="light"
                  color={handover.handover_type === 'sales_to_admin' ? 'blue' : 'orange'}
                >
                  {getTypeLabel(handover.handover_type)}
                </Badge>
                <Badge size="lg" color={getStatusColor(handover.status)}>
                  {getStatusLabel(handover.status)}
                </Badge>
              </Group>

              <Text fw={700} size="xl" ta="center" my="md">
                {formatCurrency(handover.amount)}
              </Text>

              <Group justify="space-between" mt="md">
                <div>
                  <Text size="xs" c="dimmed">{t('date') || 'التاريخ'}</Text>
                  <Text fw={500}>{formatDate(handover.handover_date)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">{t('payment_method') || 'طريقة الدفع'}</Text>
                  <Text fw={500}>
                    {getPaymentMethodLabel(handover.payment_method)}
                    {handover.payment_reference && ` (#${handover.payment_reference})`}
                  </Text>
                </div>
              </Group>

              <Group justify="space-between" mt="md">
                <div>
                  <Text size="xs" c="dimmed">{t('from') || 'من'}</Text>
                  <Text fw={500}>{handover.creator?.full_name || '-'}</Text>
                </div>
                <ArrowRight size={20} />
                <div>
                  <Text size="xs" c="dimmed">{t('to') || 'إلى'}</Text>
                  <Text fw={500}>{handover.recipient?.full_name || '-'}</Text>
                </div>
              </Group>

              {handover.notes && (
                <Paper p="sm" mt="md" bg="white" radius="sm">
                  <Text size="xs" c="dimmed">{t('notes') || 'ملاحظات'}</Text>
                  <Text size="sm">{handover.notes}</Text>
                </Paper>
              )}
            </Paper>

            {/* Status Change Section (Admin Only) */}
            {canChangeStatus && (
              <>
                <Divider label={t('change_status') || 'تغيير الحالة'} labelPosition="center" />
                
                <Paper p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Select
                      label={t('new_status') || 'الحالة الجديدة'}
                      placeholder={t('select_status') || 'اختر الحالة'}
                      value={newStatus}
                      onChange={setNewStatus}
                      data={getAvailableTransitions()}
                    />

                    <Textarea
                      label={t('status_notes') || 'ملاحظات تغيير الحالة'}
                      placeholder={t('enter_notes') || 'أدخل ملاحظات...'}
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      rows={2}
                      required={newStatus === 'refused'}
                    />

                    {newStatus === 'refused' && (
                      <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                        {t('refusal_notes_required') || 'الملاحظات مطلوبة عند رفض التسليم'}
                      </Alert>
                    )}

                    <Button
                      onClick={handleUpdateStatus}
                      loading={updating}
                      disabled={!newStatus}
                      fullWidth
                    >
                      {t('update_status') || 'تحديث الحالة'}
                    </Button>
                  </Stack>
                </Paper>
              </>
            )}

            {/* Status History Timeline */}
            <Divider label={t('status_history') || 'سجل الحالات'} labelPosition="center" />
            
            <Timeline active={handover.status_history.length - 1} bulletSize={24} lineWidth={2}>
              {handover.status_history.map((item) => (
                <Timeline.Item
                  key={item.id}
                  bullet={
                    <ThemeIcon
                      size={24}
                      radius="xl"
                      color={getStatusColor(item.new_status)}
                    >
                      {getStatusIcon(item.new_status)}
                    </ThemeIcon>
                  }
                  title={
                    <Group gap="xs">
                      {item.old_status && (
                        <>
                          <Badge size="sm" variant="light" color={getStatusColor(item.old_status)}>
                            {getStatusLabel(item.old_status)}
                          </Badge>
                          <ArrowRight size={14} />
                        </>
                      )}
                      <Badge size="sm" color={getStatusColor(item.new_status)}>
                        {getStatusLabel(item.new_status)}
                      </Badge>
                    </Group>
                  }
                >
                  <Text size="xs" c="dimmed" mt={4}>
                    {formatDateTime(item.changed_at)}
                    {item.changed_by_user && ` - ${item.changed_by_user.full_name}`}
                  </Text>
                  {item.notes && (
                    <Text size="sm" mt={4}>{item.notes}</Text>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>

            {/* Close Button */}
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={onClose}>
                {t('close') || 'إغلاق'}
              </Button>
            </Group>
          </Stack>
        )}
      </Box>
    </Modal>
  );
}
