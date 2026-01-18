import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Scene, Line, sampleScene, getCharacterLines } from '@/data/sampleScene';

interface SceneContextType {
  scene: Scene;
  selectedRole: string | null;
  setSelectedRole: (role: string | null) => void;
  characterLines: Line[];
  currentLineIndex: number;
  setCurrentLineIndex: (index: number) => void;
  getCurrentLine: () => Line | null;
  nextLine: () => void;
  prevLine: () => void;
  resetProgress: () => void;
  hasNextLine: boolean;
  hasPrevLine: boolean;
  totalLines: number;
}

const SceneContext = createContext<SceneContextType | undefined>(undefined);

export const SceneProvider = ({ children }: { children: ReactNode }) => {
  const [scene] = useState<Scene>(sampleScene);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  const characterLines = selectedRole ? getCharacterLines(scene, selectedRole) : [];

  const getCurrentLine = (): Line | null => {
    if (characterLines.length === 0 || currentLineIndex >= characterLines.length) {
      return null;
    }
    return characterLines[currentLineIndex];
  };

  const nextLine = () => {
    if (currentLineIndex < characterLines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
    }
  };

  const prevLine = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex(prev => prev - 1);
    }
  };

  const resetProgress = () => {
    setCurrentLineIndex(0);
  };

  const handleSetSelectedRole = (role: string | null) => {
    setSelectedRole(role);
    setCurrentLineIndex(0);
  };

  return (
    <SceneContext.Provider
      value={{
        scene,
        selectedRole,
        setSelectedRole: handleSetSelectedRole,
        characterLines,
        currentLineIndex,
        setCurrentLineIndex,
        getCurrentLine,
        nextLine,
        prevLine,
        resetProgress,
        hasNextLine: currentLineIndex < characterLines.length - 1,
        hasPrevLine: currentLineIndex > 0,
        totalLines: characterLines.length,
      }}
    >
      {children}
    </SceneContext.Provider>
  );
};

export const useScene = (): SceneContextType => {
  const context = useContext(SceneContext);
  if (context === undefined) {
    throw new Error('useScene must be used within a SceneProvider');
  }
  return context;
};
