import {
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

import { createTable } from '@nozbe/watermelondb/Schema/migrations';

/**
 * WatermelonDB migrations — handles schema changes across app updates.
 *
 * When the schema version in schema.ts is incremented, a corresponding
 * migration step must be added here to safely transform existing local data.
 *
 * Currently at version 1 (initial), so no migrations yet.
 */
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'tasks',
          columns: [
            { name: 'project_id', type: 'string', isIndexed: true },
            { name: 'team_id', type: 'string', isIndexed: true },
            { name: 'description', type: 'string' },
            { name: 'is_completed', type: 'boolean' },
            { name: 'created_by', type: 'string' },
            { name: 'completed_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
});
