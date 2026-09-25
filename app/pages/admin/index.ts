import { Request, Response, redirect, session } from "@elements/app";
import html from "./template";
import { adminOrThrow } from "#app/shared/services/auth";
import { channelMembers, channels } from "#app/shared/services/chat";
import { listMembers } from "#app/shared/services/members";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let admin = adminOrThrow();

  return new html({
    me: { id: admin.id, displayName: admin.displayName, isAdmin: true },
    channels: channels.view(),
    memberships: channelMembers.view({ userId: admin.id }),
    members: listMembers(),
  });
}
