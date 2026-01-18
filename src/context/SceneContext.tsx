import React, { createContext, useContext, useState, ReactNode } from 'react';
import { sampleScene } from '@/data/sampleScene';
import type { LineBlock } from '@/types/scene';

// Unified line interface for practice modes
export interface PracticeLine {
  character: string;
  cue_line: string;
  shakespeare_line: string;
  modern_hint: string;
}

interface SceneContextType {
  // Scene info
  sceneId: string | null;
  sceneTitle: string;
  setSceneId: (id: string | null) => void;
  setSceneTitle: (title: string) => void;
  
  // Practice mode selection
  selectedMode: string | null;
  setSelectedMode: (mode: string | null) => void;
  
  // Role selection
  selectedRole: string | null;
  setSelectedRole: (role: string | null) => void;
  characters: string[];
  setCharacters: (chars: string[]) => void;
  
  // Lines for practice
  practiceLines: PracticeLine[];
  setPracticeLines: (lines: PracticeLine[]) => void;
  
  // Navigation
  currentLineIndex: number;
  setCurrentLineIndex: (index: number) => void;
  getCurrentLine: () => PracticeLine | null;
  nextLine: () => void;
  prevLine: () => void;
  resetProgress: () => void;
  hasNextLine: boolean;
  hasPrevLine: boolean;
  totalLines: number;
  
  // Helper to load from LineBlocks
  loadFromLineBlocks: (blocks: LineBlock[], role: string) => void;
  
  // Use sample scene
  useSampleScene: () => void;
}

const SceneContext = createContext<SceneContextType | undefined>(undefined);

export const SceneProvider = ({ children }: { children: ReactNode }) => {
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [sceneTitle, setSceneTitle] = useState<string>(sampleScene.title);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [characters, setCharacters] = useState<string[]>(sampleScene.characters);
  const [practiceLines, setPracticeLines] = useState<PracticeLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  // Filter lines for selected role
  const filteredLines = selectedRole 
    ? practiceLines.filter(line => line.character.toLowerCase() === selectedRole.toLowerCase())
    : [];

  const getCurrentLine = (): PracticeLine | null => {
    if (filteredLines.length === 0 || currentLineIndex >= filteredLines.length) {
      return null;
    }
    return filteredLines[currentLineIndex];
  };

  const nextLine = () => {
    if (currentLineIndex < filteredLines.length - 1) {
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

  // Load lines from database LineBlocks
  const loadFromLineBlocks = (blocks: LineBlock[], role: string) => {
    const roleBlocks = blocks.filter(b => 
      b.speaker_name.toLowerCase() === role.toLowerCase()
    );
    
    const lines: PracticeLine[] = roleBlocks.map(block => ({
      character: block.speaker_name,
      cue_line: block.preceding_cue_raw || '(Scene opens)',
      shakespeare_line: block.text_raw,
      modern_hint: block.modern_hint || '',
    }));
    
    setPracticeLines(lines);
    setSelectedRole(role);
    setCurrentLineIndex(0);
  };

  // Use built-in sample scene
  const useSampleScene = () => {
    setSceneId(null);
    setSceneTitle(sampleScene.title);
    setCharacters(sampleScene.characters);
    setPracticeLines(sampleScene.lines.map(l => ({
      character: l.character,
      cue_line: l.cue_line,
      shakespeare_line: l.shakespeare_line,
      modern_hint: l.modern_hint,
    })));
  };

  return (
    <SceneContext.Provider
      value={{
        sceneId,
        sceneTitle,
        setSceneId,
        setSceneTitle,
        selectedMode,
        setSelectedMode,
        selectedRole,
        setSelectedRole: handleSetSelectedRole,
        characters,
        setCharacters,
        practiceLines,
        setPracticeLines,
        currentLineIndex,
        setCurrentLineIndex,
        getCurrentLine,
        nextLine,
        prevLine,
        resetProgress,
        hasNextLine: currentLineIndex < filteredLines.length - 1,
        hasPrevLine: currentLineIndex > 0,
        totalLines: filteredLines.length,
        loadFromLineBlocks,
        useSampleScene,
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
