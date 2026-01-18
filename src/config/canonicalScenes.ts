// Canonical scene configuration
// These are the "source of truth" scenes that contain properly imported scripts with translations.
// Duplicate or partial imports should not be used for translation work.

export const CANONICAL_SCENE_IDS = [
  "50a7da57-4f4d-4671-b9ca-f32f8c1cc42e", // Much Ado About Nothing - Full script with translations
] as const;

export const CANONICAL_SCENE_ID = CANONICAL_SCENE_IDS[0];

export function isCanonicalScene(sceneId: string): boolean {
  return CANONICAL_SCENE_IDS.includes(sceneId as any);
}

export function getSceneLabel(sceneId: string, title: string): string {
  if (isCanonicalScene(sceneId)) {
    return `${title} (Canonical)`;
  }
  return `${title} (Duplicate / Import Artifact)`;
}

export const DUPLICATE_SCENE_WARNING = 
  "⚠️ This is a duplicate import. Translations will not appear in the student app. " +
  "Please use the canonical scene for translation work.";
