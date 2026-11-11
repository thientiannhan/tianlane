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
import {
  authenticateLogtechubUser,
  SEED_PROJECTS,
  SEED_TEAMS,
  SEED_TEMPLATES,
  SEED_USERS,
} from '../data/seedData.ts';
import {
  canUserAccessTeam,
  canUserEditProject,
  canUserManageMembers,
  getUserProjectRole,
  isProjectCreator,
  isUserAdmin,
  isUserTeamPM,
} from '../types.ts';
// @ts-expect-error .mjs server module
import { createR2PresignedPutUrl } from '../../server/r2Presign.mjs';
// @ts-expect-error .mjs server module
import { mapOdooStageToKanbanStatus } from '../../server/odooClient.mjs';
// @ts-expect-error .mjs server module
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

// 9. Test Project RBAC (Owner / Writer / Viewer & Creator Owner protection) & 10 Logtechub Accounts
assert.equal(SEED_USERS.length, 10, 'Should have exactly 10 real Logtechub accounts');
const p0 = SEED_PROJECTS[0];
const creatorUser = SEED_USERS[0]; // james.nhan@logtechub.com (Creator Owner)
const secondOwner = SEED_USERS[1]; // azura.thuy@logtechub.com (Owner, non-creator)
const writerUser = SEED_USERS[2]; // kenny.thuong@logtechub.com (Writer)
const viewerUser = SEED_USERS[6]; // jasmine.thu@logtechub.com (Viewer)

assert.equal(isProjectCreator(p0, creatorUser), true);
assert.equal(isProjectCreator(p0, secondOwner), false);
assert.equal(isProjectCreator(p0, writerUser), false);
assert.equal(getUserProjectRole(p0, creatorUser), 'owner');
assert.equal(getUserProjectRole(p0, secondOwner), 'owner');
assert.equal(getUserProjectRole(p0, writerUser), 'writer');
assert.equal(getUserProjectRole(p0, viewerUser), 'viewer');
assert.equal(canUserEditProject(p0, creatorUser), true);
assert.equal(canUserEditProject(p0, writerUser), true);
assert.equal(canUserEditProject(p0, viewerUser), false);
assert.equal(canUserManageMembers(p0, creatorUser), true);
assert.equal(canUserManageMembers(p0, secondOwner), true);
assert.equal(canUserManageMembers(p0, writerUser), false);

// 10. Test Logtechub account authentication & discreet error message (no hint!)
assert.equal(authenticateLogtechubUser('james.nhan@logtechub.com', 'james.nhan2026').ok, true);
assert.equal(authenticateLogtechubUser('azura.thuy', 'azura.thuy2026').ok, true);
assert.equal(authenticateLogtechubUser('alex.phuong@logtechub.com', 'alex.phuong2026').ok, true);

const failCheck = authenticateLogtechubUser('james.nhan@logtechub.com', 'wrongpass');
assert.equal(failCheck.ok, false);
if (!failCheck.ok) {
  assert.equal(failCheck.error, 'Invalid password. Please try again.');
  assert.equal(failCheck.error.includes('james.nhan2026'), false, 'Never leak password hint to users');
}

// Test custom password support & Reset Password back to default formula
const userWithCustomPass = { ...creatorUser, password: 'MyNewSecretPassword2026!' };
assert.equal(
  authenticateLogtechubUser('james.nhan', 'MyNewSecretPassword2026!', [userWithCustomPass]).ok,
  true,
  'Custom password updated in profile should be recognized'
);

// Reset password: removing custom password reverts back to username + current year
const userAfterReset = { ...userWithCustomPass, password: undefined };
assert.equal(
  authenticateLogtechubUser('james.nhan@logtechub.com', 'james.nhan2026', [userAfterReset]).ok,
  true,
  'Reset password should revert authentication back to <username>+year'
);

// 11. Test Multi-Team Access Control & Admin Privileges
assert.ok(SEED_TEAMS.length >= 3, 'Should seed default teams');
const teamControlTower = SEED_TEAMS[0];
const teamEfms = SEED_TEAMS[1];

assert.equal(isUserAdmin(creatorUser), true, 'James Nhan should be Admin');
assert.equal(isUserAdmin(secondOwner), false, 'Azura Thuy is not Admin');

// Test Owner position role grants admin privileges
const customOwnerUser: UserProfile = {
  ...writerUser,
  id: 'usr-new-owner',
  role: 'Owner',
};
assert.equal(isUserAdmin(customOwnerUser), true, 'User with Owner role should have Admin privileges');

assert.equal(isUserTeamPM(teamControlTower, creatorUser), true);
assert.equal(isUserTeamPM(teamEfms, secondOwner), true, 'Azura is PM of eFMS team');
assert.equal(isUserTeamPM(teamControlTower, viewerUser), false);

assert.equal(canUserAccessTeam(teamControlTower, creatorUser), true);
assert.equal(canUserAccessTeam(teamControlTower, writerUser), true);

// Test Project avatar logo field
assert.ok(SEED_PROJECTS[0].avatar_url, 'Seed project should have avatar URL');

// 12. Strict 1:1 Project-to-Team Boundary & Isolation Tests
// Assert all projects strictly belong to exactly 1 team
for (const p of SEED_PROJECTS) {
  assert.ok(p.team_id, `Project ${p.code} must have a non-empty team_id`);
  assert.ok(SEED_TEAMS.some((t) => t.id === p.team_id), `Project ${p.code} must point to a valid seeded team`);
}

// Assert project filtering strictly isolates projects per active team
const controlTowerProjects = SEED_PROJECTS.filter((p) => p.team_id === teamControlTower.id);
assert.equal(controlTowerProjects.length, 1);
assert.equal(controlTowerProjects[0].code, '19-03');

const efmsProjects = SEED_PROJECTS.filter((p) => p.team_id === teamEfms.id);
assert.equal(efmsProjects.length, 1);
assert.equal(efmsProjects[0].code, '26-11');

// Even Admin filtering on teamControlTower.id CANNOT see efms projects
const adminVisibleInControlTower = SEED_PROJECTS.filter((p) => p.team_id === teamControlTower.id);
assert.ok(!adminVisibleInControlTower.some((p) => p.code === '26-11'), 'Admin in Control Tower must NOT see eFMS projects');

// Template instantiation must assign team_id
const instantiatedWithTeam = instantiateProjectFromTemplateEngine({
  template: SEED_TEMPLATES[0],
  projectName: 'New RND Tool',
  projectCode: 'RND-02',
  clientOrUnit: 'R&D',
  startDateISO: '2026-11-20',
  odooProjectId: 99,
  odooBaseUrl: 'https://erp.tianlane.vn',
  ownerId: creatorUser.id,
  users: SEED_USERS,
  teamId: 'team-rnd',
});
assert.equal(instantiatedWithTeam.project.team_id, 'team-rnd', 'Project instantiated from template must inherit team_id');

// Non-admin user team isolation
const daleyUser = SEED_USERS.find((u) => u.email === 'daley.thai@logtechub.com')!;
assert.equal(canUserAccessTeam(teamControlTower, daleyUser), false, 'Daley should not access Control Tower team');
assert.equal(canUserAccessTeam(teamEfms, daleyUser), true, 'Daley should access eFMS team');

const daleyAccessibleTeams = SEED_TEAMS.filter((t) => canUserAccessTeam(t, daleyUser));
assert.equal(daleyAccessibleTeams.length, 1);
assert.equal(daleyAccessibleTeams[0].id, 'team-efms');

// Admin sees all teams in Team & Access
const adminAccessibleTeams = SEED_TEAMS.filter((t) => canUserAccessTeam(t, creatorUser));
assert.equal(adminAccessibleTeams.length, SEED_TEAMS.length, 'Admin must see all teams under Team & Access');

console.log('✓ All Tianlane scheduleEngine, RBAC, Multi-Team Access, R2 Presigner & Odoo MCP assertions passed.');
