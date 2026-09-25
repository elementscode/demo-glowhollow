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
    messages.view({ channelId: general }).insert({ body: "hello campfire" });

    equal(unread(jonas.id, general), 0);
    equal(unread(maya.id, general), 1);
    equal(unread(priya.id, general), 1);

    let row = sql<{ userName: string; body: string }>(`
      select userName, body from messages where channelId = ${general}
    `).firstOrThrow();

    equal(row.userName, "jonas");
    equal(row.body, "hello campfire");
  });

  test("the author comes from the session, not the payload", async () => {
    loginAs(jonas);
    messages.view({ channelId: general }).insert({ body: "hi", userId: maya.id, userName: "maya" });

    let row = sql<{ userId: string; userName: string }>(`select userId, userName from messages`).firstOrThrow();
    equal(row.userId, jonas.id);
    equal(row.userName, "jonas");
  });

  test("marking read resets only your own count", async () => {
    loginAs(jonas);
    messages.view({ channelId: general }).insert({ body: "one" });

    loginAs(priya);
    let mine = channelMembers.view({ userId: priya.id });
    let row = mine.find((m) => m.channelId === general)!;
    mine.update({ ...row, unread: 0 });

    equal(unread(priya.id, general), 0);
    equal(unread(maya.id, general), 1);
  });

  test("an offline member who is mentioned gets an email, an online one does not", async () => {
    sql(`insert into presence (listenerId, userId, host) values ('tab-1', ${priya.id}, 'test')`);

    loginAs(jonas);
    messages.view({ channelId: general }).insert({ body: "@maya and @priya, lunch? also @jonas and @nobody" });

    equal(mentionJobs().map((j) => j.to), ["maya@test.dev"]);
  });

  test("an archived channel is read-only", async () => {
    sql(`update channels set archived = true where id = ${general}`);
    loginAs(jonas);

    equal(await errorOf(() => messages.view({ channelId: general }).insert({ body: "anyone?" })), "#general is archived, so it's read-only.");
  });

  test("an empty message is refused", async () => {
    loginAs(jonas);

    equal(await errorOf(() => messages.view({ channelId: general }).insert({ body: "   " })), "Write a message or attach an image.");
  });

  test("reactions toggle and fold into the message", async () => {
    loginAs(jonas);
    let msg = messages.view({ channelId: general }).insert({ body: "react to me" });

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
    let msg = messages.view({ channelId: general }).insert({ body: "oops" });
    equal(unread(priya.id, general), 1);

    loginAs(priya);
    equal(await errorOf(() => messages.view({ channelId: general }).delete(msg)), "Only admins can do that.");

    loginAs(maya, true);
    messages.view({ channelId: general }).delete(msg);

    equal(sql(`select 1 from messages where id = ${msg.id}`).empty(), true);
    equal(unread(priya.id, general), 0);
  });

  test("messages can't be edited", async () => {
    loginAs(jonas);
    let view = messages.view({ channelId: general });
    let msg = view.insert({ body: "first draft" });

    equal(await errorOf(() => view.update({ ...msg, body: "rewritten" })), "Messages can't be edited.");
  });
});
