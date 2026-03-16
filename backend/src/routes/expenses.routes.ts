import { Router } from 'express';
import * as expensesController from '../controllers/expenses.controller';

const router = Router();

router.get('/', expensesController.listExpenses);
router.post('/', expensesController.createExpense);
router.put('/:id', expensesController.updateExpense);
router.delete('/:id', expensesController.deleteExpense);
router.get('/summary', expensesController.getExpenseSummary);

export default router;
