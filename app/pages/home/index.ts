import { Request, Response, redirect, session, sql } from "@elements/app";

/** Home is the first open channel, or the sign-in page for a visitor. */
export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let first = sql<{ id: string }>(`
    select id from channels where not archived order by createdAt limit 1
  `).first();

  redirect(first ? `/c/${first.id}` : "/admin");
}
