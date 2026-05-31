import { useState } from "react";

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export default function GitHubSync({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const [owner, setOwner] = useState("DogApiKey");
  const [repo, setRepo] = useState("dogapi-kb");
  const [branch, setBranch] = useState("main");
  const [path, setPath] = useState("");
  const [token, setToken] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/sync/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          path: path || undefined,
          token: token || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Sync failed");
      }

      const data = await response.json();
      setResult(data);
      onSyncComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">📦 从 GitHub 同步知识库</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            仓库所有者
          </label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="DogApiKey"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            仓库名称
          </label>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="dogapi-kb"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            分支
          </label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="main"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            子目录（可选）
          </label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="docs/"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          GitHub Token（可选，私有仓库需要）
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="ghp_xxxxx"
        />
        <p className="text-xs text-gray-400 mt-1">
          公开仓库不需要 Token。私有仓库需要有 repo 权限的 Personal Access Token。
        </p>
      </div>

      <button
        onClick={handleSync}
        disabled={syncing || !owner || !repo}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {syncing ? "同步中..." : "开始同步"}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-800 mb-2">✅ 同步完成</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>扫描文件: {result.synced}</p>
            <p>新增文档: {result.created}</p>
            <p>更新文档: {result.updated}</p>
            <p>删除文档: {result.deleted}</p>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-700">错误:</p>
              <ul className="text-xs text-red-600 list-disc list-inside">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">❌ 同步失败</h4>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
