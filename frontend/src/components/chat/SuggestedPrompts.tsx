import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Sparkles, Compass, MapPin, Zap, Award } from 'lucide-react';

export const SuggestedPrompts: React.FC = () => {
  const { sendMessage, isTyping } = useChat();

  const suggestions = [
    { text: 'Recommend jobs for my profile', icon: Sparkles },
    { text: 'Show only remote jobs', icon: Compass },
    { text: 'Find React & Node.js developer roles', icon: Zap },
    { text: 'Only show jobs with >80% match', icon: Award },
    { text: 'Show fresher or internship roles', icon: Compass },
    { text: 'Show jobs in Delhi or Bangalore', icon: MapPin },
  ];

  return (
    <div className="py-2">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        <span>Suggested Queries</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              disabled={isTyping}
              onClick={() => sendMessage(item.text)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <Icon className="w-3 h-3 text-slate-400" />
              <span>{item.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

