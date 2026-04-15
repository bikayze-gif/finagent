import { useState } from 'react';
import { Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransactions, useDeleteTransaction } from '../hooks/useTransactions';
import { formatCurrency, formatDate } from '../lib/formatters';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import TransactionForm from './TransactionForm';

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'transfer', label: 'Transferencias' },
];

const TYPE_BADGE = {
  income:   { color: '#98da27', bg: 'rgba(152,218,39,0.12)',  label: 'Ingreso' },
  expense:  { color: '#ff5449', bg: 'rgba(255,84,73,0.12)',   label: 'Gasto' },
  transfer: { color: '#5de6ff', bg: 'rgba(93,230,255,0.12)',  label: 'Transferencia' },
};

export default function Transactions() {
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    category: '',
  });

  const activeFilters = { ...filters, page, limit: 15 };
  Object.keys(activeFilters).forEach((k) => {
    if (!activeFilters[k]) delete activeFilters[k];
  });

  const { data, isLoading } = useTransactions(activeFilters);
  const deleteTransaction = useDeleteTransaction();

  const transactions = data?.data || data || [];
  const totalPages = data?.totalPages || data?.pagination?.totalPages || 1;

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar esta transacción?')) {
      await deleteTransaction.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="font-headline text-2xl font-bold uppercase tracking-widest"
          style={{ color: '#dae2fd' }}
        >
          Transacciones
        </h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={14} />
          Nueva
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            options={TYPE_OPTIONS}
            value={filters.type}
            onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}
            placeholder="Tipo"
          />
          <Input
            type="date"
            placeholder="Desde"
            value={filters.startDate}
            onChange={(e) => { setFilters((f) => ({ ...f, startDate: e.target.value })); setPage(1); }}
          />
          <Input
            type="date"
            placeholder="Hasta"
            value={filters.endDate}
            onChange={(e) => { setFilters((f) => ({ ...f, endDate: e.target.value })); setPage(1); }}
          />
          <Input
            placeholder="Categoría"
            value={filters.category}
            onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #2d3449' }}>
                {['Fecha', 'Descripción', 'Categoría', 'Monto', 'Tipo', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`text-xs font-medium uppercase tracking-widest px-6 py-3 ${
                      i === 3 ? 'text-right' : i === 4 ? 'text-center' : i === 5 ? '' : 'text-left'
                    }`}
                    style={{ color: '#8b93a8' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm" style={{ color: '#8b93a8' }}>
                    Cargando...
                  </td>
                </tr>
              )}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm" style={{ color: '#8b93a8' }}>
                    Sin transacciones
                  </td>
                </tr>
              )}
              {transactions.map((tx) => {
                const badge = TYPE_BADGE[tx.type] || TYPE_BADGE.expense;
                const amtColor = tx.type === 'income' ? '#98da27' : tx.type === 'transfer' ? '#5de6ff' : '#ff5449';
                return (
                  <tr
                    key={tx.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid #1d2538' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45,52,73,0.3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td className="px-6 py-3.5 text-xs" style={{ color: '#8b93a8' }}>
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-medium" style={{ color: '#dae2fd' }}>
                      {tx.description}
                    </td>
                    <td className="px-6 py-3.5 text-xs" style={{ color: '#8b93a8' }}>
                      {tx.category}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-right font-bold" style={{ color: amtColor }}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span
                        className="inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 rounded-lg transition-colors cursor-pointer"
                        style={{ color: '#8b93a8' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ff5449'; e.currentTarget.style.background = 'rgba(255,84,73,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#8b93a8'; e.currentTarget.style.background = ''; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-6 py-3"
            style={{ borderTop: '1px solid #2d3449' }}
          >
            <span className="text-xs uppercase tracking-wider" style={{ color: '#8b93a8' }}>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nueva transacción">
        <TransactionForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
