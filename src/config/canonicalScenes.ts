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

// Suspicious block heuristics (no AI needed)
export interface SuspiciousReason {
  code: string;
  label: string;
  check: (block: { text_raw: string; speaker_name: string | null; translation?: { status: string; translation_text: string | null } }) => boolean;
}

const SPEAKER_PATTERNS = [
  /^[A-Z]{2,}[A-Z\s]+$/m, // ALL CAPS NAMES
  /^(DON PEDRO|BENEDICK|BEATRICE|LEONATO|CLAUDIO|HERO|DON JOHN|BORACHIO|MARGARET|URSULA|CONRADE|DOGBERRY|VERGES|ANTONIO|BALTHASAR|FRIAR FRANCIS|SEXTON|FIRST WATCHMAN|SECOND WATCHMAN|MESSENGER)/im,
];

export const SUSPICIOUS_HEURISTICS: SuspiciousReason[] = [
  {
    code: 'mega_block',
    label: 'Mega block (>400 chars)',
    check: (block) => block.text_raw.length > 400,
  },
  {
    code: 'multi_speaker',
    label: 'Multiple speakers in text',
    check: (block) => {
      const lines = block.text_raw.split('\n');
      let speakerCount = 0;
      for (const line of lines) {
        for (const pattern of SPEAKER_PATTERNS) {
          if (pattern.test(line.trim())) {
            speakerCount++;
            if (speakerCount > 1) return true;
          }
        }
      }
      return false;
    },
  },
  {
    code: 'null_speaker',
    label: 'Missing speaker',
    check: (block) => !block.speaker_name || block.speaker_name.trim() === '',
  },
  {
    code: 'empty_translation',
    label: 'Complete but empty',
    check: (block) => 
      block.translation?.status === 'complete' && 
      (!block.translation.translation_text || block.translation.translation_text.trim() === ''),
  },
];

export function getSuspiciousReasons(block: Parameters<SuspiciousReason['check']>[0]): string[] {
  return SUSPICIOUS_HEURISTICS
    .filter(h => h.check(block))
    .map(h => h.label);
}
