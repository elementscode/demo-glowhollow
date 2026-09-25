import { sql, session, AuthError, ForbiddenError, SqlError } from "@elements/app";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "member" | "admin";
  removed: boolean;
}

export interface SignupForm {
  email: string;
  password: string;
  displayName: string;
}

export const MIN_PASSWORD = 8;

/** Display names are what an @mention matches, so they are handle-shaped. */
export const DISPLAY_NAME = /^[A-Za-z0-9_.-]{2,24}$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function loginAs(user: User) {
  session.login({
    userId: user.id,
    userName: user.displayName,
    isAdmin: user.role === "admin",
  });
}

/** @rpc */
export function signin(email: string, password: string) {
  let address = normalizeEmail(email);

  if (!address || !password) {
    throw new AuthError("Enter your email and password.");
  }

  let user = sql<User>(`
    select id, email, displayName, role, removed
      from users
     where email = ${address}
       and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!user) {
    throw new AuthError("That email and password don't match.");
  }

  if (user.removed) {
    throw new AuthError("This account has been removed from the community.");
  }

  loginAs(user);
}

/** @rpc */
export function signup(form: SignupForm) {
  let address = normalizeEmail(form.email);
  let displayName = form.displayName.trim();

  if (!isEmail(address)) {
    throw new AuthError("Enter a valid email address.");
  }

  if (!DISPLAY_NAME.test(displayName)) {
    throw new AuthError("Display names are 2–24 letters, numbers, dots, dashes or underscores.");
  }

  if (form.password.length < MIN_PASSWORD) {
    throw new AuthError(`Passwords need at least ${MIN_PASSWORD} characters.`);
  }

  if (!sql(`select 1 from users where email = ${address}`).empty()) {
    throw new AuthError("That email is already registered.");
  }

  if (!sql(`select 1 from users where lower(displayName) = lower(${displayName})`).empty()) {
    throw new AuthError(`@${displayName} is taken. Try another display name.`);
  }

  let user: User;

  try {
    user = sql<User>(`
      insert into users (email, passwordHash, displayName)
           values (${address}, crypt(${form.password}, genSalt('bf', 12)), ${displayName})
        returning id, email, displayName, role, removed
    `).firstOrThrow();
  } catch (err) {
    if (err instanceof SqlError) {
      throw new AuthError("That email or display name was just taken. Try another.");
    }

    throw err;
  }

  loginAs(user);
}

/** @rpc */
export function signout() {
  session.logout();
}

/** The signed-in user, re-read so a removal takes effect on the next write. */
export function activeUserOrThrow(): User {
  session.isLoggedInOrThrow();

  let user = sql<User>(`
    select id, email, displayName, role, removed
      from users
     where id = ${session.getOrThrow("userId")}
  `).first();

  if (!user || user.removed) {
    throw new AuthError("Your account is no longer active.");
  }

  return user;
}

export function adminOrThrow(): User {
  let user = activeUserOrThrow();

  if (user.role !== "admin") {
    throw new ForbiddenError("Only admins can do that.");
  }

  return user;
}
