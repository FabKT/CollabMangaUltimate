import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (project: any) => void;
}

export const ProjectDialog = ({ open, onOpenChange, onSubmit }: ProjectDialogProps) => {
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit({
        name,
        genre,
        image: image ? URL.createObjectURL(image) : null,
      });
      setName('');
      setGenre('');
      setImage(null);
      setImagePreview(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chat-dark border-chat-gray">
        <DialogHeader>
          <DialogTitle className="text-white">Create your Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-white block mb-2">Project name:</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-chat-gray border-none text-white"
            />
          </div>

          <div>
            <label className="text-white block mb-2">Genre:</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded bg-chat-gray border-none text-white px-3 py-2"
            >
              <option value="">Select a genre</option>
              <option value="shonen">Shonen</option>
              <option value="seinen">Seinen</option>
              <option value="josei">Josei</option>
              <option value="shojo">Shojo</option>
            </select>
          </div>

          <div>
            <label className="text-white block mb-2">Add Project Image:</label>
            <div 
              className="w-24 h-24 bg-chat-gray rounded flex items-center justify-center cursor-pointer"
              onClick={() => document.getElementById('project-image-input')?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} className="w-24 h-24 object-cover rounded" alt="Preview" />
              ) : (
                <svg className="h-8 w-8 text-white/50" viewBox="0 0 24 24">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
            </div>
            <input
              type="file"
              id="project-image-input"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
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