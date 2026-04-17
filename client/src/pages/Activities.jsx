import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Activity, PauseCircle, CalendarClock } from 'lucide-react';
import { apiClient } from '../api/client';
import { formatCurrency } from '../lib/formatters';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';

const schema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(150),
  description: z.string().optional(),
  frequency: z.enum(['quincenal', 'mensual'], { required_error: 'Selecciona una frecuencia' }),
  cycleDay: z.coerce.number().int().min(1).max(31).nullable().optional().or(z.literal('')),
  amount: z.coerce.number().positive().optional().or(z.literal('')),
  startDate: z.string().optional(),
  color: z.string().optional(),
});

const FREQUENCY_LABELS = { quincenal: 'Quincenal', mensual: 'Mensual' };
const FREQUENCY_DESCRIPTIONS = { quincenal: 'Cada 15 días', mensual: 'Una vez al mes' };

const STATUS_LABELS = {
  active: 'Activa', paused: 'Pausada', completed: 'Completada', cancelled: 'Cancelada',
};

const COLORS = [
  '#5de6ff', '#98da27', '#f59e0b', '#ff5449',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

function cycleDayLabel(frequency, day) {
  if (!day) return null;
  if (frequency === 'mensual') return `Día ${day} de cada mes`;
  return `Día ${day} de cada quincena`;
}

function DayPicker({ frequency, value, onChange, error }) {
  const max = frequency === 'quincenal' ? 15 : 31;
  const days = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b93a8' }}>
        Día del ciclo <span style={{ color: '#2d3449' }}>(opcional)</span>
      </label>
      <div className="flex flex-wrap gap-1.5 p-3 rounded" style={{ background: '#0b1326', border: '1px solid #2d3449' }}>
        {/* None option */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer"
          style={{
            background: !value ? 'rgba(93,230,255,0.15)' : 'transparent',
            border: `1px solid ${!value ? '#5de6ff' : '#2d3449'}`,
            color: !value ? '#5de6ff' : '#8b93a8',
          }}
        >
          —
        </button>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className="w-8 h-8 rounded text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: value === d ? 'rgba(93,230,255,0.15)' : 'transparent',
              border: `1px solid ${value === d ? '#5de6ff' : '#2d3449'}`,
              color: value === d ? '#5de6ff' : '#8b93a8',
            }}
          >
            {d}
          </button>
        ))}
      </div>
      {error && <p className="text-xs" style={{ color: '#ff5449' }}>{error}</p>}
    </div>
  );
}

export default function Activities() {
  const [showForm, setShowForm] = useState(false);
  const [editActivity, setEditActivity] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [cycleDayValue, setCycleDayValue] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => apiClient.get('/activities'),
  });

  const allActivities = data?.data || data || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { color: '#5de6ff', frequency: 'mensual' },
  });

  const selectedColor = watch('color');
  const selectedFrequency = watch('frequency');

  const createActivity = useMutation({
    mutationFn: (d) => apiClient.post('/activities', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activities'] }); closeForm(); },
  });

  const updateActivity = useMutation({
    mutationFn: ({ id, ...d }) => apiClient.patch(`/activities/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activities'] }); closeForm(); },
  });

  const deleteActivity = useMutation({
    mutationFn: (id) => apiClient.delete(`/activities/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activities'] }); setDeleteId(null); },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => apiClient.patch(`/activities/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities'] }),
  });

  const openCreate = () => {
    reset({ color: '#5de6ff', frequency: 'mensual' });
    setCycleDayValue(null);
    setEditActivity(null);
    setShowForm(true);
  };

  const openEdit = (activity) => {
    setEditActivity(activity);
    const day = activity.cycleDay ? Number(activity.cycleDay) : null;
    setCycleDayValue(day);
    reset({
      name: activity.name,
      description: activity.description || '',
      frequency: activity.frequency,
      cycleDay: day,
      amount: activity.amount ? Number(activity.amount) : '',
      startDate: activity.startDate || '',
      color: activity.color || '#5de6ff',
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditActivity(null); setCycleDayValue(null); reset(); };

  const onSubmit = async (data) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      frequency: data.frequency,
      cycleDay: cycleDayValue ?? null,
      amount: data.amount ? Number(data.amount) : null,
      startDate: data.startDate || null,
      color: data.color || '#5de6ff',
    };
    if (editActivity) {
      await updateActivity.mutateAsync({ id: editActivity.id, ...payload });
    } else {
      await createActivity.mutateAsync(payload);
    }
  };

  // When frequency changes, reset cycleDay if it's out of range
  const handleFrequencyChange = (freq) => {
    setValue('frequency', freq, { shouldValidate: true });
    if (freq === 'quincenal' && cycleDayValue > 15) {
      setCycleDayValue(null);
    }
  };

  const activeActivities = allActivities.filter((a) => a.status === 'active' || a.status === 'paused');
  const doneActivities = allActivities.filter((a) => a.status === 'completed' || a.status === 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-bold uppercase tracking-widest" style={{ color: '#dae2fd' }}>
          Actividades
        </h1>
        <Button onClick={openCreate}>
          <Plus size={14} />
          Nueva actividad
        </Button>
      </div>

      {isLoading && <p className="text-sm" style={{ color: '#8b93a8' }}>Cargando actividades...</p>}

      {!isLoading && allActivities.length === 0 && (
        <Card className="text-center py-12">
          <Activity size={48} className="mx-auto mb-4" style={{ color: '#2d3449' }} />
          <p className="mb-2" style={{ color: '#c6c6cd' }}>Sin actividades registradas</p>
          <p className="text-sm mb-4" style={{ color: '#8b93a8' }}>
            Registra actividades financieras recurrentes para mantener el control de tus compromisos
          </p>
          <Button onClick={openCreate}><Plus size={14} />Crear actividad</Button>
        </Card>
      )}

      {/* Active activities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeActivities.map((activity) => {
          const isPaused = activity.status === 'paused';
          const accentColor = activity.color || '#5de6ff';
          const dayLabel = cycleDayLabel(activity.frequency, activity.cycleDay);

          return (
            <Card key={activity.id} className="space-y-4" style={isPaused ? { opacity: 0.75 } : {}}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}20`, border: `2px solid ${accentColor}` }}
                  >
                    <CalendarClock size={16} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{activity.name}</h3>
                    {activity.description && (
                      <p className="text-xs truncate max-w-[140px]" style={{ color: '#8b93a8' }}>{activity.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleStatus.mutate({ id: activity.id, status: isPaused ? 'active' : 'paused' })}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ color: '#8b93a8' }}
                    title={isPaused ? 'Reactivar' : 'Pausar'}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}>
                    <PauseCircle size={13} />
                  </button>
                  <button onClick={() => openEdit(activity)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#98da27'; e.currentTarget.style.background = 'rgba(152,218,39,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteId(activity.id)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ff5449'; e.currentTarget.style.background = 'rgba(255,84,73,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {isPaused && <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#f59e0b' }}>Pausada</span>}

              <div className="flex items-center justify-between">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}40` }}
                >
                  {FREQUENCY_LABELS[activity.frequency]}
                </span>
                {activity.amount && (
                  <span className="text-sm font-bold" style={{ color: '#dae2fd' }}>
                    {formatCurrency(Number(activity.amount))}
                  </span>
                )}
              </div>

              {dayLabel && (
                <p className="text-xs uppercase tracking-wider" style={{ color: '#5de6ff' }}>
                  ↻ {dayLabel}
                </p>
              )}

              {activity.startDate && (
                <p className="text-xs uppercase tracking-wider" style={{ color: '#8b93a8' }}>
                  Desde {new Date(activity.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Done activities */}
      {doneActivities.length > 0 && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#8b93a8' }}>
            Completadas / canceladas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
            {doneActivities.map((activity) => (
              <Card key={activity.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${activity.color || '#5de6ff'}20` }}>
                      <CalendarClock size={14} style={{ color: activity.color || '#5de6ff' }} />
                    </div>
                    <h3 className="text-sm font-medium" style={{ color: '#c6c6cd' }}>{activity.name}</h3>
                  </div>
                  <span className="text-xs uppercase tracking-wider" style={{ color: '#8b93a8' }}>
                    {STATUS_LABELS[activity.status]}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1a2235', color: '#8b93a8' }}>
                  {FREQUENCY_LABELS[activity.frequency]}
                  {activity.cycleDay ? ` — día ${activity.cycleDay}` : ''}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={showForm} onClose={closeForm} title={editActivity ? 'Editar actividad' : 'Nueva actividad'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nombre de la actividad"
            placeholder="Ej: Pago arriendo, Cuota crédito"
            error={errors.name?.message}
            {...register('name')}
          />

          {/* Frequency selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b93a8' }}>
              Frecuencia <span style={{ color: '#ff5449' }}>*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['quincenal', 'mensual'].map((freq) => (
                <button key={freq} type="button"
                  onClick={() => handleFrequencyChange(freq)}
                  className="flex flex-col items-center gap-1 py-3 px-4 rounded transition-all duration-150 cursor-pointer"
                  style={{
                    background: selectedFrequency === freq ? 'rgba(93,230,255,0.12)' : '#0b1326',
                    border: `1.5px solid ${selectedFrequency === freq ? '#5de6ff' : '#2d3449'}`,
                    color: selectedFrequency === freq ? '#5de6ff' : '#8b93a8',
                  }}>
                  <CalendarClock size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{FREQUENCY_LABELS[freq]}</span>
                  <span className="text-xs" style={{ color: selectedFrequency === freq ? '#5de6ff' : '#4a5568' }}>
                    {FREQUENCY_DESCRIPTIONS[freq]}
                  </span>
                </button>
              ))}
            </div>
            {errors.frequency && <p className="text-xs" style={{ color: '#ff5449' }}>{errors.frequency.message}</p>}
          </div>

          {/* Day of cycle picker */}
          <DayPicker
            frequency={selectedFrequency}
            value={cycleDayValue}
            onChange={setCycleDayValue}
            error={errors.cycleDay?.message}
          />

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b93a8' }}>
              Descripción <span style={{ color: '#2d3449' }}>(opcional)</span>
            </label>
            <textarea rows={2} placeholder="Describe la actividad..."
              className="w-full px-3 py-2.5 text-sm resize-none outline-none transition-all"
              style={{ background: '#0b1326', border: '1px solid #2d3449', borderRadius: '0.25rem', color: '#dae2fd' }}
              onFocus={(e) => { e.target.style.borderColor = '#5de6ff'; e.target.style.boxShadow = '0 0 0 2px rgba(93,230,255,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#2d3449'; e.target.style.boxShadow = 'none'; }}
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Monto (opcional)" type="number" placeholder="0" error={errors.amount?.message} {...register('amount')} />
            <Input label="Fecha inicio" type="date" {...register('startDate')} />
          </div>

          {/* Color picker */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: '#8b93a8' }}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input type="radio" value={color} className="sr-only" {...register('color')} />
                  <div className="w-7 h-7 rounded-full transition-all duration-150"
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
            {isSubmitting ? 'Guardando...' : editActivity ? 'Actualizar actividad' : 'Crear actividad'}
          </Button>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar actividad">
        <p className="text-sm mb-6" style={{ color: '#c6c6cd' }}>
          ¿Confirmas que deseas eliminar esta actividad? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="destructive" className="flex-1"
            onClick={() => deleteActivity.mutate(deleteId)} disabled={deleteActivity.isPending}>
            {deleteActivity.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
