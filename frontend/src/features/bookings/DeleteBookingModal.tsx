import React, { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Alert,
  PasswordInput,
  Textarea,
  Checkbox,
  Button,
  Group,
  List,
  ThemeIcon
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { AlertTriangle, Trash2, Check } from 'lucide-react';

interface DeleteBookingModalProps {
  opened: boolean;
  onClose: () => void;
  bookingId: string;
  bookingNumber: string;
  onDeleted: () => void;
}

export function DeleteBookingModal({
  opened,
  onClose,
  bookingId,
  bookingNumber,
  onDeleted
}: DeleteBookingModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    deletion_password: '',
    reason: '',
    confirmed: false
  });

  const handleDelete = async () => {
    if (!form.deletion_password) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('deletion_password_required') || 'كلمة مرور الحذف مطلوبة',
        color: 'red'
      });
      return;
    }

    if (!form.confirmed) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: t('confirm_deletion_required') || 'يجب تأكيد الحذف',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const result = await api.softDeleteBooking(bookingId, {
        deletion_password: form.deletion_password,
        reason: form.reason || undefined
      });
      
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('booking_deleted_successfully') || 'تم حذف الحجز بنجاح',
        color: 'green'
      });

      // Show rollback summary
      if (result.rollback_summary) {
        const summary = result.rollback_summary;
        console.log('Rollback summary:', summary);
      }
      
      setForm({
        deletion_password: '',
        reason: '',
        confirmed: false
      });
      
      onDeleted();
      onClose();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to delete booking',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      deletion_password: '',
      reason: '',
      confirmed: false
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <Trash2 size={20} color="red" />
          <Text fw={600}>{t('delete_booking') || 'حذف الحجز'}</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        <Alert icon={<AlertTriangle size={16} />} color="red" variant="light">
          <Text fw={600} mb="xs">
            {t('delete_warning_title') || 'تحذير: هذا الإجراء لا يمكن التراجع عنه'}
          </Text>
          <Text size="sm">
            {t('delete_booking_warning_full') || `أنت على وشك حذف الحجز رقم ${bookingNumber} نهائياً. هذا الحجز ملغى ويمكن حذفه الآن.`}
          </Text>
        </Alert>

        <div>
          <Text fw={600} mb="xs">{t('what_will_be_rolled_back') || 'ما سيتم التراجع عنه:'}</Text>
          <List
            spacing="xs"
            size="sm"
            icon={
              <ThemeIcon color="orange" size={20} radius="xl">
                <Check size={12} />
              </ThemeIcon>
            }
          >
            <List.Item>{t('room_allocations_released') || 'تحرير حجوزات الغرف (استعادة المخزون)'}</List.Item>
            <List.Item>{t('flight_allocations_released') || 'تحرير مقاعد الطيران (استعادة المخزون)'}</List.Item>
            <List.Item>{t('room_assignments_deleted') || 'حذف توزيعات الغرف'}</List.Item>
            <List.Item>{t('invoice_items_deleted') || 'حذف عناصر الفاتورة'}</List.Item>
            <List.Item>{t('payments_deleted') || 'حذف سجلات الدفع'}</List.Item>
            <List.Item>{t('pilgrims_unlinked') || 'فصل المعتمرين من الحجز (يبقون في النظام)'}</List.Item>
          </List>
        </div>

        <PasswordInput
          label={t('deletion_password') || 'كلمة مرور الحذف'}
          description={t('enter_deletion_password') || 'أدخل كلمة مرور الحذف الخاصة بك'}
          value={form.deletion_password}
          onChange={(e) => setForm({ ...form, deletion_password: e.currentTarget.value })}
          required
        />

        <Textarea
          label={t('deletion_reason') || 'سبب الحذف (اختياري)'}
          placeholder={t('deletion_reason_placeholder') || 'أدخل سبب حذف هذا الحجز...'}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.currentTarget.value })}
          rows={3}
        />

        <Checkbox
          label={t('confirm_delete_booking') || `أؤكد أنني أريد حذف الحجز ${bookingNumber} وجميع البيانات المرتبطة به`}
          checked={form.confirmed}
          onChange={(e) => setForm({ ...form, confirmed: e.currentTarget.checked })}
          color="red"
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose} disabled={loading}>
            {t('cancel') || 'إلغاء'}
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            loading={loading}
            disabled={!form.confirmed || !form.deletion_password}
            leftSection={<Trash2 size={16} />}
          >
            {t('delete_booking') || 'حذف الحجز'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
