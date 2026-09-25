export interface Segment {
  id: string;
  text: string;
  mention: boolean;
  isMe: boolean;
}

const MENTION = /(^|[^A-Za-z0-9_.-])@([A-Za-z0-9_.-]{2,24})/g;

/** Trailing dots and dashes are punctuation: "thanks @maya." mentions maya. */
function trimName(name: string): string {
  return name.replace(/[.-]+$/, "");
}

/** The distinct names a body mentions, lowercased: "@Maya hi @maya" is ["maya"]. */
export function mentionedNames(body: string): string[] {
  let names = new Set<string>();

  for (let match of body.matchAll(MENTION)) {
    let name = trimName(match[2]);

    if (name.length >= 2) {
      names.add(name.toLowerCase());
    }
  }

  return [...names];
}

/** A body split into plain text and @mention runs, for highlighting. */
export function segments(body: string, meName: string): Segment[] {
  let out: Segment[] = [];
  let last = 0;

  for (let match of body.matchAll(MENTION)) {
    let name = trimName(match[2]);

    if (name.length < 2) {
      continue;
    }

    let start = match.index! + match[1].length;

    if (start > last) {
      out.push({ id: `${out.length}`, text: body.slice(last, start), mention: false, isMe: false });
    }

    out.push({
      id: `${out.length}`,
      text: `@${name}`,
      mention: true,
      isMe: name.toLowerCase() === meName.toLowerCase(),
    });

    last = start + 1 + name.length;
  }

  if (last < body.length) {
    out.push({ id: `${out.length}`, text: body.slice(last), mention: false, isMe: false });
  }

  return out;
}

/** The partial name after a trailing "@", or null when the caret isn't in one. */
export function mentionQuery(body: string): string | null {
  let match = /(?:^|\s)@([A-Za-z0-9_.-]*)$/.exec(body);

  return match ? match[1].toLowerCase() : null;
}

export function completeMention(body: string, name: string): string {
  return body.replace(/@([A-Za-z0-9_.-]*)$/, `@${name} `);
}
