update public.notifications as notification
set
  read = true,
  actions = '[]'::jsonb,
  entity_status = case workflow.status
    when 'accepted' then 'Acceptée'
    when 'declined' then 'Refusée'
    else notification.entity_status
  end
from public.workflow_records as workflow
where notification.record_id = workflow.id
  and workflow.status in ('accepted', 'declined')
  and jsonb_array_length(coalesce(notification.actions, '[]'::jsonb)) > 0;
