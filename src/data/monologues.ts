export type ThoughtBeat = {
  title: string;
  meaning: string;
  action: string;
  lines: string[];
};

export type Monologue = {
  id: "cecily" | "harriet";
  title: string;
  character: string;
  author: string;
  label: string;
  startCue: string;
  beats: ThoughtBeat[];
};

export const monologues: Monologue[] = [
  {
    id: "cecily",
    title: "The Importance of Being Earnest",
    character: "Cecily",
    author: "Oscar Wilde",
    label: "The imagined engagement",
    startCue: "ALGERNON: I love you, Cecily. You will marry me, won't you?",
    beats: [
      {
        title: "We are already engaged",
        meaning: "Cecily teases Ernest and announces that, in her imagination, their romance is already official.",
        action: "Tease, then declare",
        lines: [
          "You silly boy! Why, we have been engaged for the last three months.",
          "It will be exactly three months on Thursday.",
        ],
      },
      {
        title: "The mystery was irresistible",
        meaning: "Uncle Jack's warnings only made the mysterious, supposedly wicked Ernest more fascinating.",
        action: "Explain, then savor",
        lines: [
          "Ever since dear Uncle Jack first confessed to us that he had a younger brother who was very wicked and bad, you of course have formed the chief topic of conversation between myself and Miss Prism.",
          "And of course a man who is much talked about is always very attractive.",
          "One feels there must be something in him, after all.",
          "I daresay it was foolish of me, but I fell in love with you, Ernest.",
        ],
      },
      {
        title: "I decided for both of us",
        meaning: "Tired of waiting for someone who did not know her, Cecily took charge and accepted him on his behalf.",
        action: "Confide, then triumph",
        lines: [
          "The engagement was actually settled on the 14th of February last.",
          "Worn out by your entire ignorance of my existence, I determined to end the matter one way or the other, and after a long struggle with myself I accepted you under this dear old tree here.",
        ],
      },
    ],
  },
  {
    id: "harriet",
    title: "Harriet the Spy",
    character: "Harriet M. Welsh",
    author: "Louise Fitzhugh",
    label: "The notebook speech",
    startCue: "Start of monologue — take a breath and begin.",
    beats: [
      {
        title: "This is who I am",
        meaning: "Harriet declares her identity and her rule: a real spy notices and records absolutely everything.",
        action: "Plant your flag",
        lines: [
          "I am a spy with a notebook.",
          "I am a spy that writes everything down, every single solitary thing that happens to me.",
        ],
      },
      {
        title: "Ole Golly understands",
        meaning: "Harriet feels seen by the one adult who knows why writing matters to her.",
        action: "Share a secret",
        lines: [
          "Only nurse Ole Golly understands about my notebook, she says description is good for the soul and clears the brain like a laxative.",
        ],
      },
      {
        title: "Nobody can catch me",
        meaning: "She celebrates her spotless spy record with a quick burst of victory.",
        action: "Boast, then burst",
        lines: [
          "I am a good spy who has never been caught.",
          "Yeah!",
        ],
      },
      {
        title: "Picture the fame",
        meaning: "Harriet races ahead to a future where writing makes her famous—and earns her favorite foods.",
        action: "Dream bigger",
        lines: [
          "When I grow up I will be a famous writer and people will bow to me in the streets and shower me with tomato sandwiches and egg creams where ever I go...",
        ],
      },
      {
        title: "A spy checks everything",
        meaning: "Even in the middle of a fantasy, her curious reporter brain stops to verify a detail.",
        action: "Wonder, then investigate",
        lines: [
          "Do they have tomato sandwiches everywhere?",
          "Check on that...",
        ],
      },
      {
        title: "The great book plan",
        meaning: "She reveals the ultimate mission: uncover everyone's secrets and publish the complete evidence.",
        action: "Promise, then specify",
        lines: [
          "And I'll find out everything about everybody and put it all in a book.",
          "The book is going to be called Secrets by Harriet M. Welsh.",
          "I will also have photographs in it and maybe some medical charts if I can get them.",
        ],
      },
    ],
  },
];

export const getMonologue = (id: string | undefined) =>
  monologues.find((monologue) => monologue.id === id);

export const getLines = (monologue: Monologue) =>
  monologue.beats.flatMap((beat, beatIndex) =>
    beat.lines.map((text) => ({ text, beatIndex, beatTitle: beat.title }))
  );

