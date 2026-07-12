import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (username: string) => void;
}

export const AddUserDialog = ({
  open,
  onOpenChange,
  onSubmit,
}: AddUserDialogProps) => {
  const [username, setUsername] = React.useState('');

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
            <Label htmlFor="username" className="text-white">
              Username:
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-chat-gray border-none text-white mt-2"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-chat-green hover:bg-chat-green/90 text-black"
          >
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};