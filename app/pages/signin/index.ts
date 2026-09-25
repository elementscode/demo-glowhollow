import { Request, Response, redirect, session } from "@elements/app";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (session.isLoggedIn()) {
    redirect("/");
    return;
  }

  // The seeded accounts only exist in development (see the seed migration).
  return new html({ showDemoLogins: process.env.ENV === "development" });
}
