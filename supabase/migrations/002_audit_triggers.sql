-- Keep audit records server-written and maintain script ownership timestamps.
create or replace function public.prepare_script_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_script_write on public.scripts;
create trigger prepare_script_write
before insert or update on public.scripts
for each row execute function public.prepare_script_write();

create or replace function public.audit_recruiterflow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_id_value text;
  event_action text;
  event_details jsonb;
begin
  if tg_table_name = 'scripts' then
    if tg_op = 'INSERT' then
      target_id_value := new.id::text;
      event_action := 'script.created';
      event_details := jsonb_build_object('category', new.category, 'title', new.title);
    elsif tg_op = 'UPDATE' then
      target_id_value := new.id::text;
      event_action := 'script.updated';
      event_details := jsonb_build_object(
        'category', new.category,
        'title', new.title,
        'previous_title', old.title
      );
    else
      target_id_value := old.id::text;
      event_action := 'script.deleted';
      event_details := jsonb_build_object('category', old.category, 'title', old.title);
    end if;
    insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values (actor, event_action, 'script', target_id_value, event_details);
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and (old.role is distinct from new.role
      or old.can_edit_scripts is distinct from new.can_edit_scripts) then
    insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values (
      actor,
      'profile.permissions_updated',
      'profile',
      new.id::text,
      jsonb_build_object(
        'previous_role', old.role,
        'role', new.role,
        'previous_can_edit_scripts', old.can_edit_scripts,
        'can_edit_scripts', new.can_edit_scripts
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_scripts_change on public.scripts;
create trigger audit_scripts_change
after insert or update or delete on public.scripts
for each row execute function public.audit_recruiterflow_change();

drop trigger if exists audit_profile_permissions_change on public.profiles;
create trigger audit_profile_permissions_change
after update on public.profiles
for each row execute function public.audit_recruiterflow_change();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_profile_updated_at on public.profiles;
create trigger touch_profile_updated_at
before update on public.profiles
for each row execute function public.touch_profile_updated_at();
