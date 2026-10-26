![A chat app with channels and presence, built by Claude Code on Elements: the #general channel with messages, an image attachment, emoji reactions, an @mention, unread counts, members online and a typing indicator.](https://elements.dev/demos/01a0db1e-6bb5-7fe0-b637-9a1d9abcc6a6/poster?v=a3510b378c1e)

# A chat app with channels and presence, built by Claude Code on Elements

> Glowhollow is a full-stack app built with Claude Code on Elements.

Channels with unread counts, image attachments, emoji reactions, presence and typing indicators, and @mentions that email offline members, all live.

[Run this app on your machine](https://elements.dev/demos/01a0db1e-6bb5-7fe0-b637-9a1d9abcc6a6). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## How it's built

Glowhollow needed messages that arrive in every open window, unread counts per channel, reactions, image attachments, presence and typing indicators, and email for mentions when someone is away. Each of those is a part of Elements, so the agent spent its 22 minutes on the community itself.

- **Live channels and messages.** Channels, memberships and messages are LiveTables. A message appears for everyone in the channel, and a database trigger raises the unread count for every other member, so the sidebar badges move as people talk.

- **Reactions in the message row.** Reacting calls an `@rpc`, and a trigger folds the reaction into its message, so the change reaches every open copy of it.

- **Presence and typing.** A presence channel records each open window and clears it a few seconds after the window closes, which drives the online roster. A typing channel carries "is typing" pings between members of the same channel.

- **Mentions by email.** When a message @mentions someone with no open window, a background job emails them the message.

- **Image attachments.** An rpc takes the attachment as a `File`, checks its type and size, and stores it, and a route serves it under its content hash.

- **Sessions and roles.** Admins create and archive channels, and removing a member ends every active session they have at once. Three migrations define the schema and seed one admin, three members and three channels with a conversation in each.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.
