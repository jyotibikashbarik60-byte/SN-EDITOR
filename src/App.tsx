import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  auth,
  onAuthStateChanged,
  type FirebaseUser,
  saveDocument,
  recordDailyTrafficPageView,
  recordActivity,
  SavedDocument,
} from './firebase';
import { AuthModal } from './components/AuthModal';
import { CloudDocumentsModal } from './components/CloudDocumentsModal';
import { UserHeaderBar } from './components/UserHeaderBar';
import { FirebaseSidebarPanel } from './components/FirebaseSidebarPanel';
import {
  LogIn,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';

declare global {
  interface Window {
    PDFBossApp?: any;
    PDFBossAPI?: {
      loadPdfDocument: (dataBuffer: ArrayBuffer, name?: string) => Promise<void>;
      loadSampleLetter: () => Promise<void>;
      addNewBlankPage: () => void;
      exportCleanPdf: () => Promise<void>;
      exportCompiledPdfBytes: () => Promise<Uint8Array | null>;
      getThumbnailDataUrl: () => string;
      loadPdfFromBase64: (base64OrDataUrl: string, name?: string) => Promise<void>;
      getCurrentDocInfo: () => {
        name: string;
        numPages: number;
        currentPageNum: number;
        modifiedCount: number;
      };
    };
  }
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [cloudDocsOpen, setCloudDocsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);
  const [headerSlotEl, setHeaderSlotEl] = useState<HTMLElement | null>(null);
  const [sidebarSlotEl, setSidebarSlotEl] = useState<HTMLElement | null>(null);

  // 1. Initialize Auth and Silent Firestore Backend Telemetry
  useEffect(() => {
    // Record silent traffic telemetry directly to Firebase backend
    recordDailyTrafficPageView(false);
    recordActivity('page_view', 'User loaded PDF Boss application', window.location.pathname);

    // Track export events silently to Firestore backend
    const handleExportComplete = (e: any) => {
      const fileName = e.detail?.fileName || 'document.pdf';
      recordDailyTrafficPageView(true);
      recordActivity('pdf_export', `Lossless PDF compiled & downloaded: ${fileName}`);
    };
    window.addEventListener('pdfboss:export_complete', handleExportComplete);

    // Listen to Toolbar Custom Events
    const handleTriggerCloudSave = () => handleSaveCurrentToCloud();
    const handleTriggerCloudDocs = () => {
      if (!auth.currentUser) {
        handleOpenAuth('signin');
      } else {
        setCloudDocsOpen(true);
      }
    };
    const handleTriggerAuth = () => handleOpenAuth('signin');

    window.addEventListener('pdfboss:cloud_save', handleTriggerCloudSave);
    window.addEventListener('pdfboss:cloud_docs', handleTriggerCloudDocs);
    window.addEventListener('pdfboss:open_auth', handleTriggerAuth);

    // Track user session
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
      if (currentUser) {
        recordActivity('session_start', `Authenticated session active: ${currentUser.email}`);
      }
    });

    // Locate header and sidebar slots
    const locateSlots = () => {
      const slot = document.getElementById('header-user-slot');
      if (slot) setHeaderSlotEl(slot);

      const sideSlot = document.getElementById('tab-firebase-content');
      if (sideSlot) setSidebarSlotEl(sideSlot);
    };

    locateSlots();
    const interval = setInterval(locateSlots, 300);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('pdfboss:export_complete', handleExportComplete);
      window.removeEventListener('pdfboss:cloud_save', handleTriggerCloudSave);
      window.removeEventListener('pdfboss:cloud_docs', handleTriggerCloudDocs);
      window.removeEventListener('pdfboss:open_auth', handleTriggerAuth);
    };
  }, []);

  // Show transient notification toast
  const showToast = (text: string, type: 'success' | 'warn' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 2. Save Document to Firestore Backend
  const handleSaveCurrentToCloud = async (customName?: string) => {
    if (!user) {
      setAuthMode('signin');
      setAuthModalOpen(true);
      return;
    }

    if (!window.PDFBossAPI) {
      showToast('PDF Editor is initializing. Please try again.', 'warn');
      return;
    }

    setIsSaving(true);
    try {
      const docInfo = window.PDFBossAPI.getCurrentDocInfo();
      const compiledBytes = await window.PDFBossAPI.exportCompiledPdfBytes();

      if (!compiledBytes) {
        throw new Error('No document is currently active to save.');
      }

      // Convert Uint8Array to base64 Data URL
      let binary = '';
      const len = compiledBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(compiledBytes[i]);
      }
      const base64Data = btoa(binary);
      const pdfDataUrl = `data:application/pdf;base64,${base64Data}`;

      const thumbnail = window.PDFBossAPI.getThumbnailDataUrl();
      const name = customName || docInfo.name || 'Cloud-Document.pdf';

      await saveDocument({
        id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ownerId: user.uid,
        name,
        pageCount: docInfo.numPages || 1,
        fileSize: compiledBytes.byteLength,
        thumbnail: thumbnail.length > 100 ? thumbnail : undefined,
        pdfDataUrl: pdfDataUrl.length < 950000 ? pdfDataUrl : undefined,
        editsSummary: `Saved with ${docInfo.modifiedCount || 0} modifications`,
      });

      showToast(`Successfully saved "${name}" to Cloud Firestore!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('Failed to save document: ' + msg, 'warn');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Load Document from Firestore Backend into Editor
  const handleOpenDocument = async (docItem: SavedDocument) => {
    try {
      if (docItem.pdfDataUrl && window.PDFBossAPI) {
        await window.PDFBossAPI.loadPdfFromBase64(docItem.pdfDataUrl, docItem.name);
        showToast(`Loaded "${docItem.name}" from Cloud!`, 'success');
        recordActivity('pdf_open', `Loaded cloud document: ${docItem.name}`);
      } else {
        showToast('Document snapshot preview unavailable.', 'warn');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('Error opening cloud document: ' + msg, 'warn');
    }
  };

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <>
      {/* 1. Header Integration via Portal into .header-actions */}
      {headerSlotEl &&
        createPortal(
          <UserHeaderBar
            user={user}
            onOpenAuth={handleOpenAuth}
            onOpenCloudDocs={() => setCloudDocsOpen(true)}
            onSaveCurrentToCloud={() => handleSaveCurrentToCloud()}
            isSaving={isSaving}
          />,
          headerSlotEl
        )}

      {/* 2. Sidebar Integration via Portal into #tab-firebase-content */}
      {sidebarSlotEl &&
        createPortal(
          <FirebaseSidebarPanel
            user={user}
            onOpenAuth={handleOpenAuth}
            onOpenCloudDocs={() => setCloudDocsOpen(true)}
            onSaveCurrentToCloud={() => handleSaveCurrentToCloud()}
            onOpenDocument={handleOpenDocument}
            isSaving={isSaving}
          />,
          sidebarSlotEl
        )}

      {/* 3. Unauthenticated Editor Protection Gate */}
      {authInitialized && !user && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-lg animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 rounded-2xl bg-slate-900/95 border border-blue-500/40 shadow-2xl shadow-black/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Sign In for Cloud Access & Export</span>
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-semibold">
                    Protected
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Authenticate to save PDF projects, sync cloud documents, and unlock export.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleOpenAuth('signin')}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => handleOpenAuth('signup')}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Floating In-App Toast */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[99999] px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-medium shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* 5. Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />

      {/* 6. Cloud Documents Modal */}
      <CloudDocumentsModal
        isOpen={cloudDocsOpen}
        onClose={() => setCloudDocsOpen(false)}
        onOpenDocument={handleOpenDocument}
        onSaveCurrentDocument={handleSaveCurrentToCloud}
        currentDocName={window.PDFBossApp?.fileName || 'Executive-Offer-Letter.pdf'}
      />
    </>
  );
}
