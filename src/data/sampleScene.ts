export interface Line {
  character: string;
  cue_line: string;
  shakespeare_line: string;
  modern_hint: string;
}

export interface Scene {
  title: string;
  raw_text: string;
  characters: string[];
  lines: Line[];
}

// Romeo and Juliet - Balcony Scene (Act 2, Scene 2) - Excerpts
export const sampleScene: Scene = {
  title: "Romeo and Juliet - The Balcony Scene",
  raw_text: `ROMEO: But soft, what light through yonder window breaks?
It is the east, and Juliet is the sun.
Arise, fair sun, and kill the envious moon,
Who is already sick and pale with grief.

JULIET: O Romeo, Romeo! Wherefore art thou Romeo?
Deny thy father and refuse thy name;
Or, if thou wilt not, be but sworn my love,
And I'll no longer be a Capulet.

ROMEO: Shall I hear more, or shall I speak at this?

JULIET: 'Tis but thy name that is my enemy;
Thou art thyself, though not a Montague.
What's Montague? It is nor hand, nor foot,
Nor arm, nor face, nor any other part.

ROMEO: I take thee at thy word:
Call me but love, and I'll be new baptized;
Henceforth I never will be Romeo.

JULIET: What man art thou that, thus bescreened in night,
So stumblest on my counsel?

ROMEO: By a name I know not how to tell thee who I am.
My name, dear saint, is hateful to myself,
Because it is an enemy to thee.

JULIET: My ears have not yet drunk a hundred words
Of that tongue's utterance, yet I know the sound.
Art thou not Romeo, and a Montague?

ROMEO: Neither, fair saint, if either thee dislike.`,
  characters: ["Romeo", "Juliet"],
  lines: [
    {
      character: "Romeo",
      cue_line: "(Romeo sees Juliet appear at her window)",
      shakespeare_line: "But soft, what light through yonder window breaks? It is the east, and Juliet is the sun.",
      modern_hint: "Wait—what's that light? It's Juliet, and she's as beautiful as the sunrise."
    },
    {
      character: "Romeo",
      cue_line: "(Romeo continues, watching Juliet)",
      shakespeare_line: "Arise, fair sun, and kill the envious moon, who is already sick and pale with grief.",
      modern_hint: "Shine bright, Juliet! You outshine the jealous moon."
    },
    {
      character: "Juliet",
      cue_line: "(Juliet sighs, not knowing Romeo is below)",
      shakespeare_line: "O Romeo, Romeo! Wherefore art thou Romeo? Deny thy father and refuse thy name.",
      modern_hint: "Why do you have to be called Romeo? Give up your family name for me."
    },
    {
      character: "Juliet",
      cue_line: "Deny thy father and refuse thy name.",
      shakespeare_line: "Or, if thou wilt not, be but sworn my love, and I'll no longer be a Capulet.",
      modern_hint: "Or if you won't change your name, just promise to love me, and I'll stop being a Capulet."
    },
    {
      character: "Romeo",
      cue_line: "And I'll no longer be a Capulet.",
      shakespeare_line: "Shall I hear more, or shall I speak at this?",
      modern_hint: "Should I keep listening, or should I say something now?"
    },
    {
      character: "Juliet",
      cue_line: "Shall I hear more, or shall I speak at this?",
      shakespeare_line: "'Tis but thy name that is my enemy; thou art thyself, though not a Montague.",
      modern_hint: "It's only your name that's my enemy—you're still you even without it."
    },
    {
      character: "Juliet",
      cue_line: "Thou art thyself, though not a Montague.",
      shakespeare_line: "What's Montague? It is nor hand, nor foot, nor arm, nor face, nor any other part.",
      modern_hint: "What is 'Montague' anyway? It's not a body part—it's just a name."
    },
    {
      character: "Romeo",
      cue_line: "Nor arm, nor face, nor any other part.",
      shakespeare_line: "I take thee at thy word: call me but love, and I'll be new baptized; henceforth I never will be Romeo.",
      modern_hint: "I believe you! Just call me your love, and I'll take a new name. I won't be Romeo anymore."
    },
    {
      character: "Juliet",
      cue_line: "Henceforth I never will be Romeo.",
      shakespeare_line: "What man art thou that, thus bescreened in night, so stumblest on my counsel?",
      modern_hint: "Who are you, hiding in the dark and listening to my private thoughts?"
    },
    {
      character: "Romeo",
      cue_line: "So stumblest on my counsel?",
      shakespeare_line: "By a name I know not how to tell thee who I am. My name, dear saint, is hateful to myself.",
      modern_hint: "I don't know how to say my name—I hate it because it makes me your enemy."
    },
    {
      character: "Romeo",
      cue_line: "My name, dear saint, is hateful to myself.",
      shakespeare_line: "Because it is an enemy to thee.",
      modern_hint: "Because my name is your family's enemy."
    },
    {
      character: "Juliet",
      cue_line: "Because it is an enemy to thee.",
      shakespeare_line: "My ears have not yet drunk a hundred words of that tongue's utterance, yet I know the sound.",
      modern_hint: "I've barely heard you speak, but I already recognize your voice."
    },
    {
      character: "Juliet",
      cue_line: "Yet I know the sound.",
      shakespeare_line: "Art thou not Romeo, and a Montague?",
      modern_hint: "Aren't you Romeo? A Montague?"
    },
    {
      character: "Romeo",
      cue_line: "Art thou not Romeo, and a Montague?",
      shakespeare_line: "Neither, fair saint, if either thee dislike.",
      modern_hint: "I'll be neither if you don't like those names."
    }
  ]
};

export const getCharacterLines = (scene: Scene, character: string): Line[] => {
  return scene.lines.filter(line => line.character === character);
};
