import React from 'react';
import { useSession } from '../../context/SessionContext';
import { useChat } from '../../context/ChatContext';
import {
  Plus,
  User,
  Briefcase,
  CheckCircle2,
  Trash2,
  Moon,
  Sun,
  UploadCloud,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  onOpenProfile: () => void;
  onOpenApplications: () => void;
  onOpenUpload: () => void;
  onOpenRecommendedJobs: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenProfile,
  onOpenApplications,
  onOpenUpload,
  onOpenRecommendedJobs,
}) => {
  const { resumeData, applications, startNewSession, theme, toggleTheme } = useSession();
  const { clearChat } = useChat();

  const handleNewChat = () => {
    clearChat();
    startNewSession();
  };

  return (
    <aside className="w-64 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
            HT
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Hidani Tech
            </h1>
            <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              AI Job Assistant
            </p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>

        {/* Resume Profile */}
        <button
          onClick={onOpenProfile}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-indigo-500" />
            <span>Candidate Profile</span>
          </span>
          {resumeData?.name ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold truncate max-w-[80px]">
              Active
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">None</span>
          )}
        </button>

        {/* Upload Resume Button */}
        <button
          onClick={onOpenUpload}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <UploadCloud className="w-4 h-4 text-indigo-500" />
          <span>Upload Resume</span>
        </button>

        {/* Recommended Jobs */}
        <button
          onClick={onOpenRecommendedJobs}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Browse 1,700+ Jobs</span>
          </span>
        </button>

        {/* Applied Jobs */}
        <button
          onClick={onOpenApplications}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Applied Jobs</span>
          </span>
          {applications.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
              {applications.length}
            </span>
          )}
        </button>
      </div>

      {/* Profile Card Footer */}
      {resumeData && (
        <div className="p-3 mx-3 mb-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
              {(resumeData.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {resumeData.name || 'Candidate'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {resumeData.designation || 'Software Engineer'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Utilities Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <button
          onClick={clearChat}
          title="Clear current conversation"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

