import React, { useEffect, useState } from 'react';
import {
  Stack,
  Select,
  TextInput,
  NumberInput,
  Button,
  Group
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';

interface ExpenseFormProps {
  expense?: any;
  onSave: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ expense, onSave, onCancel }: ExpenseFormProps) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [form, setForm] = useState<{
    category: string;
    category_id: string | null;
    description: string;
    amount: number;
    paid_date: string | null;
    season_id: string;
    linked_resource_type?: string | null;
    linked_resource_id?: string | null;
    expense_type?: string;
    total_quantity?: number;
    unit_cost?: number;
  }>({
    category: '',
    category_id: null,
    description: '',
    amount: 0,
    paid_date: null,
    season_id: ''
  });

  useEffect(() => {
    loadCategories();
    loadSeasons();
  }, []);

  useEffect(() => {
    if (form.season_id && form.linked_resource_type) {
      // Placeholder handlers for linked resource loading
      if (form.linked_resource_type === 'accommodation') {
        // loadAccommodations(form.season_id);
      } else if (form.linked_resource_type === 'flight') {
        // loadFlights(form.season_id);
      }
    }
  }, [form.season_id, form.linked_resource_type]);

  useEffect(() => {
    if (expense) {
      setForm({
        expense_type: expense.expense_type || 'simple',
        category: expense.category || '',
        category_id: expense.category_id || null,
        description: expense.description || '',
        amount: expense.amount || 0,
        paid_date: expense.paid_date ? expense.paid_date : null,
        season_id: expense.season_id || '',
        linked_resource_type: expense.linked_resource_type || null,
        linked_resource_id: expense.linked_resource_id || null,
        total_quantity: expense.total_quantity || 0,
        unit_cost: expense.unit_cost || 0
      });
    }
  }, [expense]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const data = await api.getExpenseCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data || []);
    } catch (error) {
      console.error('Error loading seasons:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!form.amount) {
        notifications.show({
          title: t('error') || 'خطأ',
          message: t('amount_required') || 'Amount is required',
          color: 'red'
        });
        return;
      }

      const payload: any = {
        description: form.description,
        amount: form.amount,
        paid_date: form.paid_date || null,
        season_id: form.season_id || null
      };

      // Category (default or custom)
      if (form.category_id) {
        payload.category_id = form.category_id;
      } else if (form.category) {
        payload.category = form.category;
      }

      if (expense) {
        await api.updateExpense(expense.id, payload);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('expense_updated') || 'Expense updated successfully',
          color: 'green'
        });
      } else {
        await api.createExpense(payload);
        notifications.show({
          title: t('success') || 'نجاح',
          message: t('expense_created') || 'Expense created successfully',
          color: 'green'
        });
      }
      onSave();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to save expense',
        color: 'red'
      });
    }
  };

  const categoryOptions = React.useMemo(() => {
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return [];
    }
    try {
      return categories
        .filter(cat => cat && cat !== null && cat !== undefined && cat.is_active !== false)
        .map(cat => {
          const value = String(cat.id || cat.value || (cat.name ? cat.name.toLowerCase().replace(/\s+/g, '_') : ''));
          const label = cat.name_ar || cat.name || '';
          if (!value || !label) return null;
          return { value: String(value), label: String(label) };
        })
        .filter((item): item is { value: string; label: string } => item !== null);
    } catch (error) {
      console.error('Error processing categories:', error);
      return [];
    }
  }, [categories]);

  return (
    <Stack gap="md">
      <Select
        label={t('category') || 'الفئة'}
        value={form.category_id || form.category || ''}
        onChange={(value) => {
          if (!value) {
            setForm({ ...form, category: '', category_id: null });
            return;
          }
          const selected = categories.find(c => 
            c && ((c.id === value) || 
            (c.value === value) || 
            (c.name?.toLowerCase().replace(/\s+/g, '_') === value))
          );
          if (selected?.is_default) {
            setForm({ 
              ...form, 
              category: selected.value || selected.name?.toLowerCase().replace(/\s+/g, '_') || '', 
              category_id: null 
            });
          } else if (selected?.id) {
            setForm({ ...form, category_id: selected.id, category: '' });
          }
        }}
        data={categoryOptions}
        searchable
        disabled={loadingCategories}
        placeholder={loadingCategories ? t('loading') || 'جاري التحميل...' : undefined}
      />

      <TextInput
        label={t('description') || 'الوصف'}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
      />

      <Select
        label={t('season') || 'الموسم'}
        value={form.season_id}
        onChange={(value) => setForm({ ...form, season_id: value || '' })}
        data={seasons.map(s => ({ value: String(s.id || ''), label: s.name || '' }))}
        searchable
        clearable
      />

      <DateInput
        label={t('paid_date') || 'تاريخ الدفع'}
        value={form.paid_date}
        onChange={(date) => setForm({ ...form, paid_date: date })}
      />

      <NumberInput
        label={t('amount') || 'المبلغ (MAD)'}
        value={form.amount}
        onChange={(value) => setForm({ ...form, amount: Number(value) || 0 })}
        required
        min={0}
        decimalScale={2}
      />

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onCancel}>
          {t('cancel') || 'إلغاء'}
        </Button>
        <Button onClick={handleSubmit}>
          {t('save') || 'حفظ'}
        </Button>
      </Group>
    </Stack>
  );
}
