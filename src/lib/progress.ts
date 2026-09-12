const emptyProgress = () => [false, false, false, false, false];

export const getProgress = (monologueId: string): boolean[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(`monologue-buddy-${monologueId}`) || "null");
    return Array.isArray(stored) && stored.length === 5 ? stored : emptyProgress();
  } catch {
    return emptyProgress();
  }
};

export const completeGame = (monologueId: string, gameIndex: number) => {
  const progress = getProgress(monologueId);
  progress[gameIndex] = true;
  localStorage.setItem(`monologue-buddy-${monologueId}`, JSON.stringify(progress));
};

