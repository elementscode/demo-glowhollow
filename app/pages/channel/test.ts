import { test, equal, errorf, sql } from "@elements/app";
import { channelMembers, messages, toggleReaction } from "#app/shared/services/chat";
import { createChannel, createUser, loginAs, mentionJobs, unread } from "#app/shared/services/fixtures";

async function errorOf(fn: () => unknown | Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "";
  } catch (err: any) {
    return err.message;
  }
}

test("channel", async () => {
  let maya = createUser("maya", "admin");
  let jonas = createUser("jonas");
  let priya = createUser("priya");
  let general = createChannel("general");

  test("a message is unread for everyone but its author", async () => {
    loginAs(jonas);
    let msg = messages.view({ channelId: general.id }).insert({ body: "hello glowhollow" });

    equal(unread(jonas.id, general.id), 0);
    equal(unread(maya.id, general.id), 1);
    equal(unread(priya.id, general.id), 1);

    let row = sql<{ userName: string; body: string }>(`
      select userName, body from messages where id = ${msg.id}
    `).firstOrThrow();

    equal(row.userName, jonas.displayName);
    equal(row.body, "hello glowhollow");
  });

  test("the author comes from the session, not the payload", async () => {
    loginAs(jonas);
    let msg = messages.view({ channelId: general.id }).insert({ body: "hi", userId: maya.id, userName: maya.displayName });

    let row = sql<{ userId: string; userName: string }>(`select userId, userName from messages where id = ${msg.id}`).firstOrThrow();
    equal(row.userId, jonas.id);
    equal(row.userName, jonas.displayName);
  });

  test("marking read resets only your own count", async () => {
    loginAs(jonas);
    messages.view({ channelId: general.id }).insert({ body: "one" });

    loginAs(priya);
    let mine = channelMembers.view({ userId: priya.id });
    let row = mine.find((m) => m.channelId === general.id)!;
    mine.update({ ...row, unread: 0 });

    equal(unread(priya.id, general.id), 0);
    equal(unread(maya.id, general.id), 1);
  });

  test("an offline member who is mentioned gets an email, an online one does not", async () => {
    sql(`insert into presence (listenerId, userId, host) values (${`tab-${priya.id}`}, ${priya.id}, 'test')`);

    loginAs(jonas);
    messages.view({ channelId: general.id }).insert({
      body: `@${maya.displayName} and @${priya.displayName}, lunch? also @${jonas.displayName} and @nobody`,
    });

    equal(mentionJobs([maya, jonas, priya]).map((j) => j.to), [maya.email]);
  });

  test("an archived channel is read-only", async () => {
    sql(`update channels set archived = true where id = ${general.id}`);
    loginAs(jonas);

    equal(await errorOf(() => messages.view({ channelId: general.id }).insert({ body: "anyone?" })), `#${general.name} is archived, so it's read-only.`);
  });

  test("an empty message is refused", async () => {
    loginAs(jonas);

    equal(await errorOf(() => messages.view({ channelId: general.id }).insert({ body: "   " })), "Write a message or attach an image.");
  });

  test("reactions toggle and fold into the message", async () => {
    loginAs(jonas);
    let msg = messages.view({ channelId: general.id }).insert({ body: "react to me" });

    loginAs(priya);
    toggleReaction(msg.id, "🔥");
    loginAs(maya);
    toggleReaction(msg.id, "🔥");

    let reactions = () => sql<{ reactions: Record<string, string[]> }>(`
      select reactions from messages where id = ${msg.id}
    `).firstOrThrow().reactions;

    equal(reactions()["🔥"].length, 2);

    toggleReaction(msg.id, "🔥");
    equal(reactions()["🔥"], [priya.id]);

    if (!(await errorOf(() => toggleReaction(msg.id, "🍕"))).includes("listed reactions")) {
      errorf("expected an unlisted emoji to be refused");
    }
  });

  test("only an admin can delete, and a deleted message stops counting", async () => {
    loginAs(jonas);
    let msg = messages.view({ channelId: general.id }).insert({ body: "oops" });
    equal(unread(priya.id, general.id), 1);

    loginAs(priya);
    equal(await errorOf(() => messages.view({ channelId: general.id }).delete(msg)), "Only admins can do that.");

    loginAs(maya, true);
    messages.view({ channelId: general.id }).delete(msg);

    equal(sql(`select 1 from messages where id = ${msg.id}`).empty(), true);
    equal(unread(priya.id, general.id), 0);
  });

  test("messages can't be edited", async () => {
    loginAs(jonas);
    let view = messages.view({ channelId: general.id });
    let msg = view.insert({ body: "first draft" });

    equal(await errorOf(() => view.update({ ...msg, body: "rewritten" })), "Messages can't be edited.");
  });
});
