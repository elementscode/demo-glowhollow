import { Channel, File, ForbiddenError, LiveTable, ValidationError, session, sql } from "@elements/app";
import { activeUserOrThrow, adminOrThrow } from "#app/shared/services/auth";
import { SendMentionJob } from "#app/jobs/send-mention";
import { mentionedNames } from "#app/shared/services/mentions";

export interface ChatChannel {
  id: string;
  createdAt: Date;
  name: string;
  topic: string;
  archived: boolean;
}

export interface Message {
  id: string;
  createdAt: Date;
  channelId: string;
  userId: string;
  userName: string;
  body: string;
  imageId: string | null;
  imageHash: string | null;
  reactions: Record<string, string[]>;
}

export interface ChannelMember {
  id: string;
  userId: string;
  channelId: string;
  lastReadAt: Date;
  unread: number;
}

export interface UploadedImage {
  id: string;
  hash: string;
}

export interface ImageForm {
  file: File;
}

export interface TypingPing {
  channelId: string;
  userId: string;
  userName: string;
  stopped: boolean;
}

export const CHANNEL_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀"];

export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const MAX_BODY = 4000;

function cleanChannel(item: Partial<ChatChannel>): { name: string; topic: string } {
  let name = (item.name ?? "").trim().toLowerCase();
  let topic = (item.topic ?? "").trim();

  if (!CHANNEL_NAME.test(name)) {
    throw new ValidationError("Channel names are lowercase letters, numbers and dashes, up to 40 characters.");
  }

  if (topic.length > 120) {
    throw new ValidationError("Keep the topic under 120 characters.");
  }

  let taken = !sql(`
    select 1 from channels where lower(name) = ${name} and id <> ${item.id ?? null}::uuid
  `).empty();

  if (taken) {
    throw new ValidationError(`#${name} already exists.`);
  }

  return { name, topic };
}

export let channels: LiveTable<ChatChannel> = new LiveTable<ChatChannel>({
  channel: () => "channels",

  insert: (item) => {
    adminOrThrow();

    let { name, topic } = cleanChannel(item);

    return sql<ChatChannel>(`
      insert into channels (id, name, topic)
           values (${item.id}, ${name}, ${topic})
        returning id, createdAt, name, topic, archived
    `).firstOrThrow();
  },

  update: (item) => {
    adminOrThrow();

    let { name, topic } = cleanChannel(item);

    return sql<ChatChannel>(`
      update channels
         set name = ${name}, topic = ${topic}, archived = ${item.archived}
       where id = ${item.id}
   returning id, createdAt, name, topic, archived
    `).firstOrThrow("channel not found");
  },

  delete: () => {
    throw new ForbiddenError("Archive a channel instead of deleting it.");
  },
});

export let channelMembers: LiveTable<ChannelMember> = new LiveTable<ChannelMember>({
  channel: (partition) => partition ? `channelMembers:${partition}` : "channelMembers",

  insert: () => {
    throw new ForbiddenError();
  },

  // The one change a member makes to their own row: mark it read.
  update: (item) => {
    return sql<ChannelMember>(`
      update channelMembers
         set unread = 0, lastReadAt = now()
       where id = ${item.id} and userId = ${session.getOrThrow("userId")}
   returning id, userId, channelId, lastReadAt, unread
    `).firstOrThrow();
  },

  delete: () => {
    throw new ForbiddenError();
  },
});

export let messages: LiveTable<Message> = new LiveTable<Message>({
  channel: (partition) => partition ? `messages:${partition}` : "messages",

  insert: (item) => {
    let me = activeUserOrThrow();
    let body = (item.body ?? "").trim();

    let channel = sql<ChatChannel>(`
      select id, createdAt, name, topic, archived from channels where id = ${item.channelId}
    `).firstOrThrow("channel not found");

    if (channel.archived) {
      throw new ValidationError(`#${channel.name} is archived, so it's read-only.`);
    }

    let image: UploadedImage | undefined;

    if (item.imageId) {
      image = sql<UploadedImage>(`
        select id, hash from images where id = ${item.imageId} and userId = ${me.id}
      `).firstOrThrow("image not found");
    }

    if (!body && !image) {
      throw new ValidationError("Write a message or attach an image.");
    }

    if (body.length > MAX_BODY) {
      throw new ValidationError(`Messages are limited to ${MAX_BODY} characters.`);
    }

    let row = sql<Message>(`
      insert into messages (id, channelId, userId, userName, body, imageId, imageHash)
           values (${item.id}, ${channel.id}, ${me.id}, ${me.displayName}, ${body}, ${image?.id ?? null}, ${image?.hash ?? null})
        returning id, createdAt, channelId, userId, userName, body, imageId, imageHash, reactions
    `).firstOrThrow();

    emailOfflineMentions(row, channel);

    return row;
  },

  update: () => {
    throw new ForbiddenError("Messages can't be edited.");
  },

  delete: (item) => {
    adminOrThrow();
    messages.delete(item);
  },
});

/** Offline means no open page anywhere in the app, which is what presence tracks. */
function emailOfflineMentions(message: Message, channel: ChatChannel) {
  let names = mentionedNames(message.body);

  if (names.length === 0) {
    return;
  }

  let recipients = sql<{ email: string; displayName: string }>(`
    select u.email, u.displayName
      from users u
     where lower(u.displayName) = any(${names}::text[])
       and u.id <> ${message.userId}
       and not u.removed
       and not exists (select 1 from presence p where p.userId = u.id)
  `).all();

  for (let r of recipients) {
    new SendMentionJob({
      to: r.email,
      recipientName: r.displayName,
      senderName: message.userName,
      channelName: channel.name,
      channelId: channel.id,
      body: message.body,
    }).schedule();
  }
}

/** @rpc */
export function toggleReaction(messageId: string, emoji: string) {
  let me = activeUserOrThrow();

  if (!REACTIONS.includes(emoji)) {
    throw new ValidationError("Pick one of the listed reactions.");
  }

  let removed = sql(`
    delete from reactions
     where messageId = ${messageId} and userId = ${me.id} and emoji = ${emoji}
 returning id
  `);

  if (removed.empty()) {
    sql(`
      insert into reactions (messageId, userId, emoji)
           values (${messageId}, ${me.id}, ${emoji})
      on conflict do nothing
    `);
  }
}

/** @rpc */
export function uploadImage(form: ImageForm): UploadedImage {
  let me = activeUserOrThrow();
  let f = form.file;

  if (!f) {
    throw new ValidationError("Pick an image to attach.");
  }

  if (!IMAGE_TYPES.has(f.contentType)) {
    throw new ValidationError(`${f.name} isn't a PNG, JPEG, GIF or WebP image.`);
  }

  if (f.size > MAX_IMAGE_BYTES) {
    throw new ValidationError("Images are limited to 5 MB.");
  }

  return sql<UploadedImage>(`
    insert into images (userId, name, contentType, size, data)
         values (${me.id}, ${f.name}, ${f.contentType}, ${f.size}, ${f.data})
      returning id, hash
  `).firstOrThrow();
}

export const typing = new Channel<TypingPing>("typing");

/** @rpc */
export function notifyTyping(channelId: string, stopped: boolean) {
  session.isLoggedInOrThrow();

  typing.notify({
    channelId,
    userId: session.getOrThrow("userId"),
    userName: session.getOrThrow("userName"),
    stopped,
  });
}

export function isMemberOrThrow(channelId: string) {
  session.isLoggedInOrThrow();

  let found = !sql(`
    select 1 from channelMembers
     where userId = ${session.getOrThrow("userId")} and channelId = ${channelId}
  `).empty();

  if (!found) {
    throw new ForbiddenError("You're not a member of this channel.");
  }
}
