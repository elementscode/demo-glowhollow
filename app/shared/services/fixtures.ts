import { session, sql } from "@elements/app";

export interface Fixture {
  id: string;
  email: string;
  displayName: string;
}

export interface ChannelFixture {
  id: string;
  name: string;
}

/**
 * A suffix per call keeps fixture names clear of the seeded community and of
 * test files running at the same time against the same unique indexes.
 */
export function uniqueName(base: string): string {
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/** A cheap bcrypt cost keeps fixture users fast; the app itself uses 12. */
export function createUser(displayName: string, role: "member" | "admin" = "member"): Fixture {
  let name = uniqueName(displayName);

  return sql<Fixture>(`
    insert into users (email, passwordHash, displayName, role)
         values (${`${name}@test.dev`}, crypt('password123', genSalt('bf', 4)), ${name}, ${role})
      returning id, email, displayName
  `).firstOrThrow();
}

export function createChannel(name: string): ChannelFixture {
  return sql<ChannelFixture>(`
    insert into channels (name) values (${uniqueName(name)}) returning id, name
  `).firstOrThrow();
}

export function loginAs(user: Fixture, isAdmin = false) {
  session.login({ userId: user.id, userName: user.displayName, isAdmin });
}

export function unread(userId: string, channelId: string): number {
  return sql<{ unread: number }>(`
    select unread from channelMembers where userId = ${userId} and channelId = ${channelId}
  `).firstOrThrow().unread;
}

/** Mention emails queued for the given fixture users only, never anyone else's. */
export function mentionJobs(users: Fixture[]): { to: string }[] {
  let emails = users.map((u) => u.email);

  return sql<{ to: string }>(`
    select fields->>'to' as "to" from elements.jobs where path like '%send-mention%'
  `).all().filter((j) => emails.includes(j.to));
}
