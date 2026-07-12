import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
}

interface SidebarProps {
  projects: Project[];
  users: User[];
  selectedId: string | null;
  onProjectClick: (id: string) => void;
  onUserClick: (id: string) => void;
  onAddProject: () => void;
  onAddUser: () => void;
}

export const Sidebar = ({
  projects,
  users,
  selectedId,
  onProjectClick,
  onUserClick,
  onAddProject,
  onAddUser,
}: SidebarProps) => {
  return (
    <div className="w-64 bg-chat-darker h-screen flex flex-col">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-chat-title-green font-bold text-lg font-app">Projects</h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-chat-title-green"
            onClick={onAddProject}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`p-2 rounded cursor-pointer text-white ${
                selectedId === project.id ? 'bg-chat-gray' : 'hover:bg-chat-gray/50'
              }`}
              onClick={() => onProjectClick(project.id)}
            >
              {project.name}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-chat-title-green font-bold text-lg font-app">Users</h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-chat-title-green"
            onClick={onAddUser}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {users.map((user) => (
            <div
              key={user.id}
              className={`p-2 rounded cursor-pointer text-white ${
                selectedId === user.id ? 'bg-chat-gray' : 'hover:bg-chat-gray/50'
              }`}
              onClick={() => onUserClick(user.id)}
            >
              {user.username}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};