import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (username: string) => void;
}

export const UserDialog = ({ open, onOpenChange, onSubmit }: UserDialogProps) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSubmit(username);
      setUsername('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chat-dark border-chat-gray">
        <DialogHeader>
          <DialogTitle className="text-white">Add User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white block mb-2">Username:</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-chat-gray border-none text-white"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-chat-green hover:bg-chat-green/90 text-white"
          >
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};