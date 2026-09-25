import { session, sql } from "@elements/app";

export interface Fixture {
  id: string;
  displayName: string;
}

/** A cheap bcrypt cost keeps fixture users fast; the app itself uses 12. */
export function createUser(displayName: string, role: "member" | "admin" = "member"): Fixture {
  return sql<Fixture>(`
    insert into users (email, passwordHash, displayName, role)
         values (${`${displayName}@test.dev`}, crypt('password123', genSalt('bf', 4)), ${displayName}, ${role})
      returning id, displayName
  `).firstOrThrow();
}

export function createChannel(name: string): string {
  return sql<{ id: string }>(`insert into channels (name) values (${name}) returning id`).firstOrThrow().id;
}

export function loginAs(user: Fixture, isAdmin = false) {
  session.login({ userId: user.id, userName: user.displayName, isAdmin });
}

export function unread(userId: string, channelId: string): number {
  return sql<{ unread: number }>(`
    select unread from channelMembers where userId = ${userId} and channelId = ${channelId}
  `).firstOrThrow().unread;
}

export function mentionJobs(): { to: string }[] {
  return sql<{ to: string }>(`
    select fields->>'to' as "to" from elements.jobs where path like '%send-mention%'
  `).all();
}
