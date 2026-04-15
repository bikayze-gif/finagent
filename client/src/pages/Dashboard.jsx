import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, Target } from 'lucide-react';
import { apiClient } from '../api/client';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency, formatDate } from '../lib/formatters';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import TransactionForm from './TransactionForm';

const TOOLTIP_STYLE = {
  backgroundColor: '#131b2e',
  border: '1px solid #2d3449',
  borderRadius: '4px',
  color: '#dae2fd',
  fontSize: 12,
};

function formatAmt(val) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

export default function Dashboard() {
  const [showForm, setShowForm] = useState(false);
  const { data: accounts } = useAccounts();
  const { data: transactionsData } = useTransactions({ limit: 10 });

  const { data: budgetsData } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => apiClient.get('/budgets'),
  });

  const { data: trendData } = useQuery({
    queryKey: ['dashboard', 'trend'],
    queryFn: () => apiClient.get('/dashboard/trend'),
  });

  const { data: goalsData } = useQuery({
    queryKey: ['goals'],
    queryFn: () => apiClient.get('/goals'),
  });

  const transactions = transactionsData?.data || transactionsData || [];
  const accountList = accounts?.data || accounts || [];
  const budgetList = budgetsData?.data || budgetsData || [];
  const trend = trendData?.data || [];
  const goalsList = (goalsData?.data || goalsData || []).filter((g) => g.status === 'active');

  const totalBalance = accountList.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  const monthIncome = trend[trend.length - 1]?.income || 0;
  const monthExpense = trend[trend.length - 1]?.expense || 0;

  return (
    <div className="space-y-6">
      <h1
        className="font-headline text-2xl font-bold uppercase tracking-widest"
        style={{ color: '#dae2fd' }}
      >
        Dashboard
      </h1>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#8b93a8' }}>Balance total</p>
          <p className="font-headline text-3xl font-bold" style={{ color: '#dae2fd' }}>{formatCurrency(totalBalance)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#8b93a8' }}>Ingresos del mes</p>
          <p className="font-headline text-2xl font-bold" style={{ color: '#98da27' }}>{formatCurrency(monthIncome)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#8b93a8' }}>Gastos del mes</p>
          <p className="font-headline text-2xl font-bold" style={{ color: '#ff5449' }}>{formatCurrency(monthExpense)}</p>
        </Card>
      </div>

      {/* Trend area chart */}
      {trend.length > 0 && (
        <Card>
          <h3
            className="text-xs font-medium uppercase tracking-widest mb-4"
            style={{ color: '#8b93a8' }}
          >
            Tendencia — últimos 6 meses
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#98da27" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#98da27" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5449" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ff5449" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222a3d" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#8b93a8', fontSize: 10, fontFamily: 'Inter' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatAmt}
                  tick={{ fill: '#8b93a8', fontSize: 10, fontFamily: 'Inter' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  formatter={(val) => formatCurrency(val)}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#8b93a8' }}
                />
                <Legend
                  formatter={(val) => (val === 'income' ? 'Ingresos' : 'Gastos')}
                  wrapperStyle={{ fontSize: 11, color: '#8b93a8', fontFamily: 'Inter' }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#98da27"
                  strokeWidth={2}
                  fill="url(#incomeGrad)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#ff5449"
                  strokeWidth={2}
                  fill="url(#expenseGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Budgets + Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3
            className="text-xs font-medium uppercase tracking-widest mb-4"
            style={{ color: '#8b93a8' }}
          >
            Presupuestos
          </h3>
          <div className="space-y-4">
            {budgetList.length === 0 && (
              <p className="text-sm" style={{ color: '#8b93a8' }}>Sin presupuestos activos</p>
            )}
            {budgetList.slice(0, 4).map((budget) => {
              const spent = Number(budget.spent) || 0;
              const limit = Number(budget.amount) || 1;
              const pct = Math.min((spent / limit) * 100, 100);
              const barColor = pct > 80 ? '#ff5449' : pct > 50 ? '#f59e0b' : '#98da27';
              return (
                <div key={budget.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: '#c6c6cd' }}>{budget.categoryName}</span>
                    <span style={{ color: '#8b93a8' }}>
                      {formatCurrency(spent)} / {formatCurrency(limit)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#222a3d' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3
            className="text-xs font-medium uppercase tracking-widest mb-4"
            style={{ color: '#8b93a8' }}
          >
            Metas activas
          </h3>
          <div className="space-y-4">
            {goalsList.length === 0 && (
              <p className="text-sm" style={{ color: '#8b93a8' }}>Sin metas activas</p>
            )}
            {goalsList.slice(0, 3).map((goal) => {
              const current = Number(goal.currentAmount) || 0;
              const target = Number(goal.targetAmount) || 1;
              const pct = Math.min((current / target) * 100, 100);
              return (
                <div key={goal.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Target size={11} style={{ color: goal.color || '#98da27' }} />
                      <span style={{ color: '#c6c6cd' }}>{goal.name}</span>
                    </div>
                    <span style={{ color: '#8b93a8' }}>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#222a3d' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: goal.color || '#98da27' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <h3
          className="text-xs font-medium uppercase tracking-widest mb-4"
          style={{ color: '#8b93a8' }}
        >
          Transacciones recientes
        </h3>
        <div className="space-y-0">
          {transactions.length === 0 && (
            <p className="text-sm" style={{ color: '#8b93a8' }}>Sin transacciones</p>
          )}
          {transactions.slice(0, 10).map((tx) => {
            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';
            const amtColor = isIncome ? '#98da27' : isTransfer ? '#5de6ff' : '#ff5449';
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3"
                style={{ borderBottom: '1px solid #222a3d' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{
                      background: isIncome
                        ? 'rgba(152,218,39,0.1)'
                        : isTransfer
                        ? 'rgba(93,230,255,0.1)'
                        : 'rgba(255,84,73,0.1)',
                    }}
                  >
                    {isIncome ? (
                      <TrendingUp size={14} style={{ color: '#98da27' }} />
                    ) : isTransfer ? (
                      <ArrowLeftRight size={14} style={{ color: '#5de6ff' }} />
                    ) : (
                      <TrendingDown size={14} style={{ color: '#ff5449' }} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#dae2fd' }}>{tx.description}</p>
                    <p className="text-xs" style={{ color: '#8b93a8' }}>
                      {tx.categoryName || 'Sin categoría'} · {formatDate(tx.date)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold" style={{ color: amtColor }}>
                  {isIncome ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)))}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer z-30 hover:scale-110 active:scale-95"
        style={{
          background: '#98da27',
          color: '#213600',
          boxShadow: '0 0 24px rgba(152,218,39,0.4)',
        }}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nueva transacción">
        <TransactionForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
