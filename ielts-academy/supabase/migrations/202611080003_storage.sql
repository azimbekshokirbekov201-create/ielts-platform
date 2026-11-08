insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('speaking','speaking',false,26214400,array['audio/webm','audio/ogg','audio/mp4','audio/wav']),
('course-media','course-media',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/wav','video/mp4']) on conflict(id) do nothing;
create policy recording_insert on storage.objects for insert to authenticated with check(bucket_id='speaking' and (storage.foldername(name))[1]=auth.uid()::text and public.has_role('STUDENT'));
create policy recording_read on storage.objects for select to authenticated using(bucket_id='speaking' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.speaking_recordings s where s.storage_path=name and public.can_review(s.user_id))));
create policy course_media_admin on storage.objects for all to authenticated using(bucket_id='course-media' and public.has_role('ADMIN')) with check(bucket_id='course-media' and public.has_role('ADMIN'));
create policy course_media_read on storage.objects for select to authenticated using(bucket_id='course-media' and (
 exists(select 1 from public.lessons l where l.video_url=name and public.lesson_visible(l.id)) or
 exists(select 1 from public.lesson_resources r where r.storage_path=name and public.lesson_visible(r.lesson_id)) or
 exists(select 1 from public.writing_tasks t where t.image_path=name and t.status='published') or
 exists(select 1 from public.test_sections s where s.audio_path=name and public.test_visible(s.test_id))));
