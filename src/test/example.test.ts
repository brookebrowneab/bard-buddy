import { describe, expect, it } from "vitest";
import { getLines, monologues } from "@/data/monologues";
import { normalize, seededShuffle, similarity, splitIntoPhrases } from "@/lib/practice";

describe("fixed monologue practice data", () => {
  it("contains only the two intended monologues", () => {
    expect(monologues.map((monologue) => monologue.id)).toEqual(["cecily", "harriet"]);
    expect(getLines(monologues[0])).toHaveLength(8);
    expect(getLines(monologues[1])).toHaveLength(11);
  });

  it("keeps the supplied Harriet wording", () => {
    const harrietText = getLines(monologues[1]).map((line) => line.text).join(" ");
    expect(harrietText).toContain("every single solitary thing");
    expect(harrietText).toContain("tomato sandwiches and egg creams");
    expect(harrietText).toContain("Secrets by Harriet M. Welsh");
  });
});

describe("practice helpers", () => {
  it("ignores capitalization and punctuation when checking an answer", () => {
    expect(normalize("You silly boy!")).toBe(normalize("you silly boy"));
    expect(similarity("I am a spy with a notebook.", "i am a spy with a notebook")).toBe(1);
  });

  it("creates a deterministic shuffled order", () => {
    expect(seededShuffle([0, 1, 2, 3], 12)).toEqual(seededShuffle([0, 1, 2, 3], 12));
    expect(seededShuffle([0, 1, 2, 3], 12)).not.toEqual([0, 1, 2, 3]);
  });

  it("builds balanced phrase-sized steps before individual words", () => {
    expect(splitIntoPhrases("I am a spy with a notebook.")).toEqual(["I am a spy", "with a notebook."]);
    expect(splitIntoPhrases("You silly boy!")).toEqual(["You silly boy!"]);
    expect(splitIntoPhrases("one two three four five six seven eight nine")).toEqual([
      "one two three",
      "four five six",
      "seven eight nine",
    ]);
  });
});
