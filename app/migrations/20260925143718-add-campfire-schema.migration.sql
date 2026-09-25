-- add campfire schema

create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create type userRole as enum ('member', 'admin');

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  passwordHash text not null,
  displayName text not null,
  role userRole not null default 'member',
  removed boolean not null default false
);

-- Display names are what @mentions match, so two members can't share one.
create unique index usersDisplayNameIdx on users (lower(displayName));

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

create table channels (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  name text not null,
  topic text not null default '',
  archived boolean not null default false
);

create unique index channelsNameIdx on channels (lower(name));

create trigger channelsTouchUpdatedAt
  before update on channels
  for each row execute function touchUpdatedAt();

create table images (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  name text not null,
  contentType text not null,
  size integer not null,
  data bytea not null,
  hash text generated always as (encode(sha256(data), 'hex')) stored
);

create table messages (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  channelId uuid not null references channels(id) on delete cascade,
  userId uuid not null references users(id) on delete cascade,
  userName text not null,
  body text not null default '',
  imageId uuid references images(id) on delete set null,
  imageHash text,
  reactions jsonb not null default '{}'
);

create index messagesChannelIdx on messages (channelId, createdAt desc, id desc);

create trigger messagesTouchUpdatedAt
  before update on messages
  for each row execute function touchUpdatedAt();

-- Reaction and seed writes are plain SQL, so the table broadcasts its own rows.
create or replace function messagesNotify() returns trigger
language plpgsql as $$
declare
  r record;
  payload text;
begin
  r := coalesce(new, old);

  payload := json_build_object(
    'op', lower(tg_op),
    'data', json_build_object(
      'id', r.id,
      'createdAt', json_build_object('$type', 'Date', '$value', (extract(epoch from r.createdAt) * 1000)::bigint),
      'channelId', r.channelId,
      'userId', r.userId,
      'userName', r.userName,
      'body', r.body,
      'imageId', r.imageId,
      'imageHash', r.imageHash,
      'reactions', r.reactions
    )
  )::text;

  if octet_length(payload) >= 8000 then
    payload := json_build_object('op', lower(tg_op), 'id', r.id)::text;
  end if;

  perform pg_notify(channel_name('messages:channelId=' || r.channelId), payload);

  return r;
end;
$$;

create trigger messagesNotifyTrigger
  after insert or update or delete on messages
  for each row execute function messagesNotify();

create table reactions (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  messageId uuid not null references messages(id) on delete cascade,
  userId uuid not null references users(id) on delete cascade,
  emoji text not null,
  unique (messageId, userId, emoji)
);

-- Fold each reaction into its message's reactions column, shaped
-- { "👍": ["<userId>", ...] }, so reactions page with the message window.
create or replace function reactionsApply() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update messages
       set reactions = jsonb_set(
             reactions,
             array[new.emoji],
             coalesce(reactions -> new.emoji, '[]') || to_jsonb(new.userId::text))
     where id = new.messageId;
  else
    update messages
       set reactions = case
             when (reactions -> old.emoji) - old.userId::text = '[]'
               then reactions - old.emoji
             else jsonb_set(reactions, array[old.emoji], (reactions -> old.emoji) - old.userId::text)
           end
     where id = old.messageId;
  end if;

  return null;
end;
$$;

create trigger reactionsApplyTrigger
  after insert or delete on reactions
  for each row execute function reactionsApply();

create table channelMembers (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  channelId uuid not null references channels(id) on delete cascade,
  lastReadAt timestamptz not null default now(),
  unread integer not null default 0,
  unique (userId, channelId)
);

create trigger channelMembersTouchUpdatedAt
  before update on channelMembers
  for each row execute function touchUpdatedAt();

-- Everyone in the community is in every channel: a new member joins them all,
-- and a new channel takes in every member.
create or replace function usersJoinChannels() returns trigger
language plpgsql as $$
begin
  insert into channelMembers (userId, channelId)
  select new.id, c.id from channels c;

  return new;
end;
$$;

create trigger usersJoinChannelsTrigger
  after insert on users
  for each row execute function usersJoinChannels();

create or replace function channelsAddMembers() returns trigger
language plpgsql as $$
begin
  insert into channelMembers (userId, channelId)
  select u.id, new.id from users u where not u.removed;

  return new;
end;
$$;

create trigger channelsAddMembersTrigger
  after insert on channels
  for each row execute function channelsAddMembers();

-- A new message is unread for every other member of its channel.
create or replace function messagesCountUnread() returns trigger
language plpgsql as $$
begin
  update channelMembers
     set unread = unread + 1
   where channelId = new.channelId
     and userId <> new.userId;

  return new;
end;
$$;

create trigger messagesCountUnreadTrigger
  after insert on messages
  for each row execute function messagesCountUnread();

-- Send each changed membership to its own user's partition.
create or replace function channelMembersNotify() returns trigger
language plpgsql as $$
declare
  r record;
  payload text;
begin
  r := coalesce(new, old);

  payload := json_build_object(
    'op', lower(tg_op),
    'data', json_build_object(
      'id', r.id,
      'userId', r.userId,
      'channelId', r.channelId,
      'lastReadAt', json_build_object('$type', 'Date', '$value', (extract(epoch from r.lastReadAt) * 1000)::bigint),
      'unread', r.unread
    )
  )::text;

  perform pg_notify(channel_name('channelMembers:userId=' || r.userId), payload);

  return r;
end;
$$;

create trigger channelMembersNotifyTrigger
  after insert or update or delete on channelMembers
  for each row execute function channelMembersNotify();

-- One row per open page view, keyed by its listener.
create table presence (
  listenerId text primary key,
  createdAt timestamptz not null default now(),
  userId uuid not null references users(id) on delete cascade,
  channelId uuid,
  host text not null
);

create index presenceUserIdx on presence (userId);
create index presenceHostIdx on presence (host);
