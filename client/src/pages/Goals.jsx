import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Target, CheckCircle2, PauseCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { formatCurrency } from '../lib/formatters';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';

const schema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(150),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive('Monto objetivo requerido'),
  currentAmount: z.coerce.number().min(0).optional(),
  targetDate: z.string().optional(),
  color: z.string().optional(),
});

const STATUS_LABELS = {
  active: 'Activa',
  paused: 'Pausada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const COLORS = [
  '#98da27', '#5de6ff', '#f59e0b', '#ff5449',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Goals() {
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => apiClient.get('/goals'),
  });

  const goals = data?.data || data || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { color: '#98da27', currentAmount: 0 },
  });

  const selectedColor = watch('color');

  const createGoal = useMutation({
    mutationFn: (d) => apiClient.post('/goals', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); closeForm(); },
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, ...d }) => apiClient.patch(`/goals/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); closeForm(); },
  });

  const deleteGoal = useMutation({
    mutationFn: (id) => apiClient.delete(`/goals/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); setDeleteId(null); },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => apiClient.patch(`/goals/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const openCreate = () => {
    reset({ color: '#98da27', currentAmount: 0 });
    setEditGoal(null);
    setShowForm(true);
  };

  const openEdit = (goal) => {
    setEditGoal(goal);
    reset({
      name: goal.name,
      description: goal.description || '',
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate || '',
      color: goal.color || '#98da27',
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditGoal(null); reset(); };

  const onSubmit = async (data) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      targetAmount: Number(data.targetAmount),
      currentAmount: Number(data.currentAmount ?? 0),
      targetDate: data.targetDate || null,
      color: data.color || '#98da27',
    };
    if (editGoal) {
      await updateGoal.mutateAsync({ id: editGoal.id, ...payload });
    } else {
      await createGoal.mutateAsync(payload);
    }
  };

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'paused');
  const doneGoals = goals.filter((g) => g.status === 'completed' || g.status === 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="font-headline text-2xl font-bold uppercase tracking-widest"
          style={{ color: '#dae2fd' }}
        >
          Metas
        </h1>
        <Button onClick={openCreate}>
          <Plus size={14} />
          Nueva meta
        </Button>
      </div>

      {isLoading && <p className="text-sm" style={{ color: '#8b93a8' }}>Cargando metas...</p>}

      {!isLoading && goals.length === 0 && (
        <Card className="text-center py-12">
          <Target size={48} className="mx-auto mb-4" style={{ color: '#2d3449' }} />
          <p className="mb-2" style={{ color: '#c6c6cd' }}>Sin metas financieras</p>
          <p className="text-sm mb-4" style={{ color: '#8b93a8' }}>
            Define metas de ahorro o inversión para alcanzar tus objetivos financieros
          </p>
          <Button onClick={openCreate}>
            <Plus size={14} />
            Crear meta
          </Button>
        </Card>
      )}

      {/* Active goals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeGoals.map((goal) => {
          const current = Number(goal.currentAmount) || 0;
          const target = Number(goal.targetAmount) || 1;
          const pct = Math.min((current / target) * 100, 100);
          const days = daysRemaining(goal.targetDate);
          const isPaused = goal.status === 'paused';
          const accentColor = goal.color || '#98da27';

          return (
            <Card key={goal.id} className="space-y-4" style={isPaused ? { opacity: 0.75 } : {}}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}20`, border: `2px solid ${accentColor}` }}
                  >
                    <Target size={16} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{goal.name}</h3>
                    {goal.description && (
                      <p className="text-xs truncate max-w-[140px]" style={{ color: '#8b93a8' }}>{goal.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleStatus.mutate({ id: goal.id, status: isPaused ? 'active' : 'paused' })}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: '#8b93a8' }}
                    title={isPaused ? 'Reactivar' : 'Pausar'}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                  >
                    <PauseCircle size={13} />
                  </button>
                  <button
                    onClick={() => openEdit(goal)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#98da27'; e.currentTarget.style.background = 'rgba(152,218,39,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteId(goal.id)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ff5449'; e.currentTarget.style.background = 'rgba(255,84,73,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {isPaused && (
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#f59e0b' }}>Pausada</span>
              )}

              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span style={{ color: '#c6c6cd' }}>{formatCurrency(current)}</span>
                  <span className="font-bold" style={{ color: accentColor }}>{Math.round(pct)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#222a3d' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: accentColor }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-xs">
                  <span style={{ color: '#8b93a8' }}>
                    {pct >= 100 ? 'Meta alcanzada' : `Faltan ${formatCurrency(target - current)}`}
                  </span>
                  <span style={{ color: '#8b93a8' }}>meta: {formatCurrency(target)}</span>
                </div>
              </div>

              {days !== null && (
                <p
                  className="text-xs uppercase tracking-wider"
                  style={{ color: days < 0 ? '#ff5449' : days < 30 ? '#f59e0b' : '#8b93a8' }}
                >
                  {days < 0
                    ? `Venció hace ${Math.abs(days)} días`
                    : days === 0
                    ? 'Vence hoy'
                    : `${days} días restantes`}
                </p>
              )}

              {pct >= 100 && goal.status === 'active' && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => toggleStatus.mutate({ id: goal.id, status: 'completed' })}
                >
                  <CheckCircle2 size={13} />
                  Marcar completada
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Completed goals */}
      {doneGoals.length > 0 && (
        <div>
          <h2
            className="text-xs font-medium uppercase tracking-widest mb-3"
            style={{ color: '#8b93a8' }}
          >
            Metas completadas / canceladas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
            {doneGoals.map((goal) => {
              const pct = Math.min(
                (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100,
                100
              );
              return (
                <Card key={goal.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${goal.color || '#98da27'}20` }}
                      >
                        {goal.status === 'completed' ? (
                          <CheckCircle2 size={14} style={{ color: '#98da27' }} />
                        ) : (
                          <Target size={14} style={{ color: goal.color || '#98da27' }} />
                        )}
                      </div>
                      <h3 className="text-sm font-medium" style={{ color: '#c6c6cd' }}>{goal.name}</h3>
                    </div>
                    <span
                      className="text-xs uppercase tracking-wider"
                      style={{ color: '#8b93a8' }}
                    >
                      {STATUS_LABELS[goal.status]}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#222a3d' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: goal.color || '#98da27' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: '#8b93a8' }}>
                    <span>{formatCurrency(Number(goal.currentAmount))}</span>
                    <span>{formatCurrency(Number(goal.targetAmount))}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={showForm} onClose={closeForm} title={editGoal ? 'Editar meta' : 'Nueva meta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nombre de la meta"
            placeholder="Ej: Fondo de emergencia"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b93a8' }}>
              Descripción <span style={{ color: '#2d3449' }}>(opcional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Describe tu meta..."
              className="w-full px-3 py-2.5 text-sm resize-none outline-none transition-all"
              style={{
                background: '#0b1326',
                border: '1px solid #2d3449',
                borderRadius: '0.25rem',
                color: '#dae2fd',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#98da27'; e.target.style.boxShadow = '0 0 0 2px rgba(152,218,39,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#2d3449'; e.target.style.boxShadow = 'none'; }}
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Monto objetivo" type="number" placeholder="0" error={errors.targetAmount?.message} {...register('targetAmount')} />
            <Input label="Monto actual" type="number" placeholder="0" {...register('currentAmount')} />
          </div>

          <Input label="Fecha límite" type="date" {...register('targetDate')} />

          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: '#8b93a8' }}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input type="radio" value={color} className="sr-only" {...register('color')} />
                  <div
                    className="w-7 h-7 rounded-full transition-all duration-150"
                    style={{
                      backgroundColor: color,
                      transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: selectedColor === color ? `0 0 0 2px #0b1326, 0 0 0 4px ${color}` : 'none',
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : editGoal ? 'Actualizar meta' : 'Crear meta'}
          </Button>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar meta">
        <p className="text-sm mb-6" style={{ color: '#c6c6cd' }}>
          ¿Confirmas que deseas eliminar esta meta? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => deleteGoal.mutate(deleteId)}
            disabled={deleteGoal.isPending}
          >
            {deleteGoal.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
