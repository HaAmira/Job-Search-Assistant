import React, { useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { Send, Paperclip, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onOpenUploadModal: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onOpenUploadModal }) => {
  const { sendMessage, isTyping } = useChat();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="relative border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 max-w-4xl mx-auto rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all"
      >
        {/* Attachment button for Resume Upload */}
        <button
          type="button"
          onClick={onOpenUploadModal}
          title="Upload resume (PDF / DOCX)"
          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything, filter jobs, or upload resume (e.g. 'Show remote React jobs', 'Apply to job 1')..."
          className="w-full resize-none bg-transparent py-1.5 px-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none max-h-32"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-sm transition-all shrink-0 active:scale-95"
        >
          {isTyping ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
      <div className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
        AI Job Assistant can recommend, filter, and track applications. Press <b>Enter</b> to send, <b>Shift+Enter</b> for new line.
      </div>
    </div>
  );
};

