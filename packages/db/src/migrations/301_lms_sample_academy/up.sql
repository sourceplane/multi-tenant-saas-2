-- 301_lms_sample_academy: the sample academy (multi-tenant-saas-2-lms, design §5).
--
-- Context: cms
-- One academy, Demo Academy, with one published course, Getting started:
-- three lessons and a three-question quiz (pass at 70%). The product has
-- something to show from its first deploy, and the smoke check looks for it.
-- Ordinary data: an admin can edit or delete it in /admin.
--
-- Hand-written, unlike the generated schema migrations, with fixed ids.
-- Idempotent: every row is inserted ON CONFLICT DO NOTHING, and each child row
-- only if its parent exists, so a partial apply converges on retry and a
-- conflicting row (say, an academy already using the slug) is left alone.

INSERT INTO cms.tenants (id, name, slug, description, enrolment)
VALUES ('00000000-0000-4000-8000-00000000a001', 'Demo Academy', 'demo-academy', 'A sample academy to try the learner experience end to end.', 'open')
ON CONFLICT DO NOTHING;

INSERT INTO cms.courses (id, tenant_id, title, slug, summary, level, _status)
SELECT '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', 'Getting started', 'getting-started', 'How learning works here: lessons, quizzes and certificates, in ten minutes.', 'beginner', 'published'
WHERE EXISTS (SELECT 1 FROM cms.tenants WHERE id = '00000000-0000-4000-8000-00000000a001')
ON CONFLICT DO NOTHING;

-- The version row the admin shows as this course's latest (published) version.
INSERT INTO cms._courses_v (id, parent_id, version_tenant_id, version_title, version_slug, version_summary, version_level, version__status, version_updated_at, version_created_at, latest)
SELECT '00000000-0000-4000-8000-00000000c0f1', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', 'Getting started', 'getting-started', 'How learning works here: lessons, quizzes and certificates, in ten minutes.', 'beginner', 'published', now(), now(), true
WHERE EXISTS (SELECT 1 FROM cms.courses WHERE id = '00000000-0000-4000-8000-00000000c001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.lessons (id, course_id, tenant_id, "order", title, slug, minutes, content)
SELECT '00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', 1, 'Welcome to the academy', 'welcome-to-the-academy', 3, '{"root":{"type":"root","children":[{"type":"heading","tag":"h2","children":[{"type":"text","text":"What this course is","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"version":1},{"type":"paragraph","children":[{"type":"text","text":"This short course shows how learning works here: you read or watch a lesson, mark it complete, and move to the next.","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"textFormat":0,"version":1},{"type":"paragraph","children":[{"type":"text","text":"When every lesson is complete and you pass the quiz, the course is complete and you receive a certificate anyone can verify.","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"textFormat":0,"version":1}],"direction":"ltr","format":"","indent":0,"version":1}}'::jsonb
WHERE EXISTS (SELECT 1 FROM cms.courses WHERE id = '00000000-0000-4000-8000-00000000c001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.lessons (id, course_id, tenant_id, "order", title, slug, minutes, content)
SELECT '00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', 2, 'Lessons and quizzes', 'lessons-and-quizzes', 4, '{"root":{"type":"root","children":[{"type":"heading","tag":"h2","children":[{"type":"text","text":"Lessons","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"version":1},{"type":"paragraph","children":[{"type":"text","text":"A lesson is a page of text, sometimes with a video. Mark it complete when you have finished it; your progress is saved to your account.","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"textFormat":0,"version":1},{"type":"heading","tag":"h2","children":[{"type":"text","text":"Quizzes","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"version":1},{"type":"paragraph","children":[{"type":"text","text":"A quiz is a few multiple-choice questions. It is scored as soon as you submit it, and you can try again if you do not reach the passing score.","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"textFormat":0,"version":1}],"direction":"ltr","format":"","indent":0,"version":1}}'::jsonb
WHERE EXISTS (SELECT 1 FROM cms.courses WHERE id = '00000000-0000-4000-8000-00000000c001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.lessons (id, course_id, tenant_id, "order", title, slug, minutes, content)
SELECT '00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', 3, 'Your certificate', 'your-certificate', 2, '{"root":{"type":"root","children":[{"type":"heading","tag":"h2","children":[{"type":"text","text":"Earning it","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"version":1},{"type":"paragraph","children":[{"type":"text","text":"Your certificate is issued the moment the last requirement is met: every lesson complete and every quiz passed.","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"textFormat":0,"version":1},{"type":"paragraph","children":[{"type":"text","text":"Each certificate has a serial number. Its page is public, so anyone you share the link with can check it is real.","format":0,"detail":0,"mode":"normal","style":"","version":1}],"direction":"ltr","format":"","indent":0,"textFormat":0,"version":1}],"direction":"ltr","format":"","indent":0,"version":1}}'::jsonb
WHERE EXISTS (SELECT 1 FROM cms.courses WHERE id = '00000000-0000-4000-8000-00000000c001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes (id, course_id, tenant_id, title, slug, passing_score)
SELECT '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', 'Check your understanding', 'check-your-understanding', 70
WHERE EXISTS (SELECT 1 FROM cms.courses WHERE id = '00000000-0000-4000-8000-00000000c001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions (_order, _parent_id, id, prompt, correct_index)
SELECT 1, '00000000-0000-4000-8000-00000000e001', '6a0000000000000000000001', 'When is a course complete?', 1
WHERE EXISTS (SELECT 1 FROM cms.quizzes WHERE id = '00000000-0000-4000-8000-00000000e001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 1, '6a0000000000000000000001', '6a0000000000000000000011', 'When I open the first lesson'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 2, '6a0000000000000000000001', '6a0000000000000000000012', 'When every lesson is complete and every quiz is passed'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 3, '6a0000000000000000000001', '6a0000000000000000000013', 'When I enrol'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions (_order, _parent_id, id, prompt, correct_index)
SELECT 2, '00000000-0000-4000-8000-00000000e001', '6a0000000000000000000002', 'What happens if you do not reach the passing score?', 0
WHERE EXISTS (SELECT 1 FROM cms.quizzes WHERE id = '00000000-0000-4000-8000-00000000e001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 1, '6a0000000000000000000002', '6a0000000000000000000021', 'You can try the quiz again'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 2, '6a0000000000000000000002', '6a0000000000000000000022', 'The course is closed to you'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 3, '6a0000000000000000000002', '6a0000000000000000000023', 'Your progress is reset'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions (_order, _parent_id, id, prompt, correct_index)
SELECT 3, '00000000-0000-4000-8000-00000000e001', '6a0000000000000000000003', 'Who can check that a certificate is real?', 2
WHERE EXISTS (SELECT 1 FROM cms.quizzes WHERE id = '00000000-0000-4000-8000-00000000e001')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 1, '6a0000000000000000000003', '6a0000000000000000000031', 'Only the academy'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 2, '6a0000000000000000000003', '6a0000000000000000000032', 'Only you'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO cms.quizzes_questions_options (_order, _parent_id, id, label)
SELECT 3, '6a0000000000000000000003', '6a0000000000000000000033', 'Anyone with its link'
WHERE EXISTS (SELECT 1 FROM cms.quizzes_questions WHERE id = '6a0000000000000000000003')
ON CONFLICT DO NOTHING;
