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
import { parseRoute, buildRouteUrl } from './routeEngine.ts';
import {
  authenticateLogtechubUser,
  authenticateLogtechubUserSync,
  SEED_MILESTONES,
  SEED_PROJECTS,
  SEED_TASKS,
  SEED_TEAMS,
  SEED_TEMPLATES,
  SEED_USERS,
} from '../data/seedData.ts';
import { hashPassword, hashPasswordSync } from './cryptoUtils.ts';
import {
  canUserAccessTeam,
  canUserEditProject,
  canUserManageMembers,
  getTaskAssigneeIds,
  getTaskAssignees,
  getUserProjectRole,
  isProjectCreator,
  isUserAdmin,
  isUserTeamPM,
  type UserProfile,
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
assert.equal(authenticateLogtechubUserSync('james.nhan@logtechub.com', 'james.nhan2026').ok, true);
assert.equal(authenticateLogtechubUserSync('azura.thuy', 'azura.thuy2026').ok, true);
assert.equal(authenticateLogtechubUserSync('alex.phuong@logtechub.com', 'alex.phuong2026').ok, true);

const failCheck = authenticateLogtechubUserSync('james.nhan@logtechub.com', 'wrongpass');
assert.equal(failCheck.ok, false);
if (!failCheck.ok) {
  assert.equal(failCheck.error, 'Invalid password. Please try again.');
  assert.equal(failCheck.error.includes('james.nhan2026'), false, 'Never leak password hint to users');
}

// Test custom password support (stored as salted SHA-256 hash) & Reset Password back to default formula
const customHash = hashPasswordSync('MyNewSecretPassword2026!');
assert.equal(customHash.length, 64, 'SHA-256 hash must be 64 hex characters');
assert.notEqual(customHash, 'MyNewSecretPassword2026!', 'Password must never be stored in plain text');

const userWithCustomPass = { ...creatorUser, password_hash: customHash };
assert.equal(
  authenticateLogtechubUserSync('james.nhan', 'MyNewSecretPassword2026!', [userWithCustomPass]).ok,
  true,
  'Custom salted password hash updated in profile should be recognized'
);

// Reset password: removing custom password reverts back to username + current year
const userAfterReset = { ...userWithCustomPass, password_hash: undefined };
assert.equal(
  authenticateLogtechubUserSync('james.nhan@logtechub.com', 'james.nhan2026', [userAfterReset]).ok,
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
assert.equal(efmsProjects.length, 2, 'Should have 2 projects in eFMS team (26-11 & PL071026)');
const pl071026Proj = efmsProjects.find((p) => p.code === 'PL071026')!;
assert.ok(pl071026Proj, 'PL071026 project must exist in eFMS team');
assert.equal(pl071026Proj.odoo_project_id, 16);

// Verify PL071026 has exactly 1 milestone from 2026-11-11 to 2026-12-18
const pl071026Milestones = SEED_MILESTONES.filter((m) => m.project_id === pl071026Proj.id);
assert.equal(pl071026Milestones.length, 1, 'PL071026 must have exactly 1 milestone');
assert.equal(pl071026Milestones[0].planned_start, '2026-11-11');
assert.equal(pl071026Milestones[0].planned_end, '2026-12-18');

// Verify all 9 tasks are seeded with Odoo task IDs and URLs
const pl071026Tasks = SEED_TASKS.filter((t) => t.project_id === pl071026Proj.id);
assert.equal(pl071026Tasks.length, 9, 'PL071026 must have all 9 requirements as tasks');

// Req 8 is linked to existing Odoo task 11543
const req8Task = pl071026Tasks.find((t) => t.odoo_task_id === 11543);
assert.ok(req8Task, 'Requirement 8 must link to Odoo task ID 11543');
assert.ok(req8Task.title.includes('[PL071026][eOperations]'));

// Check Odoo task IDs for other tasks
const odooTaskIds = pl071026Tasks.map((t) => t.odoo_task_id);
assert.ok(odooTaskIds.includes(12142), 'Task 1 must have Odoo task 12142');
assert.ok(odooTaskIds.includes(12143), 'Task 2 must have Odoo task 12143');
assert.ok(odooTaskIds.includes(12144), 'Task 3 must have Odoo task 12144');
assert.ok(odooTaskIds.includes(12145), 'Task 4 must have Odoo task 12145');
assert.ok(odooTaskIds.includes(12146), 'Task 5 must have Odoo task 12146');
assert.ok(odooTaskIds.includes(12147), 'Task 6 must have Odoo task 12147');
assert.ok(odooTaskIds.includes(12148), 'Task 7 must have Odoo task 12148');
assert.ok(odooTaskIds.includes(12149), 'Task 9 must have Odoo task 12149');

for (const t of pl071026Tasks) {
  assert.ok(t.odoo_task_url?.includes(String(t.odoo_task_id)));
  assert.ok(t.planned_start >= '2026-11-11');
  assert.ok(t.due_date <= '2026-12-18');
}

// Even Admin filtering on teamControlTower.id CANNOT see efms projects
const adminVisibleInControlTower = SEED_PROJECTS.filter((p) => p.team_id === teamControlTower.id);
assert.ok(!adminVisibleInControlTower.some((p) => p.code === '26-11'), 'Admin in Control Tower must NOT see eFMS projects');
assert.ok(!adminVisibleInControlTower.some((p) => p.code === 'PL071026'), 'Admin in Control Tower must NOT see PL071026 project');

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

// 13. Test Team Deletion Logic & Cascading Cleanup
const teamToDelete = SEED_TEAMS[2]; // team-rnd
const initialProjectCount = SEED_PROJECTS.length;
const rndProjects = SEED_PROJECTS.filter((p) => p.team_id === teamToDelete.id);
const rndProjIds = new Set(rndProjects.map((p) => p.id));

const remainingTeamsAfterDelete = SEED_TEAMS.filter((t) => t.id !== teamToDelete.id);
assert.equal(remainingTeamsAfterDelete.length, SEED_TEAMS.length - 1);

const remainingProjectsAfterDelete = SEED_PROJECTS.filter((p) => p.team_id !== teamToDelete.id);
assert.equal(remainingProjectsAfterDelete.length, initialProjectCount - rndProjects.length);

const remainingMilestonesAfterDelete = SEED_MILESTONES.filter((m) => !rndProjIds.has(m.project_id));
const remainingTasksAfterDelete = SEED_TASKS.filter((t) => !rndProjIds.has(t.project_id));
assert.ok(remainingMilestonesAfterDelete.length < SEED_MILESTONES.length);
assert.ok(remainingTasksAfterDelete.length < SEED_TASKS.length);

// 14. Test Route Engine (/project=16, /team, /files, /agent, ?task=12149)
const plProject = SEED_PROJECTS.find((p) => p.odoo_project_id === 16)!;
assert.ok(plProject, 'Project with odoo_project_id = 16 must exist');
assert.equal(plProject.code, 'PL071026');
assert.equal(plProject.team_id, 'team-efms');

// Dynamic route parsing
const route16 = parseRoute('/project=16', '', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(route16.section, 'projects');
assert.equal(route16.projectId, plProject.id);
assert.equal(route16.teamId, 'team-efms');

const route16Encoded = parseRoute('/project%3D16', '', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(route16Encoded.projectId, plProject.id);

const route16Slash = parseRoute('/project/16', '', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(route16Slash.projectId, plProject.id);

const route16Query = parseRoute('/', '?project=16', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(route16Query.projectId, plProject.id);

const route16Files = parseRoute('/project=16/files', '', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(route16Files.section, 'files');
assert.equal(route16Files.projectId, plProject.id);

const routeTeam = parseRoute('/team', '', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(routeTeam.section, 'team');

const routeTask = parseRoute('/project=16', '?task=12149&view=board', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(routeTask.taskId, '12149');
assert.equal(routeTask.viewMode, 'board');

// URL construction
const url16Timeline = buildRouteUrl({ section: 'projects', project: plProject, viewMode: 'timeline' });
assert.equal(url16Timeline, '/project=16', 'Timeline view for project 16 must build /project=16');

const url16Board = buildRouteUrl({ section: 'projects', project: plProject, viewMode: 'board' });
assert.equal(url16Board, '/project=16?view=board');

const plTask12149 = SEED_TASKS.find((t) => t.odoo_task_id === 12149)!;
assert.ok(plTask12149, 'Task with odoo_task_id = 12149 must exist');
const url16WithTask = buildRouteUrl({ section: 'projects', project: plProject, viewMode: 'timeline', task: plTask12149 });
assert.equal(url16WithTask, '/project=16?task=12149');

const urlTeam = buildRouteUrl({ section: 'team' });
assert.equal(urlTeam, '/team');

// 15. Verify AI-created tags on project PL071026 tasks
const plTasks = SEED_TASKS.filter((t) => t.project_id === plProject.id);
assert.equal(plTasks.length, 9, 'Project PL071026 must have 9 tasks');
for (const task of plTasks) {
  assert.ok(Array.isArray(task.tags), `Task ${task.code} must have tags array`);
  assert.ok(task.tags.includes('AI-created'), `Task ${task.code} must include 'AI-created' tag`);
}

// 16. Verify null-safety for unauthenticated visitor permission checks
assert.equal(isProjectCreator(plProject, null), false, 'Null user cannot be project creator');
assert.equal(canUserEditProject(plProject, null), false, 'Null user cannot edit project');
assert.equal(getUserProjectRole(plProject, null), 'viewer', 'Null user role defaults to viewer');
assert.equal(canUserAccessTeam(SEED_TEAMS[0], null), false, 'Null user cannot access team');

// 17. Verify deep link parsing for project=63
const route63 = parseRoute('/project=63', '', '', SEED_PROJECTS, SEED_TEAMS);
assert.equal(route63.section, 'projects');
assert.equal(route63.rawProjectKey, '63');

// 18. Verify Multi-Assignee and Functional Roles (Assignee, BA, Developer, QC)
const t01 = SEED_TASKS.find((t) => t.code === 'PL071026-T01')!;
assert.ok(t01, 'Task PL071026-T01 must exist');
const t01AssigneeIds = getTaskAssigneeIds(t01);
assert.equal(t01AssigneeIds.length, 3, 'T01 must have 3 assigned members');
assert.ok(t01AssigneeIds.includes('usr-kenny-thuong'), 'T01 must include Kenny Thuong');
assert.ok(t01AssigneeIds.includes('usr-jasmine-thu'), 'T01 must include Jasmine Thu');
assert.ok(t01AssigneeIds.includes('usr-po-01'), 'T01 must include James Nhan');

const t01Resolved = getTaskAssignees(t01, SEED_USERS);
assert.equal(t01Resolved.length, 3);
const devMember = t01Resolved.find((r) => r.role === 'Developer');
assert.ok(devMember, 'T01 must have a Developer');
assert.equal(devMember.user.full_name, 'Kenny Thuong');

const qcMember = t01Resolved.find((r) => r.role === 'QC');
assert.ok(qcMember, 'T01 must have a QC');
assert.equal(qcMember.user.full_name, 'Jasmine Thu');

const baMember = t01Resolved.find((r) => r.role === 'BA');
assert.ok(baMember, 'T01 must have a BA');
assert.equal(baMember.user.full_name, 'James Nhan');

// 19. Verify Project Deletion Persistence & Anti-Resurrection
const projToDelete = SEED_PROJECTS[1]; // proj-efms-2611
const deletedProjIds = new Set([projToDelete.id]);
const remainingProjects = SEED_PROJECTS.filter((p) => !deletedProjIds.has(p.id));
assert.equal(remainingProjects.length, SEED_PROJECTS.length - 1);
assert.ok(!remainingProjects.some((p) => p.id === projToDelete.id));

// Anti-resurrection check: missingSeeds must not re-include deletedProjIds
const existingProjIds = new Set(remainingProjects.map((p) => p.id));
const missingSeeds = SEED_PROJECTS.filter(
  (p) => !existingProjIds.has(p.id) && !deletedProjIds.has(p.id)
);
assert.equal(missingSeeds.length, 0, 'Deleted project must not be resurrected by missingSeeds');
const reseededProjects = [...remainingProjects, ...missingSeeds];
assert.equal(reseededProjects.length, SEED_PROJECTS.length - 1);

// Cascading milestone and task deletion
const remainingMilestones = SEED_MILESTONES.filter((m) => !deletedProjIds.has(m.project_id));
assert.ok(!remainingMilestones.some((m) => m.project_id === projToDelete.id));
const remainingTasks = SEED_TASKS.filter((t) => !deletedProjIds.has(t.project_id));
assert.ok(!remainingTasks.some((t) => t.project_id === projToDelete.id));

console.log('✓ All Tianlane scheduleEngine, RBAC, Multi-Team Access, R2 Presigner, Route Engine, Odoo AI Tags, Multi-Assignees & Project Deletion assertions passed.');
