import { test, equal, sql } from "@elements/app";
import { channels } from "#app/shared/services/chat";
import { removeMember } from "#app/shared/services/members";
import { createChannel, createUser, loginAs } from "#app/shared/services/fixtures";

async function errorOf(fn: () => unknown | Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "";
  } catch (err: any) {
    return err.message;
  }
}

test("admin", async () => {
  let maya = createUser("maya", "admin");
  let jonas = createUser("jonas");

  test("only an admin can create a channel, and it takes in every member", async () => {
    loginAs(jonas);
    equal(await errorOf(() => channels.view().insert({ name: "sneaky", topic: "" })), "Only admins can do that.");

    loginAs(maya, true);
    let books = channels.view().insert({ name: "books", topic: "Monthly reads" });

    let members = sql<{ n: number }>(`select count(*)::int as n from channelMembers where channelId = ${books.id}`).firstOrThrow();
    equal(members.n, 2);
  });

  test("channel names are validated and unique", async () => {
    createChannel("general");
    loginAs(maya, true);

    equal(await errorOf(() => channels.view().insert({ name: "General", topic: "" })), "#general already exists.");
    equal((await errorOf(() => channels.view().insert({ name: "no spaces", topic: "" }))).includes("lowercase letters"), true);
  });

  test("rename and archive", async () => {
    let id = createChannel("random");
    loginAs(maya, true);

    let view = channels.view();
    let row = view.find((c) => c.id === id)!;
    let renamed = view.update({ ...row, name: "off-topic", topic: "Anything goes" });
    view.update({ ...renamed, archived: true });

    let saved = sql<{ name: string; topic: string; archived: boolean }>(`
      select name, topic, archived from channels where id = ${id}
    `).firstOrThrow();

    equal(saved, { name: "off-topic", topic: "Anything goes", archived: true });

    loginAs(jonas);
    let mine = channels.view();
    equal(await errorOf(() => mine.update({ ...mine.find((c) => c.id === id)!, archived: false })), "Only admins can do that.");
  });

  test("removing a member blocks them and drops their memberships", async () => {
    createChannel("general");
    loginAs(maya, true);

    let list = removeMember(jonas.id);

    equal(list.find((m) => m.id === jonas.id)?.removed, true);
    equal(sql(`select 1 from channelMembers where userId = ${jonas.id}`).empty(), true);
  });

  test("admins can't be removed, and members can't remove anyone", async () => {
    loginAs(maya, true);
    equal(await errorOf(() => removeMember(maya.id)), "You can't remove yourself.");

    loginAs(jonas);
    equal(await errorOf(() => removeMember(maya.id)), "Only admins can do that.");
  });
});
