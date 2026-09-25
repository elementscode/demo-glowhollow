import { Channel, session, sql } from "@elements/app";
import { hostname } from "node:os";

export interface PresenceEvent {
  userId: string;
}

export interface RosterEntry {
  id: string;
  displayName: string;
  role: "member" | "admin";
  online: boolean;
}

export const presence = new Channel<PresenceEvent>("presence");

export function listRoster(): RosterEntry[] {
  return sql<RosterEntry>(`
    select u.id,
           u.displayName,
           u.role,
           exists (select 1 from presence p where p.userId = u.id) as online
      from users u
     where not u.removed
     order by lower(u.displayName)
  `).all();
}

/** @rpc */
export function roster(): RosterEntry[] {
  session.isLoggedInOrThrow();

  return listRoster();
}

export function join(listenerId: string, userId: string, channelId: string) {
  sql(`
    insert into presence (listenerId, userId, channelId, host)
         values (${listenerId}, ${userId}, ${channelId}, ${hostname()})
    on conflict do nothing
  `);

  presence.notify({ userId });
}

export function leave(listenerId: string, userId: string) {
  sql(`delete from presence where listenerId = ${listenerId}`);
  presence.notify({ userId });
}

export function clearUser(userId: string) {
  sql(`delete from presence where userId = ${userId}`);
  presence.notify({ userId });
}

/** Rows this host left behind when it last stopped. */
export function clearThisHost() {
  sql(`delete from presence where host = ${hostname()}`);
}
