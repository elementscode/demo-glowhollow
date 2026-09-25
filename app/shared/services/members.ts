import { ForbiddenError, session, sql, tx } from "@elements/app";
import { adminOrThrow } from "#app/shared/services/auth";
import { clearUser } from "#app/shared/services/presence";

export interface MemberRow {
  id: string;
  email: string;
  displayName: string;
  role: "member" | "admin";
  removed: boolean;
  createdAt: Date;
  messageCount: number;
}

export function listMembers(): MemberRow[] {
  return sql<MemberRow>(`
    select u.id,
           u.email,
           u.displayName,
           u.role,
           u.removed,
           u.createdAt,
           (select count(*)::int from messages m where m.userId = u.id) as messageCount
      from users u
     order by u.removed, u.role desc, lower(u.displayName)
  `).all();
}

/**
 * Removes a member from the community: they can't sign in again, their
 * sessions end now, and they drop out of every channel. Their past messages
 * stay, so the history still reads.
 * @rpc
 */
export function removeMember(userId: string): MemberRow[] {
  let admin = adminOrThrow();

  if (userId === admin.id) {
    throw new ForbiddenError("You can't remove yourself.");
  }

  let target = sql<{ role: string }>(`select role from users where id = ${userId}`).firstOrThrow("member not found");

  if (target.role === "admin") {
    throw new ForbiddenError("Admins can't be removed here.");
  }

  tx(() => {
    sql(`update users set removed = true where id = ${userId}`);
    sql(`delete from channelMembers where userId = ${userId}`);
  });

  for (let s of session.findActiveSessions("userId", userId)) {
    session.revoke(s.token);
  }

  clearUser(userId);

  return listMembers();
}
