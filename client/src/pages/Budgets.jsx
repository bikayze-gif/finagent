import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { apiClient } from '../api/client';
import { useCategories } from '../hooks/useCategories';
import { formatCurrency } from '../lib/formatters';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';

const schema = z.object({
  categoryId: z.coerce.number().int().positive('Categoría requerida'),
  amount: z.coerce.number().positive('Monto requerido'),
  period: z.enum(['monthly', 'quarterly', 'annual']),
  startDate: z.string().min(1, 'Fecha inicio requerida'),
});

const PERIOD_LABELS = { monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual' };

export default function Budgets() {
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => apiClient.get('/budgets'),
  });

  const { data: categoriesData } = useCategories();
  const allCategories = categoriesData?.data || categoriesData || [];
  const expenseCategories = allCategories
    .filter((c) => c.type === 'expense')
    .map((c) => ({ value: c.id, label: c.name }));

  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { period: 'monthly', startDate: today },
  });

  const createBudget = useMutation({
    mutationFn: (data) => apiClient.post('/budgets', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); closeForm(); },
  });

  const updateBudget = useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/budgets/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); closeForm(); },
  });

  const deleteBudget = useMutation({
    mutationFn: (id) => apiClient.delete(`/budgets/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); setDeleteId(null); },
  });

  const openCreate = () => { reset({ period: 'monthly', startDate: today }); setEditBudget(null); setShowForm(true); };

  const openEdit = (budget) => {
    setEditBudget(budget);
    reset({ categoryId: budget.categoryId, amount: Number(budget.amount), period: budget.period, startDate: budget.startDate || today });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditBudget(null); reset(); };

  const onSubmit = async (data) => {
    const payload = {
      categoryId: Number(data.categoryId),
      amount: Number(data.amount),
      period: data.period,
      startDate: data.startDate,
    };
    if (editBudget) {
      await updateBudget.mutateAsync({ id: editBudget.id, ...payload });
    } else {
      await createBudget.mutateAsync(payload);
    }
  };

  const budgets = data?.data || data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="font-headline text-2xl font-bold uppercase tracking-widest"
          style={{ color: '#dae2fd' }}
        >
          Presupuestos
        </h1>
        <Button onClick={openCreate}>
          <Plus size={14} />
          Nuevo
        </Button>
      </div>

      {isLoading && <p className="text-sm" style={{ color: '#8b93a8' }}>Cargando presupuestos...</p>}

      {!isLoading && budgets.length === 0 && (
        <Card className="text-center py-12">
          <Wallet size={48} className="mx-auto mb-4" style={{ color: '#2d3449' }} />
          <p className="mb-2" style={{ color: '#c6c6cd' }}>Sin presupuestos activos</p>
          <p className="text-sm mb-4" style={{ color: '#8b93a8' }}>
            Crea un presupuesto para controlar tus gastos por categoría
          </p>
          <Button onClick={openCreate}>
            <Plus size={14} />
            Crear presupuesto
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map((budget) => {
          const spent = Number(budget.spent) || 0;
          const limit = Number(budget.amount) || 1;
          const pct = Math.min((spent / limit) * 100, 100);
          const barColor = pct > 80 ? '#ff5449' : pct > 50 ? '#f59e0b' : '#98da27';
          const textColor = pct > 80 ? '#ff5449' : pct > 50 ? '#f59e0b' : '#98da27';

          return (
            <Card key={budget.id} className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: budget.categoryColor || '#98da27' }}
                  />
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{budget.categoryName}</h3>
                    <p className="text-xs uppercase tracking-wider" style={{ color: '#8b93a8' }}>
                      {PERIOD_LABELS[budget.period] || budget.period}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(budget)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#98da27'; e.currentTarget.style.background = 'rgba(152,218,39,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteId(budget.id)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ff5449'; e.currentTarget.style.background = 'rgba(255,84,73,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span style={{ color: '#c6c6cd' }}>{formatCurrency(spent)} gastado</span>
                  <span className="font-bold" style={{ color: textColor }}>{Math.round(pct)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#222a3d' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <p className="text-xs mt-1.5 text-right" style={{ color: '#8b93a8' }}>de {formatCurrency(limit)}</p>
              </div>

              {pct >= 100 && (
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ff5449' }}>Presupuesto excedido</p>
              )}
              {pct > 80 && pct < 100 && (
                <p className="text-xs uppercase tracking-wider" style={{ color: '#f59e0b' }}>Cerca del límite</p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Create / Edit modal */}
      <Modal isOpen={showForm} onClose={closeForm} title={editBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Categoría de gasto"
            options={expenseCategories}
            placeholder="Seleccionar"
            error={errors.categoryId?.message}
            {...register('categoryId')}
          />
          <Input
            label="Monto límite"
            type="number"
            placeholder="Ej: 200000"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Select
            label="Período"
            options={[
              { value: 'monthly', label: 'Mensual' },
              { value: 'quarterly', label: 'Trimestral' },
              { value: 'annual', label: 'Anual' },
            ]}
            error={errors.period?.message}
            {...register('period')}
          />
          <Input
            label="Fecha inicio"
            type="date"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : editBudget ? 'Actualizar' : 'Crear presupuesto'}
          </Button>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar presupuesto">
        <p className="text-sm mb-6" style={{ color: '#c6c6cd' }}>¿Confirmas que deseas eliminar este presupuesto?</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => deleteBudget.mutate(deleteId)}
            disabled={deleteBudget.isPending}
          >
            {deleteBudget.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
