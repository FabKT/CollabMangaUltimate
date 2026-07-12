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

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}

export const AddProjectDialog = ({
  open,
  onOpenChange,
  onSubmit,
}: AddProjectDialogProps) => {
  const [projectName, setProjectName] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      onSubmit(projectName);
      setProjectName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chat-dark border-chat-gray">
        <DialogHeader>
          <DialogTitle className="text-white">Create your Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="projectName" className="text-white">
              Project name:
            </Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
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