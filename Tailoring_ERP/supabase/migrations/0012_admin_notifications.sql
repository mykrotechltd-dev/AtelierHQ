-- ============================================================================
-- Admin console visibility into notification_outbox — "was my customer
-- actually notified?" shouldn't require trusting that it happened, matching
-- how activity/audit/revenue are already surfaced to platform admins
-- (0008_activity_and_audit.sql). notification_outbox itself has RLS enabled
-- with zero client policies (0009), so this audited, security-definer
-- function is the only way to read it from the client — same pattern as
-- admin_list_activity/admin_list_audit_log.
--
-- Run once in the Supabase SQL Editor (after 0001-0011).
-- ============================================================================

create or replace function admin_list_notifications(p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select coalesce(jsonb_agg(x.obj order by x.id desc), '[]'::jsonb)
  into v_result
  from (
    select
      n.id,
      jsonb_build_object(
        'id', n.id,
        'createdAt', n.created_at,
        'sentAt', n.sent_at,
        'tenantName', coalesce(t.name, 'Unknown shop'),
        'orderNumber', o.order_number,
        'customerName', c.name,
        'toStatus', n.to_status,
        'templateKey', n.template_key,
        'status', n.status,
        'channelUsed', n.channel_used,
        'attemptCount', n.attempt_count,
        'lastError', n.last_error
      ) as obj
    from notification_outbox n
    left join tenants   t on t.id = n.tenant_id
    left join orders    o on o.id = n.order_id
    left join customers c on c.id = n.customer_id
    order by n.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) x;

  perform log_admin_access('list_notifications', null, jsonb_array_length(v_result));
  return v_result;
end;
$$;

grant execute on function admin_list_notifications(int) to authenticated;
