import { describe, expect, it } from "vitest";
import { parseEmojiTestData } from "@/lib/utilities/emoji-test-parser";

describe("parseEmojiTestData", () => {
  it("parses fully-qualified emoji lines", () => {
    const raw = [
      "# group: Smileys & Emotion",
      "# subgroup: face-smiling",
      "1F600                                                  ; fully-qualified     # 😀 E1.0 grinning face",
      "263A                                                   ; unqualified         # ☺ E0.6 smiling face",
      "1F603                                                  ; fully-qualified     # 😃 E0.6 grinning face with big eyes",
    ].join("\n");

    const parsed = parseEmojiTestData(raw);

    expect(parsed.map((entry) => entry.value)).toEqual(["😀", "😃"]);
    expect(parsed[0]?.label).toBe("grinning face");
    expect(parsed[0]?.tags).toContain("smiling");
    expect(parsed[1]?.tags).toContain("big");
  });

  it("returns an empty array for invalid content", () => {
    expect(parseEmojiTestData("not a valid emoji file")).toEqual([]);
  });
});
