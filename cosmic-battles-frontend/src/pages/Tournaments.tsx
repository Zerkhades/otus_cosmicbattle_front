import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUpcoming, registerTournament } from '../api/tournament';
import { useAuth } from '../auth/AuthProvider';

export default function Tournaments() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.profile?.sub!;

  const { data, isLoading } = useQuery({ queryKey: ['upcoming'], queryFn: fetchUpcoming });

  if (isLoading) return <div className="p-6">Загрузка…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-3">
      <h2 className="text-xl font-semibold mb-2">Ближайшие турниры</h2>
      {data?.map((t: any) => (
        <div key={t.id} className="border rounded p-3 flex items-center justify-between">
          <div>
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-gray-500">
              {new Date(t.startsAt).toLocaleString()} • Мест: {t.maxPlayers}
            </div>
          </div>
          <button
            className="px-3 py-1 border rounded"
            onClick={async () => {
              await registerTournament(t.id, userId);
              qc.invalidateQueries({ queryKey: ['upcoming'] });
            }}>
            Записаться
          </button>
        </div>
      ))}
    </div>
  );
}