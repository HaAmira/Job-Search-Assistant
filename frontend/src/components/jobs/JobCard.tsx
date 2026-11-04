import React, { useState } from 'react';
import { MatchResult } from '../../types/job';
import { Badge } from '../common/Badge';
import { Building2, MapPin, Briefcase, ExternalLink, Send, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useSession } from '../../context/SessionContext';

interface JobCardProps {
  matchResult: MatchResult;
  onViewDetails?: (job: MatchResult['job']) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ matchResult, onViewDetails }) => {
  const { job, matchPercentage, matchingSkills, missingSkills, matchReason } = matchResult;
  const { applyForJob } = useChat();
  const { applications } = useSession();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Check if this job has already been applied to
  const existingApp = applications.find((app) => app.jobId === job.id);

  const getScoreVariant = (score: number): 'success' | 'primary' | 'warning' | 'neutral' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'primary';
    if (score >= 40) return 'warning';
    return 'neutral';
  };

  const handleApply = async () => {
    if (existingApp || isApplying) return;
    setIsApplying(true);
    try {
      await applyForJob(job.id);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500 mb-1 block">
              {job.id}
            </span>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {job.title}
            </h4>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {job.company}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {job.location}
              </span>
            </div>
          </div>

          {/* Match Score Badge */}
          <Badge
            variant={getScoreVariant(matchPercentage)}
            className="flex items-center gap-1 shrink-0 font-bold px-3 py-1 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {matchPercentage}% Match
          </Badge>
        </div>

        {/* Experience & Employment Type Meta */}
        <div className="flex flex-wrap items-center gap-2 my-3">
          <Badge variant="neutral" size="sm" className="flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            {job.experience_required}
          </Badge>
          <Badge variant="neutral" size="sm">
            {job.employment_type}
          </Badge>
        </div>

        {/* Skills Tag Cloud */}
        <div className="space-y-1.5 my-3">
          <div className="flex flex-wrap gap-1.5">
            {/* Matching skills in emerald */}
            {matchingSkills.slice(0, 4).map((skill, idx) => (
              <Badge key={`m-${idx}`} variant="success" size="sm">
                ✓ {skill}
              </Badge>
            ))}

            {/* Missing skills in warning/amber */}
            {missingSkills.slice(0, 3).map((skill, idx) => (
              <Badge key={`u-${idx}`} variant="warning" size="sm">
                + {skill}
              </Badge>
            ))}

            {job.skills.length > 7 && (
              <span className="text-xs text-slate-400 self-center">
                +{job.skills.length - 7} more
              </span>
            )}
          </div>
        </div>

        {/* Match Reason Accordion */}
        <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
          <p className={`${isExpanded ? '' : 'line-clamp-2'}`}>
            <span className="font-semibold text-slate-700 dark:text-slate-200">Why it matches: </span>
            {matchReason}
          </p>
          {matchReason.length > 100 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 text-xs font-medium"
            >
              {isExpanded ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Read full explanation <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(job)}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Details
            </button>
          )}
          <a
            href={job.source_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            Source <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {existingApp ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Applied ({existingApp.status})
          </div>
        ) : (
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-all hover:shadow active:scale-95 disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            {isApplying ? 'Applying...' : 'Apply via Chat'}
          </button>
        )}
      </div>
    </div>
  );
};

