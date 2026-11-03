import React, { useState, useEffect } from 'react';
import {
  logoutUser,
  fetchUserDocuments,
  deleteDocument,
  type SavedDocument,
  type FirebaseUser,
} from '../firebase';
import {
  FolderOpen,
  LogOut,
  User,
  FileText,
  Clock,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface FirebaseSidebarPanelProps {
  user: FirebaseUser | null;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenCloudDocs: () => void;
  onSaveCurrentToCloud: () => void;
  onOpenDocument: (doc: SavedDocument) => void;
  isSaving?: boolean;
}

export const FirebaseSidebarPanel: React.FC<FirebaseSidebarPanelProps> = ({
  user,
  onOpenAuth,
  onOpenCloudDocs,
  onSaveCurrentToCloud,
  onOpenDocument,
  isSaving = false,
}) => {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDocs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await fetchUserDocuments();
      setDocuments(list);
    } catch (err) {
      console.warn('Failed to fetch sidebar documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDocs();
    } else {
      setDocuments([]);
    }
  }, [user]);

  const handleDelete = async (docId: string, name: string) => {
    if (!confirm(`Delete "${name}" from Cloud?`)) return;
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* User Account State Card */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-white flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span>Account</span>
          </h4>
          {user ? (
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-medium">
              Signed In
            </span>
          ) : (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-medium">
              Guest
            </span>
          )}
        </div>

        {user ? (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <p className="font-semibold text-white truncate">{user.displayName || 'Authenticated User'}</p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSaveCurrentToCloud}
                disabled={isSaving}
                className="py-2 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 transition text-[11px] disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Cloud'}</span>
              </button>
              <button
                onClick={onOpenCloudDocs}
                className="py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition text-[11px]"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Manage Docs</span>
              </button>
            </div>

            <button
              onClick={() => logoutUser()}
              className="w-full py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium flex items-center justify-center gap-1.5 transition text-[11px] border border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-slate-400 text-[11px]">
              Sign in to save PDF projects, synchronize across devices, and manage your cloud documents.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onOpenAuth('signin')}
                className="py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-center transition shadow-md shadow-blue-600/30"
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-center transition border border-slate-700"
              >
                Create Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cloud Saved Documents List */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-white flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Saved Cloud Documents</span>
          </h4>
          {user && (
            <button
              onClick={loadDocs}
              disabled={loading}
              className="p-1 rounded text-slate-400 hover:text-white transition"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}
        </div>

        {!user ? (
          <div className="py-6 text-center text-slate-500 text-[11px]">
            <Lock className="w-6 h-6 mx-auto mb-2 text-slate-600" />
            <span>Sign in to view and open your saved cloud documents.</span>
          </div>
        ) : loading && documents.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-[11px]">
            <RefreshCw className="w-4 h-4 mx-auto mb-1 animate-spin text-blue-400" />
            <span>Loading cloud documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-[11px]">
            <span>No documents saved yet. Click "Save Cloud" above to save this document.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {documents.map((docItem) => (
              <div
                key={docItem.id}
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-2 hover:border-slate-700 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate text-[11px]" title={docItem.name}>
                    {docItem.name}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(docItem.updatedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{docItem.pageCount}p</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenDocument(docItem)}
                    className="p-1.5 rounded hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 transition"
                    title="Open document in editor"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(docItem.id, docItem.name)}
                    className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
