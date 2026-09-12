export const tokenize = (text: string) => text.trim().split(/\s+/).filter(Boolean);

export const splitIntoPhrases = (text: string, targetWords = 4) => {
  const words = tokenize(text);
  if (words.length <= targetWords + 1) return [words.join(" ")];

  const phraseCount = Math.ceil(words.length / targetWords);
  const smallestPhrase = Math.floor(words.length / phraseCount);
  const longerPhrases = words.length % phraseCount;
  const phrases: string[] = [];
  let start = 0;

  for (let index = 0; index < phraseCount; index += 1) {
    const phraseLength = smallestPhrase + (index < longerPhrases ? 1 : 0);
    phrases.push(words.slice(start, start + phraseLength).join(" "));
    start += phraseLength;
  }

  return phrases;
};

export const normalize = (text: string) =>
  tokenize(text)
    .map((word) => word.toLowerCase().replace(/[“”‘’']/g, "'").replace(/[^a-z0-9']/g, ""))
    .filter(Boolean)
    .join(" ");

export const seededShuffle = <T,>(items: T[], seed: number) => {
  const shuffled = [...items];
  let value = seed + 31;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const swapIndex = Math.floor((value / 233280) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled.every((item, index) => item === items[index])) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
};

export const similarity = (expected: string, actual: string) => {
  const expectedWords = normalize(expected).split(" ").filter(Boolean);
  const actualWords = normalize(actual).split(" ").filter(Boolean);
  const table = Array.from({ length: expectedWords.length + 1 }, () =>
    Array(actualWords.length + 1).fill(0)
  );

  for (let row = 1; row <= expectedWords.length; row += 1) {
    for (let column = 1; column <= actualWords.length; column += 1) {
      table[row][column] = expectedWords[row - 1] === actualWords[column - 1]
        ? table[row - 1][column - 1] + 1
        : Math.max(table[row - 1][column], table[row][column - 1]);
    }
  }

  return expectedWords.length ? table[expectedWords.length][actualWords.length] / expectedWords.length : 1;
};
