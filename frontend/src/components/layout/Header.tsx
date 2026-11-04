import React from 'react';
import { useSession } from '../../context/SessionContext';
import { Menu, UploadCloud, User, CheckCircle2, Database } from 'lucide-react';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onOpenUpload: () => void;
  onOpenProfile: () => void;
  onOpenApplications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileSidebar,
  onOpenUpload,
  onOpenProfile,
  onOpenApplications,
}) => {
  const { resumeData, applications } = useSession();

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-900 dark:text-white">
            Job Chat Assistant
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            1,774 Verified Jobs
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenUpload}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
        >
          <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
          <span>Upload Resume</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
        >
          <User className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden sm:inline">
            {resumeData?.name ? resumeData.name.split(' ')[0] : 'Profile'}
          </span>
        </button>

        <button
          onClick={onOpenApplications}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Applied ({applications.length})</span>
        </button>
      </div>
    </header>
  );
};

