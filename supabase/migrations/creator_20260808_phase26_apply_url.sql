-- Where to actually apply.
--
-- A grant card carried the register listing and a drafted pitch, which is one
-- click short of useful: the creator still had to find the submission route
-- themselves, on a page they had never seen, usually on the day it closes.
--
-- The value is entirely in where this comes from. apply_url is carried straight
-- off the register that published the call and is never chosen by the model and
-- never constructed from a pattern. A guessed apply link is the same class of
-- failure as a guessed contact name: it looks right, it is clickable, and it
-- lands on a 404 on the morning of a deadline.
alter table creator.creator_work
  add column if not exists apply_url text;

-- Who may apply, quoted from the announcement itself.
--
-- Most US federal calls restrict applicants to organisations located in the
-- United States and the search endpoint says nothing about it, so the desk was
-- proposing calls an Ireland-based individual is barred from. Storing the real
-- text means the decision is made on evidence rather than on an assumption in
-- either direction.
alter table creator.creator_work
  add column if not exists eligibility text;
