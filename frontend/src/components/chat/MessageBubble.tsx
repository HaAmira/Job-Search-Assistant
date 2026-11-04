import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../types/chat';
import { Job } from '../../types/job';
import { JobCard } from '../jobs/JobCard';
import { Bot, User, Check, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

interface MessageBubbleProps {
  message: ChatMessage;
  onViewJobDetails?: (job: Job) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onViewJobDetails,
}) => {
  const isUser = message.role === 'user';
  const { sendMessage, isTyping } = useChat();

  return (
    <div className={`flex gap-3 py-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
          isUser
            ? 'bg-slate-700 text-white'
            : 'bg-indigo-600 text-white'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Container */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? 'rounded-tr-sm bg-indigo-600 text-white'
              : 'rounded-tl-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'
          }`}
        >
          <div className="prose dark:prose-invert text-sm max-w-none prose-p:leading-relaxed prose-pre:my-2 prose-ul:my-2 prose-li:my-0.5">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          {/* Quick Confirmation Actions for 2-step application workflow */}
          {message.requiresConfirmation && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <button
                disabled={isTyping}
                onClick={() => sendMessage('Yes, confirm application')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Yes, Confirm Application
              </button>
              <button
                disabled={isTyping}
                onClick={() => sendMessage('No, cancel')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-slate-400 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        {/* Embedded Interactive Job Cards */}
        {message.jobs && message.jobs.length > 0 && (
          <div className="mt-4 w-full grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {message.jobs.map((matchRes) => (
              <JobCard
                key={matchRes.job.id}
                matchResult={matchRes}
                onViewDetails={onViewJobDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

