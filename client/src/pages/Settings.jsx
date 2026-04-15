import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const schema = z.object({
  name: z.string().min(2, 'Nombre requerido (mínimo 2 caracteres)').max(100),
  currency: z.string().length(3, 'Código de 3 letras (ej: CLP, USD, EUR)'),
  timezone: z.string().min(1),
});

const CURRENCIES = [
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
];

const TIMEZONES = [
  { value: 'America/Santiago', label: 'Santiago (Chile)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'America/Bogota', label: 'Bogotá' },
  { value: 'America/Lima', label: 'Lima' },
  { value: 'America/Mexico_City', label: 'Ciudad de México' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'America/New_York', label: 'Nueva York (ET)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (PT)' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'UTC', label: 'UTC' },
];

export default function Settings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/auth/me'),
  });

  const profile = data?.data || data;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', currency: 'CLP', timezone: 'America/Santiago' },
  });

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name || '',
        currency: profile.currency || 'CLP',
        timezone: profile.timezone || 'America/Santiago',
      });
    }
  }, [profile, reset]);

  const updateProfile = useMutation({
    mutationFn: (data) => apiClient.patch('/auth/profile', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const onSubmit = async (data) => {
    await updateProfile.mutateAsync(data);
  };

  if (isLoading) {
    return <p className="text-sm" style={{ color: '#8b93a8' }}>Cargando configuración...</p>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1
        className="font-headline text-2xl font-bold uppercase tracking-widest"
        style={{ color: '#dae2fd' }}
      >
        Configuración
      </h1>

      {/* Profile info card */}
      <Card className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(152,218,39,0.12)',
            border: '1.5px solid rgba(152,218,39,0.4)',
          }}
        >
          <User size={22} style={{ color: '#98da27' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{profile?.name}</p>
          <p className="text-sm" style={{ color: '#8b93a8' }}>{profile?.email}</p>
          <p className="text-xs mt-0.5" style={{ color: '#8b93a8' }}>
            Miembro desde{' '}
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString('es-CL', {
                  year: 'numeric',
                  month: 'long',
                })
              : '—'}
          </p>
        </div>
      </Card>

      {/* Edit form */}
      <Card>
        <h2
          className="text-xs font-medium uppercase tracking-widest mb-4"
          style={{ color: '#8b93a8' }}
        >
          Datos personales
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Tu nombre"
            error={errors.name?.message}
            {...register('name')}
          />
          <Select
            label="Moneda principal"
            options={CURRENCIES}
            error={errors.currency?.message}
            {...register('currency')}
          />
          <Select
            label="Zona horaria"
            options={TIMEZONES}
            error={errors.timezone?.message}
            {...register('timezone')}
          />

          {isSubmitSuccessful && !updateProfile.isError && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#98da27' }}>
              <CheckCircle2 size={15} />
              Cambios guardados correctamente
            </div>
          )}

          {updateProfile.isError && (
            <p className="text-sm" style={{ color: '#ff5449' }}>Error al guardar. Inténtalo de nuevo.</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </form>
      </Card>

      <p
        className="text-xs text-center uppercase tracking-widest"
        style={{ color: '#2d3449' }}
      >
        FinAgent v2.0 — Kinetic Terminal
      </p>
    </div>
  );
}
