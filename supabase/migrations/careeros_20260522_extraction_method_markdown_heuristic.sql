-- Allow markdown_heuristic extraction method on profile extract rows.

alter table careeros.user_document_extractions
  drop constraint if exists careeros_user_document_extractions_method_check;

alter table careeros.user_document_extractions
  add constraint careeros_user_document_extractions_method_check
  check (
    extraction_method is null
    or extraction_method in ('llm_structured', 'fallback_minimal', 'markdown_heuristic')
  );
