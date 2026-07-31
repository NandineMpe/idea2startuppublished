-- A draft needs to say what it is before it says how it opens.
--
-- The card in Next Five led with a working title and a hook, which is the right
-- order for shooting and the wrong order for deciding. Reading it cold, there
-- was no way to tell what the piece was actually about without opening the
-- script, and every reason the story existed — the thesis, what it was building
-- on, the receipts — had been left behind on the Stories screen.
--
-- `premise` is the two or three sentences that say what this piece argues. It
-- is written by the Writer rather than copied from the story, because a
-- direct-brief draft has no story to copy from and should still explain itself.

alter table creator.creator_work
  add column if not exists premise text;
