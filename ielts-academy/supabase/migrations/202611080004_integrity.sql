create function public.provision_first_admin(email_address text) returns uuid language plpgsql security definer set search_path=public as $$ declare u uuid; begin
 perform pg_advisory_xact_lock(742901);if exists(select 1 from user_roles where role='ADMIN') then raise exception 'An administrator already exists; use the authenticated administration workflow';end if;
 select id into u from auth.users where lower(email)=lower(email_address) and email_confirmed_at is not null;
 if u is null then raise exception 'A verified registered account is required';end if;
 insert into user_roles values(u,'ADMIN');insert into audit_logs(actor_id,action,entity,entity_id) values(u,'first_admin','user_roles',u::text);return u;end $$;
revoke all on function public.provision_first_admin(text) from public,anon,authenticated;grant execute on function public.provision_first_admin(text) to service_role;
create function public.mock_scorecard(a uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare owner_id uuid; result jsonb; scores numeric[]; begin
 select user_id into owner_id from mock_exam_attempts where id=a;
 if owner_id is null or (owner_id<>auth.uid() and not can_review(owner_id)) then raise exception 'Access denied' using errcode='42501';end if;
 select jsonb_agg(jsonb_build_object('skill',x.skill,'band',x.band,'pending',x.band is null)),array_agg(x.band) into result,scores from (
 select skill,case when count(*) filter(where score is null)>0 then null else round((sum(score*weight)/sum(weight))*2)/2 end as band from (
 select ms.skill,case when ms.skill in ('reading','listening') then t.band when ms.skill='writing' then w.band else s.band end as score,case when wt.task_number=2 then 2 else 1 end as weight
 from mock_exam_sections ms join mock_exam_attempts ma on ma.mock_exam_id=ms.mock_exam_id and ma.id=a
 left join mock_exam_results mr on mr.attempt_id=a and mr.section_id=ms.id
 left join test_attempts t on t.id=mr.test_attempt_id
 left join writing_tasks wt on wt.id=ms.writing_task_id
 left join lateral(select band from writing_evaluations where submission_id=mr.writing_submission_id order by (source='teacher') desc,created_at desc limit 1) w on true
 left join lateral(select band from speaking_evaluations where recording_id=mr.speaking_recording_id and source='teacher' order by created_at desc limit 1) s on true
 ) scored group by skill
 ) x;
 return jsonb_build_object('sections',result,'overall_band',case when cardinality(scores)=4 and array_position(scores,null) is null then (select round(avg(v)*2)/2 from unnest(scores) v) else null end,'estimate',true);end $$;
revoke all on function public.mock_scorecard(uuid) from public,anon;grant execute on function public.mock_scorecard(uuid) to authenticated;
create unique index mock_section_order on public.mock_exam_sections(mock_exam_id,position);
-- Once used, exam definitions and subjective prompts are retained for reproducible review.
create function public.freeze_used_content() returns trigger language plpgsql security definer set search_path=public as $$ declare d jsonb; used boolean; parent uuid; begin
 d=to_jsonb(old);
 if TG_TABLE_NAME='mock_exam_sections' then parent=old.mock_exam_id;select exists(select 1 from mock_exam_attempts where mock_exam_id=parent) into used;
 elsif TG_TABLE_NAME='mock_exams' then select exists(select 1 from mock_exam_attempts where mock_exam_id=old.id) into used;
 elsif TG_TABLE_NAME='writing_tasks' then select exists(select 1 from writing_submissions where task_id=old.id) into used;
 else select exists(select 1 from speaking_recordings where task_id=old.id) into used; end if;
 if used and not (TG_OP='UPDATE' and (to_jsonb(new)-'status')=(d-'status')) then raise exception 'Content with student work is immutable; create a new version';end if;
 return case when TG_OP='DELETE' then old else new end;end $$;
do $$ declare t text; begin foreach t in array array['mock_exam_sections','mock_exams','writing_tasks','speaking_tasks'] loop execute format('create trigger freeze_used before update or delete on public.%I for each row execute function public.freeze_used_content()',t);end loop;end $$;
revoke all on function public.freeze_used_content() from public,anon,authenticated;
create function public.change_role(u uuid,r text,remove_role boolean default false) returns void language plpgsql security definer set search_path=public as $$ begin
 if not has_role('ADMIN') then raise exception 'Administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(742901);
 if remove_role then
 if r='ADMIN' and (select count(*) from user_roles where role='ADMIN')<=1 then raise exception 'The last administrator must be retained';end if;
 if r='STUDENT' then raise exception 'Every account retains its base student role';end if;
 delete from user_roles where user_id=u and role=r;
 else insert into user_roles values(u,r) on conflict do nothing;end if;
 insert into audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),case when remove_role then 'revoke_role' else 'grant_role' end,'user_roles',u::text||':'||r);end $$;
revoke all on function public.change_role(uuid,text,boolean) from public,anon;grant execute on function public.change_role(uuid,text,boolean) to authenticated;
create function public.assignment_guard() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if not exists(select 1 from user_roles where user_id=new.student_id and role='STUDENT') or not (
 (new.lesson_id is not null and lesson_visible(new.lesson_id)) or (new.test_id is not null and test_visible(new.test_id)) or (new.writing_task_id is not null and exists(select 1 from writing_tasks where id=new.writing_task_id and status='published')) or (new.speaking_task_id is not null and exists(select 1 from speaking_tasks where id=new.speaking_task_id and status='published'))
 ) then raise exception 'Assign published content to registered students only';end if;return new;end $$;
create trigger assignment_guard before insert or update on public.assignments for each row execute function public.assignment_guard();
revoke all on function public.assignment_guard() from public,anon,authenticated;
-- Serialize content edits against attempt creation and reject moving a used child.
create function public.lock_test_definition() returns trigger language plpgsql security definer set search_path=public as $$ declare d jsonb; candidate uuid; previous uuid; t uuid; used boolean; published boolean; begin
 for d in select x from unnest(case when TG_OP='INSERT' then array[to_jsonb(new)] when TG_OP='DELETE' then array[to_jsonb(old)] else array[to_jsonb(old),to_jsonb(new)] end) x loop
 candidate=null;
 if TG_TABLE_NAME='tests' then candidate=(d->>'id')::uuid;
 elsif TG_TABLE_NAME='test_sections' then candidate=(d->>'test_id')::uuid;
 elsif TG_TABLE_NAME in ('questions','passages') then select test_id into candidate from test_sections where id=(d->>'section_id')::uuid;
 else select s.test_id into candidate from questions q join test_sections s on s.id=q.section_id where q.id=(d->>'question_id')::uuid;end if;
 if candidate is null or candidate=previous then continue;end if;previous=candidate;
 select status='published' into published from tests where id=candidate for update;
 select exists(select 1 from test_attempts where test_id=candidate) into used;
 if (published or used) and not (TG_TABLE_NAME='tests' and TG_OP='UPDATE' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status')) then raise exception 'Unpublish unused tests before editing; used tests require a new version';end if;
 end loop;
 return case when TG_OP='DELETE' then old else new end;end $$;
do $$ declare t text; begin foreach t in array array['tests','test_sections','questions','passages','question_options','answer_keys'] loop execute format('create trigger serialize_definition before insert or update or delete on public.%I for each row execute function public.lock_test_definition()',t);end loop;end $$;
revoke all on function public.lock_test_definition() from public,anon,authenticated;
create function public.admin_statistics() returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
 if not has_role('ADMIN') then raise exception 'Administrator required' using errcode='42501';end if;
 return jsonb_build_object('users',(select count(*) from profiles),'students',(select count(*) from user_roles where role='STUDENT'),'teachers',(select count(*) from user_roles where role='TEACHER'),'published_tests',(select count(*) from tests where status='published'),'published_mocks',(select count(*) from mock_exams where status='published'),'published_lessons',(select count(*) from lessons where status='published'),'completed_attempts',(select count(*) from test_attempts where status='submitted'),'average_band',(select round(avg(band),1) from test_attempts where status='submitted'));end $$;
revoke all on function public.admin_statistics() from public,anon;grant execute on function public.admin_statistics() to authenticated;
create function public.mock_section_insert_guard() returns trigger language plpgsql security definer set search_path=public as $$ begin
 perform 1 from mock_exams where id=new.mock_exam_id for update;
 if exists(select 1 from mock_exam_attempts where mock_exam_id=new.mock_exam_id) then raise exception 'Used mock exams require a new version';end if;return new;end $$;
create trigger mock_section_insert before insert on public.mock_exam_sections for each row execute function public.mock_section_insert_guard();
revoke all on function public.mock_section_insert_guard() from public,anon,authenticated;
