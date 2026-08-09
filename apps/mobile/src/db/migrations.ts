import {
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

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
    // Future migrations go here. Example:
    // {
    //   toVersion: 2,
    //   steps: [
    //     addColumns({
    //       table: 'daily_reports',
    //       columns: [
    //         { name: 'weather_notes', type: 'string', isOptional: true },
    //       ],
    //     }),
    //   ],
    // },
  ],
});
