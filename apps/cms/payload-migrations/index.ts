import * as migration_20261027_203229_cms_payload_core from './20261027_203229_cms_payload_core';

export const migrations = [
  {
    up: migration_20261027_203229_cms_payload_core.up,
    down: migration_20261027_203229_cms_payload_core.down,
    name: '20261027_203229_cms_payload_core'
  },
];
