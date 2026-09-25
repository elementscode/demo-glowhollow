import { test, equal } from "@elements/app";
import { completeMention, mentionQuery, mentionedNames, segments } from "#app/shared/services/mentions";

test("mentions", () => {
  test("finds each name once, lowercased, without trailing punctuation", () => {
    equal(mentionedNames("hey @Maya and @maya, thanks @jonas."), ["maya", "jonas"]);
  });

  test("ignores email addresses and single letters", () => {
    equal(mentionedNames("write to maya@campfire.test or @a"), []);
  });

  test("splits a body into text and mention runs", () => {
    let parts = segments("hi @maya, see @theo", "maya").map((s) => [s.text, s.mention, s.isMe]);

    equal(parts, [
      ["hi ", false, false],
      ["@maya", true, true],
      [", see ", false, false],
      ["@theo", true, false],
    ]);
  });

  test("reads the partial name being typed", () => {
    equal(mentionQuery("hello @pr"), "pr");
    equal(mentionQuery("hello @"), "");
    equal(mentionQuery("hello there"), null);
    equal(completeMention("hello @pr", "priya"), "hello @priya ");
  });
});
