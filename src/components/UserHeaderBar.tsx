import React, { useState } from 'react';
import {
  auth,
  logoutUser,
  type FirebaseUser,
} from '../firebase';
import {
  Cloud,
  FolderOpen,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Shield,
} from 'lucide-react';

interface UserHeaderBarProps {
  user: FirebaseUser | null;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenCloudDocs: () => void;
  onSaveCurrentToCloud: () => void;
  isSaving?: boolean;
}

export const UserHeaderBar: React.FC<UserHeaderBarProps> = ({
  user,
  onOpenAuth,
  onOpenCloudDocs,
  onSaveCurrentToCloud,
  isSaving = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 relative">
      {user ? (
        <>
          {/* Cloud Documents Button */}
          <button
            onClick={onOpenCloudDocs}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 transition"
            title="Browse your saved Cloud PDF documents"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>My Docs</span>
          </button>

          {/* Quick Save to Cloud */}
          <button
            onClick={onSaveCurrentToCloud}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white text-xs font-semibold border border-blue-500/30 transition shadow-sm"
            title="Save current PDF and modifications directly to Firestore"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSaving ? 'animate-bounce' : ''}`} />
            <span>{isSaving ? 'Saving...' : 'Save to Cloud'}</span>
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 transition"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  (user.displayName || user.email || 'U')[0].toUpperCase()
                )}
              </div>
              <span className="text-xs font-medium text-slate-200 max-w-[90px] truncate hidden md:inline-block">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-xl shadow-black/60 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-2 border-b border-slate-800">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.displayName || 'Authenticated User'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                      <Shield className="w-3 h-3" />
                      <span>Firebase Protected Account</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenCloudDocs();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2.5 transition"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                      <span>Cloud Documents</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-800">
                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        await logoutUser();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2.5 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <button
          onClick={() => onOpenAuth('signin')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition active:scale-95"
        >
          <UserIcon className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>
      )}
    </div>
  );
};
