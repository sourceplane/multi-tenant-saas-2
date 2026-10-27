import type { CollectionConfig, Field } from 'payload'

import { isAdmin } from '../../lib/access'
import { ownOrTenantStaff } from '../../lib/lms-access'

// Learner records. Nobody but an admin writes them through the API: learners
// change them only through the /api/lms services, which run each change in one
// transaction (lms/services.ts). Readable by admins, the academy's
// instructors, and the learner they belong to.
const access = { read: ownOrTenantStaff, create: isAdmin, update: isAdmin, delete: isAdmin }

const tenant: Field = { name: 'tenant', label: 'Academy', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { readOnly: true } }
const learner: Field = { name: 'learner', type: 'relationship', relationTo: 'learners', required: true, index: true }
const course: Field = { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true }

export const Enrolments: CollectionConfig = {
  slug: 'enrolments',
  admin: { defaultColumns: ['learner', 'course', 'status', 'enrolledAt', 'completedAt'], group: 'Learning' },
  access,
  // One enrolment per learner and course, enforced by the database: a double
  // click, a retry or two isolates racing cannot create a second.
  indexes: [{ fields: ['learner', 'course'], unique: true }],
  fields: [
    tenant,
    learner,
    course,
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
      ],
    },
    { name: 'enrolledAt', type: 'date', required: true },
    { name: 'completedAt', type: 'date' },
    // Touched by every service at the start of its transaction: the row lock
    // that makes concurrent changes for one learner and course run in turn.
    { name: 'lastActivityAt', type: 'date', admin: { readOnly: true } },
  ],
}

export const LessonProgress: CollectionConfig = {
  slug: 'lesson-progress',
  labels: { singular: 'Lesson progress', plural: 'Lesson progress' },
  admin: { defaultColumns: ['learner', 'lesson', 'completedAt'], group: 'Learning' },
  access,
  indexes: [{ fields: ['learner', 'lesson'], unique: true }],
  fields: [
    tenant,
    learner,
    course,
    { name: 'lesson', type: 'relationship', relationTo: 'lessons', required: true, index: true },
    { name: 'completedAt', type: 'date', required: true },
  ],
}

export const QuizAttempts: CollectionConfig = {
  slug: 'quiz-attempts',
  admin: { defaultColumns: ['learner', 'quiz', 'score', 'passed', 'submittedAt'], group: 'Learning' },
  access,
  fields: [
    tenant,
    learner,
    course,
    { name: 'quiz', type: 'relationship', relationTo: 'quizzes', required: true, index: true },
    { name: 'score', type: 'number', required: true, min: 0, max: 100 },
    { name: 'passed', type: 'checkbox', required: true, defaultValue: false, index: true },
    // The chosen option per question, zero-based; -1 for unanswered.
    { name: 'answers', type: 'json', required: true },
    { name: 'submittedAt', type: 'date', required: true },
  ],
}

export const Certificates: CollectionConfig = {
  slug: 'certificates',
  admin: { useAsTitle: 'serial', defaultColumns: ['serial', 'learner', 'course', 'issuedAt'], group: 'Learning' },
  access,
  indexes: [{ fields: ['learner', 'course'], unique: true }],
  fields: [
    tenant,
    learner,
    course,
    // Public: anyone with the serial can verify the certificate.
    { name: 'serial', type: 'text', required: true, unique: true, index: true },
    { name: 'issuedAt', type: 'date', required: true },
  ],
}
