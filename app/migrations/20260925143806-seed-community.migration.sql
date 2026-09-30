-- seed community: one admin, three members, three channels, a conversation in each
/** @env development */

insert into channels (name, topic, createdAt) values
  ('general', 'Anything and everything', now() - interval '3 days'),
  ('announcements', 'News from the admins', now() - interval '3 days' + interval '1 second'),
  ('off-topic', 'Books, coffee, and cat pictures', now() - interval '3 days' + interval '2 seconds');

-- Every seeded login shares one password, listed on the sign-in page.
insert into users (email, passwordHash, displayName, role) values
  ('maya@glowhollow.test', crypt('glowhollow123', genSalt('bf', 12)), 'maya', 'admin'),
  ('jonas@glowhollow.test', crypt('glowhollow123', genSalt('bf', 12)), 'jonas', 'member'),
  ('priya@glowhollow.test', crypt('glowhollow123', genSalt('bf', 12)), 'priya', 'member'),
  ('theo@glowhollow.test', crypt('glowhollow123', genSalt('bf', 12)), 'theo', 'member');

insert into messages (channelId, userId, userName, body, createdAt)
select c.id, u.id, u.displayName, m.body, now() - m.ago
  from (values
    ('announcements', 'maya', 'Glowhollow is live! Please keep conversations kind, and use #off-topic for anything that wanders.', interval '1 day 2 hours'),
    ('announcements', 'maya', 'New this week: attach an image to any message, and react with emoji. Mention someone with @name and they''ll get an email if they''re away.', interval '3 hours'),

    ('general', 'maya', 'Welcome to Glowhollow, everyone 🔥 Pull up a chair and say hi.', interval '2 hours 58 minutes'),
    ('general', 'jonas', 'Hey all! Glad to be here.', interval '2 hours 55 minutes'),
    ('general', 'priya', 'Hi hi 👋 love the name.', interval '2 hours 54 minutes'),
    ('general', 'theo', 'Hi folks! @maya thanks for setting this up.', interval '2 hours 40 minutes'),
    ('general', 'maya', 'Of course! Holler if anything looks broken.', interval '2 hours 38 minutes'),
    ('general', 'priya', 'Anyone up for a video call on Thursday?', interval '42 minutes'),
    ('general', 'jonas', '@priya count me in. Evening works best for me.', interval '37 minutes'),

    ('off-topic', 'theo', 'What is everyone reading right now?', interval '5 hours'),
    ('off-topic', 'priya', 'Piranesi, by Susanna Clarke. Strange and lovely.', interval '4 hours 52 minutes'),
    ('off-topic', 'jonas', 'Rereading The Hobbit. No shame.', interval '4 hours 41 minutes'),
    ('off-topic', 'theo', '@jonas zero shame, that one''s a classic.', interval '4 hours 33 minutes'),
    ('off-topic', 'priya', 'Unrelated: I have finally found a coffee grinder that doesn''t sound like a jet engine ☕', interval '1 hour 5 minutes')
  ) as m(channel, author, body, ago)
  join channels c on c.name = m.channel
  join users u on u.displayName = m.author;

insert into reactions (messageId, userId, emoji)
select msg.id, u.id, r.emoji
  from (values
    ('Welcome to Glowhollow, everyone 🔥 Pull up a chair and say hi.', 'jonas', '🔥'),
    ('Welcome to Glowhollow, everyone 🔥 Pull up a chair and say hi.', 'priya', '🔥'),
    ('Welcome to Glowhollow, everyone 🔥 Pull up a chair and say hi.', 'theo', '❤️'),
    ('Anyone up for a video call on Thursday?', 'theo', '👍'),
    ('Anyone up for a video call on Thursday?', 'jonas', '👍'),
    ('Rereading The Hobbit. No shame.', 'theo', '😂'),
    ('Rereading The Hobbit. No shame.', 'priya', '❤️'),
    ('Glowhollow is live! Please keep conversations kind, and use #off-topic for anything that wanders.', 'priya', '🎉')
  ) as r(body, author, emoji)
  join messages msg on msg.body = r.body
  join users u on u.displayName = r.author;

-- Nobody has opened anything yet, so every seeded message someone else wrote
-- is unread, and the read markers agree with the counts.
update channelMembers set lastReadAt = now() - interval '4 days';
