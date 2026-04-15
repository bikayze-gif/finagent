import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Landmark, CreditCard, PiggyBank, Wallet, TrendingUp, Banknote } from 'lucide-react';
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../hooks/useAccounts';
import { formatCurrency } from '../lib/formatters';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';

const schema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  type: z.enum(['checking', 'savings', 'credit_card', 'investment', 'cash', 'loan', 'other']),
  balance: z.coerce.number().optional(),
  institution: z.string().max(100).optional(),
  color: z.string().optional(),
});

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'savings', label: 'Cuenta de ahorro' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'investment', label: 'Inversión' },
  { value: 'loan', label: 'Préstamo' },
  { value: 'other', label: 'Otra' },
];

const TYPE_ICONS = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Wallet,
  investment: TrendingUp,
  loan: Banknote,
  other: Landmark,
};

const COLORS = ['#98da27', '#5de6ff', '#f59e0b', '#ff5449', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function AccountsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const accountList = data?.data || data || [];
  const totalBalance = accountList.reduce((sum, a) => sum + Number(a.balance), 0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: 'checking', balance: 0, color: '#98da27' },
  });

  const selectedColor = watch('color');

  const openCreate = () => {
    reset({ type: 'checking', balance: 0, color: '#98da27' });
    setEditAccount(null);
    setShowForm(true);
  };

  const openEdit = (account) => {
    setEditAccount(account);
    reset({
      name: account.name,
      type: account.type,
      balance: Number(account.balance),
      institution: account.institution || '',
      color: account.color || '#98da27',
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditAccount(null); reset(); };

  const onSubmit = async (data) => {
    const payload = {
      name: data.name,
      type: data.type,
      balance: Number(data.balance ?? 0),
      institution: data.institution || null,
      color: data.color || '#98da27',
    };
    if (editAccount) {
      await updateAccount.mutateAsync({ id: editAccount.id, ...payload });
    } else {
      await createAccount.mutateAsync(payload);
    }
    closeForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="font-headline text-2xl font-bold uppercase tracking-widest"
          style={{ color: '#dae2fd' }}
        >
          Cuentas
        </h1>
        <Button onClick={openCreate}>
          <Plus size={14} />
          Nueva cuenta
        </Button>
      </div>

      {/* Total balance */}
      {accountList.length > 0 && (
        <Card className="text-center">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#8b93a8' }}>Balance total</p>
          <p className="font-headline text-3xl font-bold" style={{ color: '#dae2fd' }}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: '#8b93a8' }}>
            {accountList.length} cuenta{accountList.length !== 1 ? 's' : ''} activa{accountList.length !== 1 ? 's' : ''}
          </p>
        </Card>
      )}

      {isLoading && <p className="text-sm" style={{ color: '#8b93a8' }}>Cargando cuentas...</p>}

      {!isLoading && accountList.length === 0 && (
        <Card className="text-center py-12">
          <Landmark size={48} className="mx-auto mb-4" style={{ color: '#2d3449' }} />
          <p className="mb-2" style={{ color: '#c6c6cd' }}>Sin cuentas registradas</p>
          <p className="text-sm mb-4" style={{ color: '#8b93a8' }}>
            Agrega tus cuentas bancarias, tarjetas y efectivo para empezar a registrar transacciones
          </p>
          <Button onClick={openCreate}>
            <Plus size={14} />
            Agregar cuenta
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accountList.map((account) => {
          const Icon = TYPE_ICONS[account.type] || Landmark;
          const balance = Number(account.balance);
          const isNegative = balance < 0;
          const accentColor = account.color || '#98da27';

          return (
            <Card key={account.id} className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `${accentColor}18`,
                      border: `1.5px solid ${accentColor}60`,
                    }}
                  >
                    <Icon size={18} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#dae2fd' }}>{account.name}</h3>
                    {account.institution && (
                      <p className="text-xs" style={{ color: '#8b93a8' }}>{account.institution}</p>
                    )}
                    <p className="text-xs uppercase tracking-wider" style={{ color: '#8b93a8' }}>
                      {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label || account.type}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(account)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#98da27'; e.currentTarget.style.background = 'rgba(152,218,39,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteId(account.id)}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: '#8b93a8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ff5449'; e.currentTarget.style.background = 'rgba(255,84,73,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="pt-3" style={{ borderTop: '1px solid #2d3449' }}>
                <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#8b93a8' }}>Balance</p>
                <p
                  className="font-headline text-xl font-bold"
                  style={{ color: isNegative ? '#ff5449' : '#dae2fd' }}
                >
                  {formatCurrency(balance)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create / Edit modal */}
      <Modal isOpen={showForm} onClose={closeForm} title={editAccount ? 'Editar cuenta' : 'Nueva cuenta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nombre" placeholder="Ej: Cuenta BancoEstado" error={errors.name?.message} {...register('name')} />
          <Select label="Tipo de cuenta" options={ACCOUNT_TYPES} error={errors.type?.message} {...register('type')} />
          <Input label={editAccount ? 'Saldo actual' : 'Saldo inicial'} type="number" placeholder="0" {...register('balance')} />
          <Input label="Institución" placeholder="Ej: BancoEstado" {...register('institution')} />

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
            {isSubmitting ? 'Guardando...' : editAccount ? 'Actualizar' : 'Crear cuenta'}
          </Button>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Desactivar cuenta">
        <p className="text-sm mb-2" style={{ color: '#c6c6cd' }}>¿Deseas desactivar esta cuenta?</p>
        <p className="text-xs mb-6" style={{ color: '#8b93a8' }}>Las transacciones existentes se conservarán. Podrás reactivarla más adelante.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => deleteAccount.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}
            disabled={deleteAccount.isPending}
          >
            {deleteAccount.isPending ? 'Desactivando...' : 'Desactivar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
