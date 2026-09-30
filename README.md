![Campfire, a private community chat app built with Elements: the #general channel with messages, an image attachment, emoji reactions, an @mention, unread counts, members online and a typing indicator.](https://elements.dev/demos/01a0db1e-6bb5-7fe0-b637-9a1d9abcc6a6/poster?v=c45cacbde8db)

# Campfire

> A demo app built with [Elements](https://elements.dev).

Channels with unread counts, image attachments, emoji reactions, presence and typing indicators, and @mentions that email offline members, all live.

**Demo:** [Campfire](https://elements.dev/demos/01a0db1e-6bb5-7fe0-b637-9a1d9abcc6a6)

## Agent specs

What one run of the prompt below took, from an empty Elements project to this
app.

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 22 min
- **Cost:** $11.58 at API rates, September 2026

## Get started

```bash
elements create campfire -scaffold=elementscode/demo-campfire
```

## Demo accounts

The seed creates three channels (general, announcements, off-topic) with a
short conversation in each, and four accounts. Every account's password is
`campfire123`, and the sign-in page lists them.

| Email                 | Role   |
| --------------------- | ------ |
| maya@campfire.test    | admin  |
| jonas@campfire.test   | member |
| priya@campfire.test   | member |
| theo@campfire.test    | member |

## The prompt

```text
Build a private chat app named campfire for a small online community.

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
