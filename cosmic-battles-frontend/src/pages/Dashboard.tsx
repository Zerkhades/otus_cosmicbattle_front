import { useAuth } from '../auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/player';

export default function Dashboard() {
  const { user } = useAuth();
  const sub   = user?.profile?.sub;
  const name  = user?.profile?.preferred_username || user?.profile?.name || '—';

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: !!user });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Добро пожаловать, {name}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="border p-3 rounded">
          <div className="text-sm text-gray-500">ID</div>
          <div className="font-mono text-sm break-all">{sub}</div>
        </div>
        <div className="border p-3 rounded">
          <div className="text-sm text-gray-500">Рейтинг</div>
          <div className="text-xl">{me?.rating ?? '—'}</div>
        </div>
        <div className="border p-3 rounded">
          <div className="text-sm text-gray-500">Уведомления</div>
          <div className="text-xl">в разработке</div>
        </div>
      </div>
    </div>
  );
}