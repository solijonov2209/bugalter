import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export const TOKEN_KEY = 'bugalter_token';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}`,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    localStorage.removeItem(TOKEN_KEY);
    location.href = '/login';
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Xatolik');
  return data;
}

export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(n ?? 0) + " so'm";

export const currentPeriod = () => new Date().toISOString().slice(0, 7);

export const PAY_TYPES: Record<string, string> = {
  fixed: 'Oklad (oylik maosh)',
  hourly: 'Soatbay',
  per_student: "O'quvchi boshiga",
  percent: "Tushumdan foiz",
};

export const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Qoralama', cls: 'bg-slate-100 text-slate-700' },
  approved: { label: 'Tasdiqlangan', cls: 'bg-amber-100 text-amber-800' },
  paid: { label: "To'langan", cls: 'bg-emerald-100 text-emerald-800' },
};

export const ADJ_KINDS: Record<string, string> = { bonus: 'Bonus', deduction: 'Ushlanma', advance: 'Avans' };

/** Ma'lumotni yuklaydi va server "payroll:changed" xabar yuborganda avtomatik yangilaydi. */
export function useLive<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    if (!path) return;
    api<T>(path).then(setData, (e) => setError(e.message));
  }, [path]);
  useEffect(reload, [reload]);
  useEffect(() => onPayrollChanged(reload), [reload]);
  return { data, error, reload, setData };
}

let socket: Socket | null = null;
const listeners = new Set<() => void>();

export function connectSocket() {
  socket?.disconnect();
  socket = io({ auth: { token: localStorage.getItem(TOKEN_KEY) } });
  socket.on('payroll:changed', () => listeners.forEach((l) => l()));
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

function onPayrollChanged(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
