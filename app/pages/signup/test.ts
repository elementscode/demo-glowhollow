import { test, equal, errorf, session, sql } from "@elements/app";
import { signup } from "#app/shared/services/auth";
import { createChannel, uniqueName } from "#app/shared/services/fixtures";

function signupError(form: { email: string; password: string; displayName: string }): string {
  try {
    signup(form);
    return "";
  } catch (err: any) {
    return err.message;
  }
}

test("signup", () => {
  test("creates a member, signs them in and joins every channel", () => {
    let general = createChannel("general");
    let random = createChannel("random");

    let ada = uniqueName("ada");
    signup({ email: ` ${ada.toUpperCase()}@Example.com `, password: "longenough", displayName: ada });

    let user = sql<{ id: string; email: string; role: string }>(`
      select id, email, role from users where displayName = ${ada}
    `).firstOrThrow();

    equal(user.email, `${ada}@example.com`);
    equal(user.role, "member");
    equal(session.get("userId"), user.id);
    equal(session.get("isAdmin"), false);

    let joined = sql<{ channelId: string }>(`
      select channelId from channelMembers where userId = ${user.id} order by channelId
    `).all().map((r) => r.channelId).sort();

    let notJoined = sql(`
      select 1 from channels c
       where not exists (select 1 from channelMembers m where m.channelId = c.id and m.userId = ${user.id})
    `);

    equal(notJoined.empty(), true);
    equal(joined.includes(general.id) && joined.includes(random.id), true);
  });

  test("rejects a taken email or display name", () => {
    let ada = uniqueName("ada");
    signup({ email: `${ada}@example.com`, password: "longenough", displayName: ada });

    equal(signupError({ email: `${ada.toUpperCase()}@example.com`, password: "longenough", displayName: uniqueName("ada2") }), "That email is already registered.");
    equal(signupError({ email: `${uniqueName("other")}@example.com`, password: "longenough", displayName: ada.toUpperCase() }), `@${ada.toUpperCase()} is taken. Try another display name.`);
  });

  test("validates the form", () => {
    if (!signupError({ email: "nope", password: "longenough", displayName: "bob" }).includes("valid email")) {
      errorf("expected an email error");
    }

    if (!signupError({ email: "bob@x.com", password: "short", displayName: "bob" }).includes("8 characters")) {
      errorf("expected a password length error");
    }

    if (!signupError({ email: "bob@x.com", password: "longenough", displayName: "bob smith" }).includes("Display names")) {
      errorf("expected a display name error");
    }
  });
});
