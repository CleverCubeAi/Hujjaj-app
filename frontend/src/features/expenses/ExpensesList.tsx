import React, { useEffect, useState } from 'react';
import { 
  Table, Title, Button, Group, Modal, Select, Stack, Paper, SimpleGrid, Card, Text, 
  Badge, ActionIcon, Tabs, Progress, LoadingOverlay, Container
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { notifications } from '@mantine/notifications';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseCategories } from './ExpenseCategories';
import { useAuth } from '../../providers/AuthProvider';

interface Expense {
  id: string;
  category: string;
  category_id?: string;
  expense_categories?: { name: string; name_ar?: string };
  description: string;
  amount: number;
  paid_date: string;
  season_id?: string;
  linked_resource_type?: 'accommodation' | 'flight';
  linked_resource_id?: string;
  accommodations?: { name: string; name_ar?: string };
  flights?: { code: string; departure_date: string };
  total_quantity?: number;
  used_quantity?: number;
  remaining_quantity?: number;
  unit_cost?: number;
}

interface ExpenseSummary {
  category: string;
  total_amount: number;
}

export function ExpensesList() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Expense | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await api.getExpenses();
      setExpenses(data || []);
      
      const summaryData = await api.getExpenseSummary();
      setSummary(summaryData || []);
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to load expenses',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSave = () => {
    setModalOpen(false);
    setEditingExpense(null);
    fetchExpenses();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.deleteExpense(deleteConfirm.id);
      notifications.show({
        title: t('success') || 'نجاح',
        message: t('expense_deleted') || 'Expense deleted successfully',
        color: 'green'
      });
      setDeleteConfirm(null);
      fetchExpenses();
    } catch (error: any) {
      notifications.show({
        title: t('error') || 'خطأ',
        message: error.message || 'Failed to delete expense',
        color: 'red'
      });
    }
  };


  const getCategoryName = (expense: Expense | { category: string }) => {
    if ('expense_categories' in expense && expense.expense_categories) {
      return expense.expense_categories.name_ar || expense.expense_categories.name;
    }
    // Default categories
    const defaultCategories: Record<string, string> = {
      hotels: 'الفنادق',
      visas: 'الفيز',
      transport: 'النقل',
      saudi_fees: 'السعودية',
      khalidiya: 'الخليدية',
      misc: 'المصاريف'
    };
    return defaultCategories[expense.category] || expense.category;
  };

  const totalExpenses = summary.reduce((acc, s) => acc + Number(s.total_amount), 0);

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">
        {t('expenses') || 'المصاريف'}
      </Title>

      <Tabs defaultValue="list">
        <Tabs.List>
          <Tabs.Tab value="list">
            {t('expenses_list') || 'قائمة المصاريف'}
          </Tabs.Tab>
          {isAdmin && (
            <Tabs.Tab value="categories">
              {t('expense_categories') || 'فئات المصاريف'}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="list" pt="xl">
          <Paper p="xl" pos="relative">
            <LoadingOverlay visible={loading} />
            
            <Group justify="space-between" mb="md">
              <Title order={3}>{t('expenses') || 'المصاريف'}</Title>
              {isAdmin && (
                <Button leftSection={<Plus size={16} />} onClick={() => {
                  setEditingExpense(null);
                  setModalOpen(true);
                }}>
                  {t('add_expense') || 'إضافة مصروف'}
                </Button>
              )}
            </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} mb="lg">
        {summary.map((catSummary) => (
          <Card key={catSummary.category} shadow="sm" padding="md" radius="md" withBorder>
            <Text size="xs" c="dimmed" tt="uppercase">{getCategoryName({ category: catSummary.category } as Expense)}</Text>
            <Text fw={700} size="lg">{Number(catSummary.total_amount).toLocaleString()}</Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card shadow="sm" padding="md" radius="md" withBorder mb="lg">
        <Text size="sm" c="dimmed">{t('total_expenses') || 'إجمالي المصاريف'}</Text>
        <Text fw={700} size="xl" c="blue">{totalExpenses.toLocaleString()} MAD</Text>
      </Card>


      <Paper shadow="sm" p="md">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('category') || 'الفئة'}</Table.Th>
              <Table.Th>{t('description') || 'الوصف'}</Table.Th>
              <Table.Th>{t('amount') || 'المبلغ'}</Table.Th>
              <Table.Th>{t('date') || 'التاريخ'}</Table.Th>
              {isAdmin && <Table.Th>{t('actions') || 'الإجراءات'}</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {expenses.map((expense) => (
              <Table.Tr key={expense.id}>
                <Table.Td>{getCategoryName(expense)}</Table.Td>
                <Table.Td>{expense.description}</Table.Td>
                <Table.Td>{Number(expense.amount).toLocaleString()} MAD</Table.Td>
                <Table.Td>{expense.paid_date}</Table.Td>
                {isAdmin && (
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => {
                          setEditingExpense(expense);
                          setModalOpen(true);
                        }}
                      >
                        <Edit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteConfirm(expense)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create/Edit Modal */}
      <Modal 
        opened={modalOpen} 
        onClose={() => {
          setModalOpen(false);
          setEditingExpense(null);
        }} 
        title={editingExpense ? t('edit_expense') || 'تعديل مصروف' : t('add_expense') || 'إضافة مصروف'}
        size="lg"
      >
        <ExpenseForm 
          expense={editingExpense || undefined}
          onSave={handleSave}
          onCancel={() => {
            setModalOpen(false);
            setEditingExpense(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('confirm_delete') || 'تأكيد الحذف'}
        size="sm"
      >
        <Stack>
          <Text>
            {t('confirm_delete_expense') || 'Are you sure you want to delete this expense?'}
          </Text>
          {deleteConfirm && (
            <Text size="sm" c="dimmed">
              {deleteConfirm.description} - {Number(deleteConfirm.amount).toLocaleString()} MAD
            </Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button color="red" onClick={handleDelete}>
              {t('delete') || 'حذف'}
            </Button>
          </Group>
        </Stack>
      </Modal>

          </Paper>
        </Tabs.Panel>

        {isAdmin && (
          <Tabs.Panel value="categories" pt="xl">
            <ExpenseCategories />
          </Tabs.Panel>
        )}
      </Tabs>
    </Container>
  );
}
