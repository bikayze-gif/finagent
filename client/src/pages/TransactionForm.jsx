import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTransaction, useUpdateTransaction } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';

const schema = z.object({
  description: z.string().min(1, 'Descripción requerida'),
  amount: z.coerce.number().positive('Monto debe ser positivo'),
  type: z.enum(['income', 'expense', 'transfer']),
  categoryId: z.coerce.number().int().positive().optional(),
  accountId: z.coerce.number().int().positive({ message: 'Cuenta requerida' }),
  transferToAccountId: z.coerce.number().int().positive().optional(),
  date: z.string().min(1, 'Fecha requerida'),
  notes: z.string().optional(),
});

const TYPES = [
  { value: 'income', label: 'Ingreso' },
  { value: 'expense', label: 'Gasto' },
  { value: 'transfer', label: 'Transferencia' },
];

const PERIOD_MAP = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  annual: 'Anual',
};

export default function TransactionForm({ onSuccess, transaction = null }) {
  const isEdit = !!transaction;
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();

  const accountList = accountsData?.data || accountsData || [];
  const allCategories = categoriesData?.data || categoriesData || [];

  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      date: today,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (transaction) {
      reset({
        description: transaction.description || '',
        amount: Math.abs(Number(transaction.amount)),
        type: transaction.type,
        categoryId: transaction.categoryId || '',
        accountId: transaction.accountId,
        transferToAccountId: transaction.transferToAccountId || '',
        date: transaction.date,
        notes: transaction.notes || '',
      });
    }
  }, [transaction, reset]);

  const selectedType = watch('type');
  const selectedAccountId = watch('accountId');

  // Filter categories by transaction type
  const filteredCategories = allCategories.filter((cat) => {
    if (selectedType === 'transfer') return false;
    return cat.type === selectedType;
  });

  const categoryOptions = filteredCategories.map((cat) => ({
    value: cat.id,
    label: cat.name,
  }));

  const accountOptions = accountList.map((a) => ({
    value: a.id,
    label: `${a.name} (${formatBal(a.balance)})`,
  }));

  const destAccountOptions = accountList
    .filter((a) => String(a.id) !== String(selectedAccountId))
    .map((a) => ({ value: a.id, label: a.name }));

  function formatBal(val) {
    return Number(val).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  }

  const onSubmit = async (data) => {
    const payload = {
      description: data.description,
      amount: Number(data.amount),
      type: data.type,
      date: data.date,
      accountId: Number(data.accountId),
      notes: data.notes || null,
      categoryId: data.categoryId ? Number(data.categoryId) : null,
      transferToAccountId: data.transferToAccountId ? Number(data.transferToAccountId) : null,
    };

    if (isEdit) {
      await updateTransaction.mutateAsync({ id: transaction.id, ...payload });
    } else {
      await createTransaction.mutateAsync(payload);
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Descripción"
        placeholder="Ej: Supermercado"
        error={errors.description?.message}
        {...register('description')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Monto"
          type="number"
          placeholder="0"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select
          label="Tipo"
          options={TYPES}
          error={errors.type?.message}
          {...register('type')}
        />
      </div>

      {selectedType !== 'transfer' && (
        <Select
          label="Categoría"
          options={categoryOptions}
          placeholder="Seleccionar categoría"
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
      )}

      <Select
        label="Cuenta origen"
        placeholder="Seleccionar cuenta"
        options={accountOptions}
        error={errors.accountId?.message}
        {...register('accountId')}
      />

      {selectedType === 'transfer' && (
        <Select
          label="Cuenta destino"
          placeholder="Seleccionar cuenta destino"
          options={destAccountOptions}
          error={errors.transferToAccountId?.message}
          {...register('transferToAccountId')}
        />
      )}

      <Input
        label="Fecha"
        type="date"
        error={errors.date?.message}
        {...register('date')}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b93a8' }}>
          Notas <span style={{ color: '#2d3449' }}>(opcional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Notas adicionales..."
          className="w-full px-3 py-2.5 text-sm resize-none outline-none transition-all"
          style={{
            background: '#0b1326',
            border: '1px solid #2d3449',
            borderRadius: '0.25rem',
            color: '#dae2fd',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#98da27'; e.target.style.boxShadow = '0 0 0 2px rgba(152,218,39,0.15)'; }}
          onBlur={(e) => { e.target.style.borderColor = '#2d3449'; e.target.style.boxShadow = 'none'; }}
          {...register('notes')}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting
          ? 'Guardando...'
          : isEdit
          ? 'Actualizar transacción'
          : 'Guardar transacción'}
      </Button>
    </form>
  );
}
