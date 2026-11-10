import assert from 'node:assert/strict';
import {
  addDaysISO,
  calculateMilestoneProgress,
  canCloseMilestoneGate,
  diffDaysISO,
  evaluateMilestoneHealth,
  instantiateProjectFromTemplateEngine,
  mapOdooStageToKanban,
  validateAttachmentFileSize,
} from './scheduleEngine.ts';
import { SEED_TEMPLATES, SEED_USERS } from '../data/seedData.ts';
import { createR2PresignedPutUrl } from '../../server/r2Presign.mjs';
import { mapOdooStageToKanbanStatus } from '../../server/odooClient.mjs';
import { MCP_TOOLS_MANIFEST } from '../../server/apiRouter.mjs';

// 1. Test relative day offset & Baseline vs Actual variance calculation
assert.equal(addDaysISO('2026-11-01', 14), '2026-11-15');
assert.equal(diffDaysISO('2026-11-10', '2026-11-14'), 4, 'Should report +4 days delay');
assert.equal(diffDaysISO('2026-11-10', '2026-11-08'), -2, 'Should report -2 days ahead');

// 2. Test Standard Template instantiation (MOD-01)
const instantiated = instantiateProjectFromTemplateEngine({
  template: SEED_TEMPLATES[0],
  projectName: 'Hệ thống CRM v2',
  projectCode: '26-12',
  clientOrUnit: 'Khối Công Nghệ Số',
  startDateISO: '2026-11-16',
  odooProjectId: 45,
  odooBaseUrl: 'https://erp.tianlane.vn',
  ownerId: SEED_USERS[0].id,
  users: SEED_USERS,
});

assert.equal(instantiated.project.code, '26-12');
assert.equal(instantiated.milestones.length, 5, 'Should instantiate all 5 standard phases');
assert.ok(instantiated.tasks.length >= 10, 'Should instantiate all default tasks');
assert.equal(instantiated.milestones[0].planned_start, '2026-11-16');

// 3. Test Milestone progress aggregation & Phase-Gate Blocker Radar (MOD-02 / MOD-03)
const m0 = instantiated.milestones[0];
const m0Tasks = instantiated.tasks.filter((t) => t.milestone_id === m0.id);
assert.equal(calculateMilestoneProgress(m0Tasks), 0);

const gateCheckBlocked = canCloseMilestoneGate(m0, m0Tasks, []);
assert.equal(gateCheckBlocked.allowed, false, 'Gate must block closing when gate_blocker task is not done');
assert.ok(gateCheckBlocked.blockers.length > 0);

// 4. Test Supabase 50MB file size boundary validation (MOD-04)
assert.equal(validateAttachmentFileSize(12 * 1024 * 1024).valid, true);
assert.equal(validateAttachmentFileSize(55 * 1024 * 1024).valid, false);

// 5. Test Odoo stage -> Kanban mapping (MOD-06)
assert.equal(mapOdooStageToKanban('In Progress'), 'in_progress');
assert.equal(mapOdooStageToKanban('UAT / QA Review'), 'review');
assert.equal(mapOdooStageToKanban('Done'), 'done');

// 6. Test evaluateMilestoneHealth for ongoing phase ("No end date")
const ongoingHealth = evaluateMilestoneHealth(
  { ...m0, is_ongoing_phase: true, actual_end: null },
  m0Tasks,
  '2026-11-20'
);
assert.equal(ongoingHealth.health, 'warning');

// 7. Test Cloudflare R2 Stateless Presigned URL Generator & 50MB Limit
const presigned = createR2PresignedPutUrl({
  fileName: 'eFMS_Blueprint_v1.0.pdf',
  contentType: 'application/pdf',
  fileSizeBytes: 3_450_000,
  projectId: '26-11',
  env: {
    R2_ACCOUNT_ID: 'acc12345',
    R2_ACCESS_KEY_ID: 'AKIATESTKEY',
    R2_SECRET_ACCESS_KEY: 'secretkey1234567890',
    R2_BUCKET_NAME: 'tianlane-deliverables',
    R2_PUBLIC_DOMAIN: 'https://pub-tianlane.r2.dev',
  },
});
assert.equal(presigned.configured, true);
assert.ok(presigned.uploadUrl?.includes('X-Amz-Signature='));
assert.throws(() =>
  createR2PresignedPutUrl({
    fileName: 'oversized.zip',
    fileSizeBytes: 55 * 1024 * 1024,
  })
);

// 8. Test Logistics TechHub Odoo Stage Mapping & 6 MCP Tools Manifest
assert.equal(mapOdooStageToKanbanStatus('Sprint Backlog'), 'todo');
assert.equal(mapOdooStageToKanbanStatus('Sprint in Progress'), 'in_progress');
assert.equal(mapOdooStageToKanbanStatus('Ready to Deploy'), 'review');
assert.equal(mapOdooStageToKanbanStatus('Sprint Complete'), 'done');
assert.equal(mapOdooStageToKanbanStatus('Deployed in Production'), 'done');
assert.equal(MCP_TOOLS_MANIFEST.length, 6, 'Should expose all 6 PO governance MCP tools');

console.log('✓ All Tianlane scheduleEngine, R2 Presigner & Odoo MCP self-check assertions passed.');
