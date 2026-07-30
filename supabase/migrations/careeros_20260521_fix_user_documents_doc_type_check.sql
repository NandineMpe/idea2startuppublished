-- Phase1 created user_documents_doc_type_check (resume|linkedin only).
-- Module 1.1 added careeros_user_documents_doc_type_check (+ llm_markdown).
-- Both were active, so llm_markdown inserts failed with a check violation.

alter table careeros.user_documents
  drop constraint if exists user_documents_doc_type_check;

alter table careeros.user_documents
  drop constraint if exists careeros_user_documents_doc_type_check;

alter table careeros.user_documents
  add constraint careeros_user_documents_doc_type_check
  check (doc_type in ('resume', 'linkedin', 'llm_markdown'));
