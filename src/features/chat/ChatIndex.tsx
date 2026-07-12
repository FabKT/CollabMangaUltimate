import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ProjectDialog } from './components/ProjectDialog';
import { UserDialog } from './components/UserDialog';
import { useToast } from '@/components/ui/use-toast';

interface Project {
  id: string;
  name: string;
  genre?: string;
  image?: string | null;
}

interface User {
  id: string;
  username: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  sender: string;
}

interface Messages {
  [key: string]: Message[];
}

export default function Index() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Messages>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load data from localStorage
    const savedProjects = localStorage.getItem('projects');
    const savedUsers = localStorage.getItem('users');
    const savedMessages = localStorage.getItem('messages');

    if (savedProjects) setProjects(JSON.parse(savedProjects));
    if (savedUsers) setUsers(JSON.parse(savedUsers));
    if (savedMessages) setMessages(JSON.parse(savedMessages));
  }, []);

  useEffect(() => {
    // Save data to localStorage when it changes
    localStorage.setItem('projects', JSON.stringify(projects));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('messages', JSON.stringify(messages));
  }, [projects, users, messages]);

  const handleAddProject = (projectData: Partial<Project>) => {
    const newProject = {
      id: `project-${Date.now()}`,
      name: projectData.name || '',
      genre: projectData.genre,
      image: projectData.image,
    };
    setProjects([...projects, newProject]);
    toast({
      title: 'Project added',
      description: `${newProject.name} has been added to your projects.`,
    });
  };

  const handleAddUser = (username: string) => {
    const newUser = {
      id: `user-${Date.now()}`,
      username,
    };
    setUsers([...users, newUser]);
    toast({
      title: 'User added',
      description: `${username} has been added to your contacts.`,
    });
  };

  const handleSendMessage = (content: string) => {
    if (!selectedId) return;

    const newMessage = {
      id: `msg-${Date.now()}`,
      content,
      timestamp: new Date().toLocaleTimeString(),
      sender: 'You',
    };

    setMessages((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), newMessage],
    }));
  };

  const getSelectedName = () => {
    const project = projects.find((p) => p.id === selectedId);
    if (project) return project.name;

    const user = users.find((u) => u.id === selectedId);
    if (user) return user.username;

    return '';
  };

  return (
    <div className="flex h-screen bg-chat-dark">
      <Sidebar
        projects={projects}
        users={users}
        selectedId={selectedId}
        onProjectClick={setSelectedId}
        onUserClick={setSelectedId}
        onAddProject={() => setAddProjectOpen(true)}
        onAddUser={() => setAddUserOpen(true)}
      />

      {selectedId ? (
        <ChatArea
          selectedName={getSelectedName()}
          messages={messages[selectedId] || []}
          onSendMessage={handleSendMessage}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-white text-lg">
          Select a project or user to start chatting
        </div>
      )}

      <ProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        onSubmit={handleAddProject}
      />

      <UserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onSubmit={handleAddUser}
      />
    </div>
  );
}