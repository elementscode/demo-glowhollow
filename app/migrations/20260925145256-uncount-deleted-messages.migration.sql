-- uncount deleted messages

-- A deleted message stops counting for everyone who hadn't read it yet.
create or replace function messagesUncountUnread() returns trigger
language plpgsql as $$
begin
  update channelMembers
     set unread = greatest(unread - 1, 0)
   where channelId = old.channelId
     and userId <> old.userId
     and lastReadAt <= old.createdAt
     and unread > 0;

  return old;
end;
$$;

create trigger messagesUncountUnreadTrigger
  after delete on messages
  for each row execute function messagesUncountUnread();
