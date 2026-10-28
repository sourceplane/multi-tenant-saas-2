import * as migration_20261027_203229_cms_payload_core from './20261027_203229_cms_payload_core';
import * as migration_20261027_213624_lms_course_model from './20261027_213624_lms_course_model';

export const migrations = [
  {
    up: migration_20261027_203229_cms_payload_core.up,
    down: migration_20261027_203229_cms_payload_core.down,
    name: '20261027_203229_cms_payload_core',
  },
  {
    up: migration_20261027_213624_lms_course_model.up,
    down: migration_20261027_213624_lms_course_model.down,
    name: '20261027_213624_lms_course_model'
  },
];
