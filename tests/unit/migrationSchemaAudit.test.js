import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database Migration Schema Audit & View Column Integrity Tests', () => {
  it('should verify all SQL migration files exist and have valid syntax', () => {
    const migrationsDir = path.resolve('supabase/migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    expect(files.length).toBeGreaterThanOrEqual(5);

    // Track created tables and their added columns across sequential migration execution
    const tableColumns = {}; // { "resident_domain.residents": Set(["id", "full_name", ...]) }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // 1. Detect CREATE TABLE statements
      const createTableRegex = /CREATE\ TABLE\ (?:IF\ NOT\ EXISTS\ )?([\w\.]+)\s*\(([\s\S]*?)\);/gi;
      let tableMatch;
      while ((tableMatch = createTableRegex.exec(sql)) !== null) {
        const tableName = tableMatch[1].trim().toLowerCase();
        const body = tableMatch[2];
        if (!tableColumns[tableName]) {
          tableColumns[tableName] = new Set();
        }

        // Extract column names
        const lines = body.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('--') || trimmed.toUpperCase().startsWith('CONSTRAINT') || trimmed.toUpperCase().startsWith('PRIMARY KEY') || trimmed.toUpperCase().startsWith('UNIQUE')) {
            continue;
          }
          const colMatch = trimmed.match(/^([a-z0-9_]+)\s+/i);
          if (colMatch) {
            tableColumns[tableName].add(colMatch[1].toLowerCase());
          }
        }
      }

      // 2. Detect ALTER TABLE ... ADD COLUMN statements
      const alterRegex = /ALTER\ TABLE\ (?:IF\ EXISTS\ )?([\w\.]+)\s+ADD\ COLUMN\ (?:IF\ NOT\ EXISTS\ )?([a-z0-9_]+)/gi;
      let alterMatch;
      while ((alterMatch = alterRegex.exec(sql)) !== null) {
        const tableName = alterMatch[1].trim().toLowerCase();
        const colName = alterMatch[2].trim().toLowerCase();
        if (!tableColumns[tableName]) {
          tableColumns[tableName] = new Set();
        }
        tableColumns[tableName].add(colName);
      }

      // 3. Detect CREATE OR REPLACE VIEW statements and verify target table columns
      const viewRegex = /CREATE\ (?:OR\ REPLACE\ )?VIEW\ ([\w\.]+)\b[\s\S]*?AS\s+SELECT\s+([\s\S]*?)\s+FROM\s+([\w\.]+)/gi;
      let viewMatch;
      while ((viewMatch = viewRegex.exec(sql)) !== null) {
        const viewName = viewMatch[1].trim().toLowerCase();
        const rawCols = viewMatch[2].trim();
        const targetTable = viewMatch[3].trim().toLowerCase();

        if (rawCols !== '*') {
          const colList = rawCols.split(',').map(c => {
            const parts = c.trim().split(/\s+/);
            return parts[0].toLowerCase();
          });

          const knownCols = tableColumns[targetTable];
          if (knownCols) {
            for (const col of colList) {
              if (col.includes('.')) continue; // skip expressions or table.col
              expect(
                knownCols.has(col),
                `View ${viewName} in ${file} references column "${col}" which is missing on target table ${targetTable}`
              ).toBe(true);
            }
          }
        }
      }
    }
  });
});
