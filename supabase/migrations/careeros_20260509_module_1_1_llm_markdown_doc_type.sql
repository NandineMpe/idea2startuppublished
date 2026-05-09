-- Module 1.1: allow LLM-exported markdown as a first-class document source.

alter table careeros.user_documents drop constraint if exists careeros_user_documents_doc_type_check;

alter table careeros.user_documents
  add constraint careeros_user_documents_doc_type_check
  check (doc_type in ('resume', 'linkedin', 'llm_markdown'));

comment on constraint careeros_user_documents_doc_type_check on careeros.user_documents is
  'resume | linkedin | llm_markdown (LLM-generated career context .md)';

-- Private bucket for CareerOS uploads (API uses service role; users upload via Next.js routes).
insert into storage.buckets (id, name, public)
values ('careeros-documents', 'careeros-documents', false)
on conflict (id) do nothing;
