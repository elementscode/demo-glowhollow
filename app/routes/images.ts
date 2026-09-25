import { Request, Response, session, sql } from "@elements/app";
import { IMAGE_TYPES } from "#app/shared/services/chat";

interface ImageBytes {
  contentType: string;
  hash: string;
  data: Buffer;
}

const YEAR = 31536000;

/** Attachments are private to the community, so the route checks the session. */
export default function serveImage(req: Request, res: Response) {
  session.isLoggedInOrThrow();

  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
    res.status(404);
    return res.end();
  }

  let img = sql<ImageBytes>(`
    select contentType, hash, data from images where id = ${req.params.id}
  `).firstOrThrow();

  if (req.params.hash !== img.hash) {
    res.status(404);
    return res.end();
  }

  // The declared type came from the uploader, so only an allowlisted image
  // type is ever served inline on our origin.
  if (IMAGE_TYPES.has(img.contentType)) {
    res.setHeader("Content-Type", img.contentType);
  } else {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment");
  }

  res.setHeader("Cache-Control", `private, max-age=${YEAR}, immutable`);

  return img.data;
}
