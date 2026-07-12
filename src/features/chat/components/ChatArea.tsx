import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { ChatMessage } from './ChatMessage';

interface Message {
  id: string;
  content: string;
  timestamp: string;
  sender: string;
}

interface ChatAreaProps {
  selectedName: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export const ChatArea = ({ selectedName, messages, onSendMessage }: ChatAreaProps) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-chat-dark">
      <div className="p-4 border-b border-chat-gray">
        <h2 className="text-white text-xl font-semibold">{selectedName}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            content={message.content}
            timestamp={message.timestamp}
            sender={message.sender}
          />
        ))}
      </div>

      <div className="p-4 border-t border-chat-gray">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 bg-chat-gray border-none text-white"
          />
          <Button
            onClick={handleSend}
            className="bg-chat-green hover:bg-chat-green/80 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};