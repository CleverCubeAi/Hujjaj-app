import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Button,
  Group,
  Text,
  Alert
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../../lib/api';
import { AlertCircle, Send } from 'lucide-react';

interface HandoverFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'sales_to_admin' | 'expense_reimbursement';
  salesAmount?: number;  // Amount for sales_to_admin (positive balance)
  expenseAmount?: number;  // Amount for expense_reimbursement (total purchases)
  seasonId?: string | null;
}

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
}

export function HandoverFormModal({
  opened,
  onClose,
  onSuccess,
  defaultType = 'sales_to_admin',
  salesAmount = 0,
  expenseAmount = 0,
  seasonId
}: HandoverFormModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Form state
  const [handoverType, setHandoverType] = useState<string>(defaultType);
  const [amount, setAmount] = useState<number | ''>(
    defaultType === 'sales_to_admin' ? salesAmount : expenseAmount
  );
  const [handoverDate, setHandoverDate] = useState<Date | null>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Fetch team members (admins and managers)
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const users = await api.getUsers();
        // Filter for admins and managers who can receive handovers
        const admins = users.filter((u: TeamMember) => 
          ['super_admin', 'agency_admin', 'manager'].includes(u.role)
        );
        setTeamMembers(admins);
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    if (opened) {
      fetchTeamMembers();
    }
  }, [opened]);

  // Reset form when modal opens
  useEffect(() => {
    if (opened) {
      setHandoverType(defaultType);
      setAmount(defaultType === 'sales_to_admin' ? salesAmount : expenseAmount);
      setHandoverDate(new Date());
      setPaymentMethod(null);
      setPaymentReference('');
      setRecipientId(null);
      setNotes('');
    }
  }, [opened, defaultType, salesAmount, expenseAmount]);

  // Update amount when handover type changes
  const handleTypeChange = (newType: string | null) => {
    const type = newType || 'sales_to_admin';
    setHandoverType(type);
    // Automatically update amount based on selected type
    if (type === 'sales_to_admin') {
      setAmount(salesAmount || '');
    } else {
      setAmount(expenseAmount || '');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!amount || amount <= 0) {
      notifications.show({
        title: t('error'),
        message: t('amount_required') || 'المبلغ مطلوب',
        color: 'red'
      });
      return;
    }

    if (!paymentMethod) {
      notifications.show({
        title: t('error'),
        message: t('payment_method_required') || 'طريقة الدفع مطلوبة',
        color: 'red'
      });
      return;
    }

    if ((paymentMethod === 'wire' || paymentMethod === 'check') && !paymentReference) {
      notifications.show({
        title: t('error'),
        message: t('payment_reference_required') || 'رقم المرجع مطلوب للتحويل أو الشيك',
        color: 'red'
      });
      return;
    }

    if (!recipientId) {
      notifications.show({
        title: t('error'),
        message: t('recipient_required') || 'يجب تحديد المستلم',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      await api.createHandover({
        handover_type: handoverType as 'sales_to_admin' | 'expense_reimbursement',
        amount: Number(amount),
        handover_date: handoverDate?.toISOString().split('T')[0],
        payment_method: paymentMethod as 'wire' | 'check' | 'cash',
        payment_reference: paymentReference || undefined,
        recipient_user_id: recipientId,
        season_id: seasonId || undefined,
        notes: notes || undefined
      });

      notifications.show({
        title: t('success'),
        message: t('handover_created_success') || 'تم إنشاء طلب التسليم بنجاح',
        color: 'green'
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating handover:', error);
      notifications.show({
        title: t('error'),
        message: error.message || t('handover_create_error') || 'خطأ في إنشاء طلب التسليم',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('create_handover') || 'إنشاء طلب تسليم مالي'}
      size="md"
    >
      <Stack gap="md">
        <Alert icon={<AlertCircle size={16} />} color="blue" variant="light">
          {handoverType === 'sales_to_admin'
            ? (t('sales_handover_info') || 'طلب تسليم مبلغ من المبيعات للإدارة')
            : (t('expense_reimbursement_info') || 'طلب استرداد مصاريف من الإدارة')}
        </Alert>

        <Select
          label={t('handover_type') || 'نوع التسليم'}
          placeholder={t('select_type') || 'اختر النوع'}
          value={handoverType}
          onChange={handleTypeChange}
          data={[
            { value: 'sales_to_admin', label: t('sales_to_admin') || 'تسليم مبلغ للإدارة' },
            { value: 'expense_reimbursement', label: t('expense_reimbursement') || 'استرداد مصاريف' }
          ]}
          required
        />

        <NumberInput
          label={t('amount') || 'المبلغ'}
          placeholder="0.00"
          value={amount}
          onChange={(v) => setAmount(v as number)}
          min={0}
          decimalScale={2}
          thousandSeparator=" "
          suffix=" MAD"
          required
        />

        <DateInput
          label={t('handover_date') || 'تاريخ العملية'}
          placeholder={t('select_date') || 'اختر التاريخ'}
          value={handoverDate}
          onChange={setHandoverDate}
          valueFormat="YYYY-MM-DD"
          required
        />

        <Select
          label={t('payment_method') || 'طريقة الدفع'}
          placeholder={t('select_payment_method') || 'اختر طريقة الدفع'}
          value={paymentMethod}
          onChange={setPaymentMethod}
          data={[
            { value: 'cash', label: t('cash') || 'نقداً' },
            { value: 'wire', label: t('wire_transfer') || 'تحويل بنكي' },
            { value: 'check', label: t('check') || 'شيك' }
          ]}
          required
        />

        {(paymentMethod === 'wire' || paymentMethod === 'check') && (
          <TextInput
            label={paymentMethod === 'wire' 
              ? (t('wire_number') || 'رقم التحويل')
              : (t('check_number') || 'رقم الشيك')}
            placeholder={paymentMethod === 'wire'
              ? (t('enter_wire_number') || 'أدخل رقم التحويل')
              : (t('enter_check_number') || 'أدخل رقم الشيك')}
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            required
          />
        )}

        <Select
          label={t('recipient') || 'المستلم'}
          placeholder={t('select_recipient') || 'اختر المستلم'}
          value={recipientId}
          onChange={setRecipientId}
          data={teamMembers.map(m => ({
            value: m.id,
            label: `${m.full_name} (${t(m.role) || m.role})`
          }))}
          searchable
          required
        />

        <Textarea
          label={t('notes') || 'ملاحظات'}
          placeholder={t('enter_notes') || 'أدخل ملاحظات إضافية...'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={loading}>
            {t('cancel') || 'إلغاء'}
          </Button>
          <Button 
            onClick={handleSubmit} 
            loading={loading}
            leftSection={<Send size={16} />}
          >
            {t('send_handover') || 'إرسال طلب التسليم'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
