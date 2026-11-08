create function public.touch_timestamp() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text;begin for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()',t);
 execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()',t);
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_timestamp()',t);
 end loop;end $$;
-- Application RPC positional inserts must explicitly name columns as the schema evolves.
create or replace function public.record_activity(k text,s uuid) returns void language plpgsql security definer set search_path=public as $$ begin insert into learning_activity_events(user_id,kind,source_id) values(auth.uid(),k,s) on conflict do nothing;end $$;
revoke all on function public.touch_timestamp() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['course_modules','lesson_resources','test_sections','passages','questions','question_options','answer_keys','mock_exam_sections','teacher_student_assignments','assignments'] loop execute format('create trigger content_audit after insert or update or delete on public.%I for each row execute function public.audit_content()',t);end loop;end $$;
create policy own_profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;
