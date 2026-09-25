import { test, equal, session, sql } from "@elements/app";
import { signin } from "#app/shared/services/auth";
import { createUser } from "#app/shared/services/fixtures";

function signinError(email: string, password: string): string {
  try {
    signin(email, password);
    return "";
  } catch (err: any) {
    return err.message;
  }
}

test("signin", () => {
  test("signs in with the right password", () => {
    let maya = createUser("maya", "admin");

    equal(signinError("MAYA@test.dev", "password123"), "");
    equal(session.get("userId"), maya.id);
    equal(session.get("userName"), "maya");
    equal(session.get("isAdmin"), true);
  });

  test("gives one message for a wrong email or password", () => {
    createUser("maya");

    equal(signinError("maya@test.dev", "wrong-password"), "That email and password don't match.");
    equal(signinError("nobody@test.dev", "password123"), "That email and password don't match.");
    equal(session.isLoggedIn(), false);
  });

  test("refuses a removed member", () => {
    let theo = createUser("theo");
    sql(`update users set removed = true where id = ${theo.id}`);

    equal(signinError("theo@test.dev", "password123"), "This account has been removed from the community.");
    equal(session.isLoggedIn(), false);
  });
});
