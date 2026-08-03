-- Who to actually contact.
--
-- The desk was drafting a ready-to-send pitch and never saying who to send it
-- to. "PPC Land / TikTok and BSI Creator Suitability Report, paid or
-- commissioned technical commentary" is a real opportunity and an unactionable
-- card: no organisation to approach, no desk, no route in, no first step. The
-- creator was left to work out the outreach themselves, which is the part an
-- agency exists to have already done.
--
-- {organisation, contact_role, contact_name, contact_route, next_action,
--  confidence: named | role_only | unknown}
--
-- confidence is stored rather than implied because the failure mode here is
-- specific and expensive: a plausible invented name at a real company is worse
-- than an honest "the commissioning editor, name not published". One wastes a
-- pitch, the other burns the introduction.
alter table creator.creator_work
  add column if not exists counterparty jsonb;
