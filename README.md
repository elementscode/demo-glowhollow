![Glowhollow, a private community chat app built with Elements: the #general channel with messages, an image attachment, emoji reactions, an @mention, unread counts, members online and a typing indicator.](https://elements.dev/demos/01a0db1e-6bb5-7fe0-b637-9a1d9abcc6a6/poster?v=a3510b378c1e)

# Glowhollow

> A demo app built with [Elements](https://elements.dev).

Channels with unread counts, image attachments, emoji reactions, presence and typing indicators, and @mentions that email offline members, all live.

**Demo:** [Glowhollow](https://elements.dev/demos/01a0db1e-6bb5-7fe0-b637-9a1d9abcc6a6)

## Agent specs

What one run of the prompt below took, from an empty Elements project to this
app.

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 22 min
- **Cost:** $11.58 at API rates, September 2026

## Get started

```bash
elements create glowhollow -scaffold=elementscode/demo-glowhollow
```

## How it's built

Glowhollow needed messages that arrive in every open window, unread counts per channel, reactions, image attachments, presence and typing indicators, and email for mentions when someone is away. Each of those is a part of Elements, so the agent spent its 22 minutes on the community itself.

### What Elements gave the app

- **Live channels and messages.** Channels, memberships and messages are LiveTables. A message appears for everyone in the channel, and a database trigger raises the unread count for every other member, so the sidebar badges move as people talk.
- **Reactions in the message row.** Reacting calls an `@rpc`, and a trigger folds the reaction into its message, so the change reaches every open copy of it.
- **Presence and typing.** A presence channel records each open window and clears it a few seconds after the window closes, which drives the online roster. A typing channel carries "is typing" pings between members of the same channel.
- **Mentions by email.** When a message @mentions someone with no open window, a background job emails them the message.
- **Image attachments.** An rpc takes the attachment as a `File`, checks its type and size, and stores it, and a route serves it under its content hash.
- **Sessions and roles.** Admins create and archive channels, and removing a member ends every active session they have at once. Three migrations define the schema and seed one admin, three members and three channels with a conversation in each.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 24 tests pass. Every page works on desktop and phone, and live updates arrive across tabs, such as new messages, reactions, unread counts and who is typing.

## Demo accounts

The seed creates three channels (general, announcements, off-topic) with a
short conversation in each, and four accounts. Every account's password is
`glowhollow123`, and the sign-in page lists them.

| Email                 | Role   |
| --------------------- | ------ |
| maya@glowhollow.test    | admin  |
| jonas@glowhollow.test   | member |
| priya@glowhollow.test   | member |
| theo@glowhollow.test    | member |

## The prompt

```text
Build a private chat app named glowhollow for a small online community.

Two kinds of accounts: member and admin. Anyone can sign up with an email and
password. No ID or phone verification.

MEMBER
- Sign up, log in, pick a display name.
- Sidebar of channels with unread counts.
- Open a channel to read and post messages.
- Attach an image to a message.
- React to a message with an emoji.
- See who is online in the channel and who is typing.
- Mention someone with @name. A mentioned member who is offline gets an email.

ADMIN
- Create, rename and archive channels.
- Delete any message.
- Remove a member.

Seed one admin, three members, three channels (general, announcements,
off-topic) and a short conversation in each. Show the seeded logins on the
sign-in page.

Messages, reactions, unread counts, presence and typing all update in real time.
```

## License

MIT. See [LICENSE](LICENSE).
