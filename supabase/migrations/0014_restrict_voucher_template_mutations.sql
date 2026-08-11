-- Voucher templates are shared catalog data: every authenticated learner may
-- read them, while only administrators may create or mutate catalog entries.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP POLICY IF EXISTS voucher_templates_all_authenticated ON public.voucher_templates;
DROP POLICY IF EXISTS voucher_templates_select_authenticated ON public.voucher_templates;
DROP POLICY IF EXISTS voucher_templates_insert_admin ON public.voucher_templates;
DROP POLICY IF EXISTS voucher_templates_update_admin ON public.voucher_templates;
DROP POLICY IF EXISTS voucher_templates_delete_admin ON public.voucher_templates;

CREATE POLICY voucher_templates_select_authenticated ON public.voucher_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY voucher_templates_insert_admin ON public.voucher_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY voucher_templates_update_admin ON public.voucher_templates
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY voucher_templates_delete_admin ON public.voucher_templates
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));
