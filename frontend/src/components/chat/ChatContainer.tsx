import React, { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { SuggestedPrompts } from './SuggestedPrompts';
import { Job } from '../../types/job';

interface ChatContainerProps {
  onViewJobDetails: (job: Job) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ onViewJobDetails }) => {
  const { messages, isTyping } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onViewJobDetails={onViewJobDetails}
          />
        ))}

        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />

        {/* Suggested Prompts below conversation */}
        {!isTyping && messages.length <= 4 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <SuggestedPrompts />
          </div>
        )}
      </div>
    </div>
  );
};

