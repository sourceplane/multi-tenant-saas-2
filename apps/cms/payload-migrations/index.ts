import * as migration_20261027_203229_cms_payload_core from './20261027_203229_cms_payload_core';
import * as migration_20261027_213624_lms_course_model from './20261027_213624_lms_course_model';
import * as migration_20261027_214746_lms_learner_records from './20261027_214746_lms_learner_records';

export const migrations = [
  {
    up: migration_20261027_203229_cms_payload_core.up,
    down: migration_20261027_203229_cms_payload_core.down,
    name: '20261027_203229_cms_payload_core',
  },
  {
    up: migration_20261027_213624_lms_course_model.up,
    down: migration_20261027_213624_lms_course_model.down,
    name: '20261027_213624_lms_course_model',
  },
  {
    up: migration_20261027_214746_lms_learner_records.up,
    down: migration_20261027_214746_lms_learner_records.down,
    name: '20261027_214746_lms_learner_records'
  },
];
