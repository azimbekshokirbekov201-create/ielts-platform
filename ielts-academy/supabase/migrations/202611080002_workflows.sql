create function public.require_student() returns void language plpgsql security definer set search_path=public as $$ begin if not has_role('STUDENT') then raise exception 'Student role required' using errcode='42501'; end if; end $$;
create function public.record_activity(k text,s uuid) returns void language plpgsql security definer set search_path=public as $$ begin insert into learning_activity_events(user_id,kind,source_id) values(auth.uid(),k,s) on conflict do nothing; end $$;
create function public.save_onboarding(p jsonb, finish boolean default false) returns public.student_onboarding language plpgsql security definer set search_path=public as $$ declare result student_onboarding; begin
 perform require_student(); insert into student_onboarding(user_id) values(auth.uid()) on conflict do nothing;
 update student_onboarding set motivation=coalesce(p->>'motivation',motivation),target_band=coalesce((p->>'target_band')::numeric,target_band),current_level=coalesce(p->>'current_level',current_level),priority_skills=case when p ? 'priority_skills' then array(select jsonb_array_elements_text(p->'priority_skills')) else priority_skills end,daily_goal_minutes=coalesce((p->>'daily_goal_minutes')::int,daily_goal_minutes),weekly_availability=case when p ? 'weekly_availability' then array(select jsonb_array_elements_text(p->'weekly_availability'))::int[] else weekly_availability end,current_step=coalesce((p->>'current_step')::int,current_step),completed=completed or finish,completed_at=case when finish then coalesce(completed_at,now()) else completed_at end,updated_at=now() where user_id=auth.uid() returning * into result;
 if finish then insert into student_achievements select auth.uid(),id,now() from achievements where code='onboarding_complete' on conflict do nothing; perform record_activity('onboarding',auth.uid()); end if; return result; end $$;
create function public.start_test(t uuid) returns public.test_attempts language plpgsql security definer set search_path=public as $$ declare result test_attempts; duration int; begin
 perform require_student(); perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||t::text,0));
 select * into result from test_attempts where user_id=auth.uid() and test_id=t and status='in_progress'; if found then return result; end if;
 select duration_seconds into duration from tests where id=t and status='published' for update; if not found then raise exception 'Published test not found'; end if;
 insert into test_attempts(user_id,test_id,deadline) values(auth.uid(),t,now()+make_interval(secs=>duration)) returning * into result; return result; end $$;
create function public.save_answers(a uuid,p jsonb) returns void language plpgsql security definer set search_path=public as $$ declare attempt test_attempts; item record; begin
 select * into attempt from test_attempts where id=a and user_id=auth.uid() for update; if not found or attempt.status<>'in_progress' or now()>attempt.deadline then raise exception 'Attempt is closed or expired'; end if;
 for item in select * from jsonb_each_text(p) loop
 if not exists(select 1 from questions q join test_sections s on s.id=q.section_id where q.id=item.key::uuid and s.test_id=attempt.test_id) then raise exception 'Question does not belong to attempt'; end if;
 insert into student_answers values(a,item.key::uuid,item.value) on conflict(attempt_id,question_id) do update set answer=excluded.answer;
 end loop; end $$;
create function public.normalize_answer(a text) returns text language sql immutable as $$ select lower(regexp_replace(btrim(a),'\s+',' ','g')) $$;
create function public.submit_test(a uuid) returns public.test_attempts language plpgsql security definer set search_path=public as $$ declare result test_attempts; score int; total int; thresholds jsonb; b numeric; begin
 select * into result from test_attempts where id=a and user_id=auth.uid() for update; if not found then raise exception 'Attempt not found'; end if; if result.status='submitted' then return result; end if;
 select coalesce(sum(q.points) filter(where exists(select 1 from unnest(k.accepted) v where normalize_answer(v)=normalize_answer(sa.answer)) and (q.max_words is null or cardinality(regexp_split_to_array(btrim(sa.answer),'\s+'))<=q.max_words)),0),coalesce(sum(q.points),0) into score,total from questions q join test_sections s on s.id=q.section_id join answer_keys k on k.question_id=q.id left join student_answers sa on sa.question_id=q.id and sa.attempt_id=a where s.test_id=result.test_id;
 select band_thresholds into thresholds from tests where id=result.test_id;
 -- Bands are only calculated from an administrator-configured, validated conversion.
 if thresholds is not null then select max((x->>'band')::numeric) into b from jsonb_array_elements(thresholds) x where score>=(x->>'min')::int; end if;
 update test_attempts set raw_score=score,total_points=total,band=b,status='submitted',submitted_at=now() where id=a returning * into result; perform record_activity('test',a); return result; end $$;
create function public.writing_draft(t uuid,body_text text default null,finish boolean default false,submission uuid default null) returns public.writing_submissions language plpgsql security definer set search_path=public as $$ declare result writing_submissions; seconds int; begin
 perform require_student(); perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||t::text,1));
 if submission is not null then select * into result from writing_submissions where id=submission and task_id=t and user_id=auth.uid() for update; if not found then raise exception 'Draft not found'; end if; if result.submitted_at is not null then return result; end if; else select * into result from writing_submissions where task_id=t and user_id=auth.uid() and submitted_at is null for update; end if;
 if not found then select duration_seconds into seconds from writing_tasks where id=t and status='published' for update; if not found then raise exception 'Published task not found'; end if;
 insert into writing_submissions(user_id,task_id,deadline) values(auth.uid(),t,now()+make_interval(secs=>seconds)) returning * into result; end if;
 if body_text is not null and now()<=result.deadline then update writing_submissions set body=body_text where id=result.id returning * into result; end if;
 if finish then if length(btrim(result.body))=0 then raise exception 'Write a response first'; end if; update writing_submissions set submitted_at=now() where id=result.id returning * into result; perform record_activity('writing',result.id); end if; return result; end $$;
create function public.enroll_course(c uuid) returns void language plpgsql security definer set search_path=public as $$ begin perform require_student(); if not course_visible(c) then raise exception 'Course unavailable'; end if; insert into course_enrollments(user_id,course_id) values(auth.uid(),c) on conflict do nothing; end $$;
create function public.complete_lesson(l uuid) returns void language plpgsql security definer set search_path=public as $$ begin perform require_student(); if not lesson_visible(l) or not exists(select 1 from course_enrollments e join course_modules m on m.course_id=e.course_id join lessons x on x.module_id=m.id where e.user_id=auth.uid() and x.id=l) then raise exception 'Enroll in a published course first'; end if; insert into lesson_progress(user_id,lesson_id) values(auth.uid(),l) on conflict do nothing; perform record_activity('lesson',l); end $$;
create function public.add_recording(t uuid,p text) returns public.speaking_recordings language plpgsql security definer set search_path=public as $$ declare result speaking_recordings; begin perform require_student(); perform 1 from speaking_tasks where id=t for update; if not exists(select 1 from speaking_tasks where id=t and status='published') or not exists(select 1 from media_assets where user_id=auth.uid() and storage_path=p and bucket='speaking') or not exists(select 1 from storage.objects where bucket_id='speaking' and name=p and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Task or private recording missing'; end if; insert into speaking_recordings(user_id,task_id,storage_path) values(auth.uid(),t,p) on conflict(storage_path) do update set storage_path=excluded.storage_path returning * into result; perform record_activity('speaking',result.id); return result; end $$;
create function public.review_submission(k text,s uuid,b numeric,c jsonb,f text) returns void language plpgsql security definer set search_path=public as $$ declare owner_id uuid; begin
 if k='writing' then select user_id into owner_id from writing_submissions where id=s and submitted_at is not null;
 elsif k='speaking' then select user_id into owner_id from speaking_recordings where id=s; else raise exception 'Invalid review type'; end if;
 if owner_id is null or not can_review(owner_id) then raise exception 'Review forbidden' using errcode='42501'; end if;
 if k='writing' then insert into writing_evaluations(submission_id,evaluator_id,source,band,criteria,feedback) values(s,auth.uid(),'teacher',b,c,f); else insert into speaking_evaluations(recording_id,evaluator_id,source,band,criteria,feedback) values(s,auth.uid(),'teacher',b,c,f); end if;
 insert into audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'evaluate',k,s::text); end $$;
create function public.start_mock(m uuid) returns public.mock_exam_attempts language plpgsql security definer set search_path=public as $$ declare result mock_exam_attempts; resume boolean; begin perform require_student(); perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||m::text,2));
 select allow_resume into resume from mock_exams where id=m and status='published' and (available_from is null or now()>=available_from) and (available_until is null or now()<=available_until) for update; if not found then raise exception 'Exam unavailable'; end if;
 select * into result from mock_exam_attempts where user_id=auth.uid() and mock_exam_id=m and submitted_at is null;
 if found then if not resume then raise exception 'Resume disabled: contact your teacher'; end if; return result; end if;
 insert into mock_exam_attempts(user_id,mock_exam_id) values(auth.uid(),m) returning * into result; return result; end $$;
create function public.link_mock_section(a uuid,s uuid,r uuid) returns void language plpgsql security definer set search_path=public as $$ declare ma mock_exam_attempts; ms mock_exam_sections; begin
 select * into ma from mock_exam_attempts where id=a and user_id=auth.uid() and submitted_at is null for update;
 select * into ms from mock_exam_sections where id=s and mock_exam_id=ma.mock_exam_id;
 if ms.id is null then raise exception 'Section unavailable'; end if;
 if exists(select 1 from mock_exam_sections x where x.mock_exam_id=ma.mock_exam_id and x.position<ms.position and not exists(select 1 from mock_exam_results z where z.attempt_id=a and z.section_id=x.id)) then raise exception 'Complete earlier sections first'; end if;
 if ms.skill in ('listening','reading') then
 if not exists(select 1 from test_attempts where id=r and user_id=auth.uid() and test_id=ms.test_id and submitted_at is not null and started_at>=ma.started_at) then raise exception 'Completed attempt required'; end if;
 insert into mock_exam_results(attempt_id,section_id,test_attempt_id) values(a,s,r) on conflict do nothing;
 elsif ms.skill='writing' then
 if not exists(select 1 from writing_submissions where id=r and user_id=auth.uid() and task_id=ms.writing_task_id and submitted_at is not null and created_at>=ma.started_at) then raise exception 'Submitted writing required'; end if;
 insert into mock_exam_results(attempt_id,section_id,writing_submission_id) values(a,s,r) on conflict do nothing;
 else
 if not exists(select 1 from speaking_recordings where id=r and user_id=auth.uid() and task_id=ms.speaking_task_id and created_at>=ma.started_at) then raise exception 'Recording required'; end if;
 insert into mock_exam_results(attempt_id,section_id,speaking_recording_id) values(a,s,r) on conflict do nothing; end if;
 if (select count(*) from mock_exam_results where attempt_id=a)=(select count(*) from mock_exam_sections where mock_exam_id=ma.mock_exam_id) then update mock_exam_attempts set submitted_at=now() where id=a; end if; end $$;
create function public.reserve_ai(k text,s uuid,m text) returns uuid language plpgsql security definer set search_path=public as $$ declare cfg platform_settings; result uuid; begin
 if not exists(select 1 from user_preferences where user_id=auth.uid() and ai_consent) then raise exception 'AI consent required'; end if;
 if (k='writing' and not exists(select 1 from writing_submissions where id=s and user_id=auth.uid() and submitted_at is not null)) or (k='speaking' and not exists(select 1 from speaking_recordings where id=s and user_id=auth.uid())) or k not in ('writing','speaking') then raise exception 'Submission unavailable'; end if;
 select * into cfg from platform_settings where id=true for update;
 if not cfg.ai_enabled then raise exception 'AI is disabled'; end if;
 if (select count(*) from ai_usage_logs where user_id=auth.uid() and created_at>=date_trunc('day',now()))>=cfg.ai_daily_user_limit or (select count(*) from ai_usage_logs where created_at>=date_trunc('day',now()))>=cfg.ai_daily_platform_limit then raise exception 'AI daily limit reached'; end if;
 insert into ai_usage_logs(user_id,source_id,kind,model) values(auth.uid(),s,k,m) returning id into result; return result; end $$;
-- Service-only atomic rate limiter (shared across instances).
create function public.consume_rate_limit(k text,max_hits int,window_seconds int) returns boolean language plpgsql security definer set search_path=public as $$ declare n int; begin
 insert into rate_limit_buckets values(k,now(),1) on conflict(key) do update set hits=case when rate_limit_buckets.window_start<now()-make_interval(secs=>window_seconds) then 1 else rate_limit_buckets.hits+1 end,window_start=case when rate_limit_buckets.window_start<now()-make_interval(secs=>window_seconds) then now() else rate_limit_buckets.window_start end returning hits into n; return n<=max_hits; end $$;
create function public.content_guard() returns trigger language plpgsql security definer set search_path=public as $$ declare t uuid; rowdata jsonb; begin
 rowdata=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_TABLE_NAME='tests' then t=(rowdata->>'id')::uuid;
 elsif TG_TABLE_NAME='test_sections' then t=(rowdata->>'test_id')::uuid;
 elsif TG_TABLE_NAME in ('questions','passages') then select test_id into t from test_sections where id=(rowdata->>'section_id')::uuid;
 elsif TG_TABLE_NAME in ('question_options','answer_keys') then select s.test_id into t from questions q join test_sections s on s.id=q.section_id where q.id=coalesce((rowdata->>'question_id')::uuid,(rowdata->>'id')::uuid); end if;
 if t is not null and exists(select 1 from test_attempts where test_id=t) and not (TG_TABLE_NAME='tests' and TG_OP='UPDATE' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status')) then raise exception 'Tests with attempts are immutable; duplicate as a new test'; end if;
 if TG_OP='UPDATE' and rowdata->>'status'='published' then
 if TG_TABLE_NAME='tests' then
 if not exists(select 1 from questions q join test_sections s on s.id=q.section_id where s.test_id=new.id) or exists(select 1 from questions q join test_sections s on s.id=q.section_id left join answer_keys k on k.question_id=q.id where s.test_id=new.id and k.question_id is null) then raise exception 'Every test requires questions and private answer keys'; end if;
 if new.band_thresholds is not null and (jsonb_typeof(new.band_thresholds)<>'array' or exists(select 1 from jsonb_array_elements(new.band_thresholds) x where (x->>'min')::int<0 or (x->>'band')::numeric not between 0 and 9 or mod((x->>'band')::numeric*2,1)<>0 or not(x ? 'min' and x ? 'band'))) then raise exception 'Invalid score conversion'; end if;
 elsif TG_TABLE_NAME='mock_exams' then if (select count(distinct skill) from mock_exam_sections where mock_exam_id=new.id)<>4 or exists(select 1 from mock_exam_sections x left join tests t on t.id=x.test_id left join writing_tasks w on w.id=x.writing_task_id left join speaking_tasks s on s.id=x.speaking_task_id where x.mock_exam_id=new.id and (coalesce(t.status,w.status,s.status)<>'published' or (t.id is not null and t.skill<>x.skill))) then raise exception 'Publish valid sections covering all four skills first'; end if; end if;
 end if;
 if TG_OP='INSERT' and rowdata->>'status'='published' then raise exception 'Create as a draft before publishing'; end if;
 return case when TG_OP='DELETE' then old else new end; end $$;
do $$ declare t text; begin foreach t in array array['tests','test_sections','questions','passages','question_options','answer_keys','mock_exams'] loop execute format('create trigger guard_content before insert or update or delete on public.%I for each row execute function public.content_guard()',t); end loop; end $$;
create function public.audit_content() returns trigger language plpgsql security definer set search_path=public as $$ declare d jsonb; begin d=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end; insert into audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,d->>'id'); if TG_OP='UPDATE' and d ? 'status' and (to_jsonb(old)->>'status') is distinct from (to_jsonb(new)->>'status') then insert into content_publications(entity,entity_id,status,actor_id) values(TG_TABLE_NAME,new.id,new.status,auth.uid()); end if; return null; end $$;
do $$ declare t text; begin foreach t in array array['courses','lessons','tests','writing_tasks','speaking_tasks','mock_exams','platform_settings'] loop execute format('create trigger content_audit after insert or update or delete on public.%I for each row execute function public.audit_content()',t); end loop; end $$;
-- Grants are explicit. Internal helpers cannot be invoked to forge activity.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.has_role(text),public.can_review(uuid),public.course_visible(uuid),public.lesson_visible(uuid),public.test_visible(uuid) to authenticated;
grant execute on function public.save_onboarding(jsonb,boolean),public.start_test(uuid),public.save_answers(uuid,jsonb),public.submit_test(uuid),public.writing_draft(uuid,text,boolean,uuid),public.enroll_course(uuid),public.complete_lesson(uuid),public.add_recording(uuid,text),public.review_submission(text,uuid,numeric,jsonb,text),public.start_mock(uuid),public.link_mock_section(uuid,uuid,uuid),public.reserve_ai(text,uuid,text) to authenticated;
grant execute on function public.consume_rate_limit(text,int,int) to service_role;
grant usage on schema public to authenticated,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
