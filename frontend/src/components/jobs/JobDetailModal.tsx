import React from 'react';
import { Job } from '../../types/job';
import { Badge } from '../common/Badge';
import { X, Building2, MapPin, Briefcase, ExternalLink, Send } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose }) => {
  const { applyForJob } = useChat();
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{job.id}</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{job.title}</h3>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mt-2">
              <span className="flex items-center gap-1 font-medium">
                <Building2 className="w-4 h-4 text-slate-400" />
                {job.company}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                {job.location}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary" className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              {job.experience_required}
            </Badge>
            <Badge variant="neutral">{job.employment_type}</Badge>
            <Badge variant="neutral">Source: {job.source}</Badge>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Required Skills
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((skill, idx) => (
                <Badge key={idx} variant="neutral" size="sm">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Job Description
            </h4>
            <div className="prose dark:prose-invert text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {job.description}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <a
            href={job.source_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors"
          >
            View original posting <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                applyForJob(job.id);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Apply via Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

