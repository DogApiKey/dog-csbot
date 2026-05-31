import { useEffect, useState, useCallback } from "react";
import {
  getDocuments,
  createDocument,
  deleteDocument,
  reindexDocument,
  type Document,
} from "../api/client.ts";
import GitHubSync from "../components/GitHubSync.tsx";

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    content: "",
    source: "",
  });
  const [uploading, setUploading] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await getDocuments();
      setDocuments(data.documents);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async () => {
    if (!uploadForm.title.trim() || !uploadForm.content.trim()) return;

    setUploading(true);
    try {
      await createDocument({
        title: uploadForm.title,
        content: uploadForm.content,
        source: uploadForm.source || undefined,
      });
      setUploadForm({ title: "", content: "", source: "" });
      setShowUpload(false);
      await loadDocuments();
    } catch (err) {
      console.error("Failed to upload document:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document and all its vectors?")) return;

    try {
      await deleteDocument(id);
      await loadDocuments();
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleReindex = async (id: string) => {
    try {
      await reindexDocument(id);
      await loadDocuments();
    } catch (err) {
      console.error("Failed to reindex document:", err);
    }
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      ready: "bg-green-100 text-green-800",
      processing: "bg-yellow-100 text-yellow-800",
      pending: "bg-gray-100 text-gray-800",
      error: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${classes[status] ?? classes.pending}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
        <div className="space-x-2">
          <button
            onClick={() => { setShowSync(!showSync); setShowUpload(false); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            {showSync ? "Close" : "📦 Sync from GitHub"}
          </button>
          <button
            onClick={() => { setShowUpload(!showUpload); setShowSync(false); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {showUpload ? "Cancel" : "Upload Document"}
          </button>
        </div>
      </div>

      {/* GitHub Sync */}
      {showSync && (
        <div className="mb-6">
          <GitHubSync onSyncComplete={loadDocuments} />
        </div>
      )}

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">New Document</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={uploadForm.title}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Document title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source (optional)
              </label>
              <input
                type="text"
                value={uploadForm.source}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, source: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="File path or URL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              <textarea
                value={uploadForm.content}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, content: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-40 resize-y"
                placeholder="Paste document content here..."
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadForm.title.trim() || !uploadForm.content.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? "Uploading..." : "Upload & Index"}
            </button>
          </div>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="animate-pulse text-gray-400">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No documents yet. Upload one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{doc.title}</div>
                    {doc.source && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {doc.source}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">{statusBadge(doc.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleReindex(doc.id)}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Re-index
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
