import React, { useState, useEffect } from 'react';
import {
  fetchUserDocuments,
  saveDocument,
  deleteDocument,
  SavedDocument,
  auth,
} from '../firebase';
import {
  Folder,
  FileText,
  Cloud,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
  Clock,
  HardDrive,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface CloudDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDocument: (doc: SavedDocument) => void;
  onSaveCurrentDocument: (name: string) => Promise<void>;
  currentDocName: string;
}

export const CloudDocumentsModal: React.FC<CloudDocumentsModalProps> = ({
  isOpen,
  onClose,
  onOpenDocument,
  onSaveCurrentDocument,
  currentDocName,
}) => {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docTitle, setDocTitle] = useState(currentDocName || 'Executive-Document.pdf');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadDocs = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setFeedback(null);
    try {
      const list = await fetchUserDocuments();
      setDocuments(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Failed to fetch cloud projects: ' + msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDocTitle(currentDocName || 'Executive-Document.pdf');
      loadDocs();
    }
  }, [isOpen, currentDocName]);

  if (!isOpen) return null;

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveCurrentDocument(docTitle.trim());
      setFeedback({ type: 'success', message: `Saved "${docTitle.trim()}" to Firestore!` });
      await loadDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Error saving to cloud: ' + msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from cloud storage?`)) return;
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setFeedback({ type: 'success', message: `Document "${name}" deleted.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Delete failed: ' + msg });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Cloud PDF Documents</span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Firestore Connected
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Save, load, and manage your PDF projects securely</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDocs}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh document list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center gap-2 border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Save Current Document Section */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/60">
          <form onSubmit={handleSaveCurrent} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document file name (e.g. My-Contract-v2.pdf)"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !docTitle.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-blue-600/30"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Save Current to Cloud</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Documents Grid / List */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400 text-xs gap-3">
              <div className="w-7 h-7 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <span>Loading saved cloud documents...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-3 text-slate-500 border border-slate-700">
                <Folder className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">No Cloud Documents Yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Save the current PDF document using the form above to securely store it in your private Firestore collection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {documents.map((docItem) => (
                <div
                  key={docItem.id}
                  className="flex flex-col justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-950 transition group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 flex-shrink-0 border border-slate-700 overflow-hidden relative">
                      {docItem.thumbnail ? (
                        <img src={docItem.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate" title={docItem.name}>
                        {docItem.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-slate-500" />
                          {docItem.pageCount} {docItem.pageCount === 1 ? 'Page' : 'Pages'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(docItem.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        onOpenDocument(docItem);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Editor</span>
                    </button>
                    <button
                      onClick={() => handleDelete(docItem.id, docItem.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
