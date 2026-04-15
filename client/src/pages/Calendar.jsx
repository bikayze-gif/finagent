import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTransactions } from '../hooks/useTransactions';
import { formatCurrency, formatDate } from '../lib/formatters';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data } = useTransactions({ startDate, endDate, limit: 500 });
  const transactions = data?.data || data || [];

  const txByDay = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      const day = tx.date?.split('T')[0] || tx.date;
      if (!map[day]) map[day] = [];
      map[day].push(tx);
    });
    return map;
  }, [transactions]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = [];
  let day = calStart;
  while (day <= calEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const selectedDayStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedTxs = selectedDayStr ? txByDay[selectedDayStr] || [] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Calendario</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar grid */}
        <Card className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft size={20} />
            </Button>
            <h2 className="text-lg font-semibold text-slate-100 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight size={20} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dayNames.map((name) => (
              <div
                key={name}
                className="text-center text-xs font-medium text-slate-500 py-2"
              >
                {name}
              </div>
            ))}
            {weeks.flat().map((d, idx) => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const dayTxs = txByDay[dateStr] || [];
              const inMonth = isSameMonth(d, currentMonth);
              const isSelected = selectedDay && isSameDay(d, selectedDay);
              const hasIncome = dayTxs.some((t) => t.type === 'income');
              const hasExpense = dayTxs.some((t) => t.type === 'expense');
              const dayIncome = dayTxs
                .filter((t) => t.type === 'income')
                .reduce((s, t) => s + Math.abs(t.amount), 0);
              const dayExpense = dayTxs
                .filter((t) => t.type === 'expense')
                .reduce((s, t) => s + Math.abs(t.amount), 0);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(d)}
                  title={
                    dayTxs.length > 0
                      ? `Ingresos: ${formatCurrency(dayIncome)} | Gastos: ${formatCurrency(dayExpense)}`
                      : ''
                  }
                  className={`
                    relative flex flex-col items-center justify-center p-2 rounded-lg
                    text-sm transition-colors cursor-pointer min-h-[48px]
                    ${inMonth ? 'text-slate-200' : 'text-slate-600'}
                    ${isSelected ? 'bg-indigo-500/20 ring-1 ring-indigo-500' : 'hover:bg-slate-700/50'}
                  `}
                >
                  <span>{format(d, 'd')}</span>
                  {dayTxs.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {hasIncome && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                      {hasExpense && (
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Day detail panel */}
        {selectedDay && (
          <Card className="lg:w-80 xl:w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200">
                {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {selectedTxs.length === 0 ? (
              <p className="text-sm text-slate-500">Sin transacciones este día</p>
            ) : (
              <>
                <div className="flex gap-4 mb-4">
                  <div className="text-sm">
                    <span className="text-slate-500">Ingresos: </span>
                    <span className="text-emerald-400 font-medium">
                      {formatCurrency(
                        selectedTxs
                          .filter((t) => t.type === 'income')
                          .reduce((s, t) => s + Math.abs(t.amount), 0)
                      )}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Gastos: </span>
                    <span className="text-rose-400 font-medium">
                      {formatCurrency(
                        selectedTxs
                          .filter((t) => t.type === 'expense')
                          .reduce((s, t) => s + Math.abs(t.amount), 0)
                      )}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedTxs.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
                    >
                      <div>
                        <p className="text-sm text-slate-200">{tx.description}</p>
                        <p className="text-xs text-slate-500">{tx.category}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          tx.type === 'income'
                            ? 'text-emerald-400'
                            : tx.type === 'transfer'
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(Math.abs(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
