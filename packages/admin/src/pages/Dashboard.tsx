import { useEffect, useState } from "react";
import { getStats, type Stats } from "../api/client.ts";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Documents"
          value={stats?.documents.total ?? 0}
          subtitle={`${stats?.documents.ready ?? 0} ready`}
          color="indigo"
        />
        <StatCard
          title="Conversations"
          value={stats?.conversations.total ?? 0}
          subtitle="All channels"
          color="green"
        />
        <StatCard
          title="Processing"
          value={stats?.documents.processing ?? 0}
          subtitle="Documents indexing"
          color="yellow"
        />
        <StatCard
          title="Errors"
          value={stats?.documents.error ?? 0}
          subtitle="Documents failed"
          color="red"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="text-sm font-medium text-gray-500 mb-2">{title}</div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}
      >
        {subtitle}
      </div>
    </div>
  );
}
