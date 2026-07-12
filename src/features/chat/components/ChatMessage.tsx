import React from 'react';

interface ChatMessageProps {
  content: string;
  timestamp: string;
  sender: string;
}

export const ChatMessage = ({ content, timestamp, sender }: ChatMessageProps) => {
  return (
    <div className="bg-chat-gray rounded p-3 max-w-[80%]">
      <div className="text-white">{content}</div>
      <div className="text-xs text-gray-400 mt-1">
        {sender} • {timestamp}
      </div>
    </div>
  );
};