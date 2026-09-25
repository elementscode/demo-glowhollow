import { Request, Response, NotFoundError, redirect, session, sql } from "@elements/app";
import html from "./template";
import { activeUserOrThrow } from "#app/shared/services/auth";
import { ChannelMember, channelMembers, channels, isMemberOrThrow, messages, typing } from "#app/shared/services/chat";
import { join, leave, listRoster, presence } from "#app/shared/services/presence";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let me = activeUserOrThrow();
  let channelId = req.params.id;

  if (!/^[0-9a-f-]{36}$/i.test(channelId)) {
    throw new NotFoundError("channel not found");
  }

  sql(`select 1 from channels where id = ${channelId}`).firstOrThrow("channel not found");
  isMemberOrThrow(channelId);

  // Read before the page marks it read, to place the "new messages" line.
  let membership = sql<ChannelMember>(`
    select id, userId, channelId, lastReadAt, unread
      from channelMembers
     where userId = ${me.id} and channelId = ${channelId}
  `).firstOrThrow();

  // Listen before reading the roster, so a join in between still arrives.
  let presenceListener = presence.listen()
    .on("connect", (l) => join(l.id, me.id, channelId))
    .on("disconnect", (l) => setTimeout(() => leave(l.id, me.id), 3000));

  return new html({
    channelId,
    me: { id: me.id, displayName: me.displayName, isAdmin: me.role === "admin" },
    readMarker: membership.unread > 0 ? { from: membership.lastReadAt, to: new Date() } : null,
    channels: channels.view(),
    memberships: channelMembers.view({ userId: me.id }),
    messages: messages.view({ channelId }, { orderBy: "createdAt desc", limit: 50 }),
    typing: typing.listen({ filter: (p) => p.channelId === channelId && p.userId !== me.id }),
    presence: presenceListener,
    people: listRoster(),
  });
}
