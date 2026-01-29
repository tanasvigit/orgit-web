# Deep Analysis: orgit-api + orgit-mobile → orgit-web

**Purpose:** Use orgit-api (backend) and orgit-mobile (reference UI/flows) to implement orgit-web **without modifying** orgit-api or orgit-mobile. All changes are **web-only**.

**Constraint:** Never change orgit-api or orgit-mobile. Replicate behavior and UI in orgit-web by calling the same APIs and matching mobile flows.

---

## 1. API Overview (orgit-api)

### 1.1 Mounted Routes (from `src/index.ts`)

| Prefix | Purpose |
|--------|--------|
| `/api/auth` | Login, register, OTP, profile, contacts sync, `/me`, `/user/:userId` |
| `/api/messages` | Send, list, mark-read, search, edit, delete, reactions, star, pin, forward, uploads (image/video/audio/document/voice_note) |
| `/api/groups` | Create, list, get, members, add/remove, update |
| `/api/tasks` | CRUD, accept, reject, status, assignees, mark complete, verify, compliance link |
| `/api/dashboard` | GET `/`, GET `/statistics` |
| `/api/notifications` | List, mark read, mark all read, delete |
| `/api/documents` | List, get, upload (Super Admin), update, status, delete |
| `/api/document-instances` | Create, list, get, update, delete, download |
| `/api/chat/users` | GET `/?q=...&limit=...` (search users for chat) |
| `/api/conversations` | List, create direct, get, users/list, pin, groups/create, groups/task-group, members add/remove, update group |
| `/api/contacts` | POST `/match` (match device contacts with users) |
| `/api/organization/data` | GET (authenticated, my org data) |
| `/api/super-admin/organizations` | Org CRUD (Super Admin) |
| `/api/super-admin/document-templates` | Template CRUD, active, versions, preview (Super Admin) |
| `/api/super-admin/tasks` | Task monitoring (Super Admin) |
| `/api/super-admin/dashboard` | Super Admin dashboard |
| `/api/super-admin/users` | User management (Super Admin) |
| `/api/super-admin/settings` | Platform settings: reminder, auto-escalation, recurring-tasks (Super Admin only) |
| `/api/admin` | Role update (Super Admin), organization CRUD (admin) |
| `/api/admin/departments` | Department CRUD (Admin/Super Admin, require org) |
| `/api/admin/designations` | Designation CRUD (Admin/Super Admin, require org) |
| `/api/admin/employees` | Employee CRUD (Admin/Super Admin, require org) |
| `/api/compliance` | List, categories, get, documents; create/update/status/delete + document upload (Admin/Super Admin) |

**Note:** Mobile `settingsService` calls `/api/settings/reminder` etc. — API actually mounts these under **`/api/super-admin/settings`** (reminder, auto-escalation, recurring-tasks). So orgit-web Admin settings that need these must call `/api/super-admin/settings` only if the user is Super Admin, or the backend may expose an admin-scoped settings route later (do not change API; use what exists).

---

## 2. Mobile Module Map (orgit-mobile)

### 2.1 Tabs & Screens

| Tab | Screen | Service / API used |
|-----|--------|--------------------|
| Dashboard | `DashboardScreen` | `dashboardService.getDashboard`, `getStatistics`, `getTask` |
| Chat | `ConversationsScreen` → `ChatScreen`, `NewChatScreen`, `TaskDetailScreen` | `conversationService`, `messageService`, `taskService` |
| Task | `TaskDashboardScreen` → `TaskDetailScreen`, `ChatScreen` (task chat) | `taskService`, `conversationService` (task-group), `getTaskMembers` |
| Document | `DocumentScreen` → Library, Create, View, Edit, TemplateBuilder | `documentService` (instances), `documentTemplateService` |
| Compliance | `ComplianceScreen` → List, View, CreateEdit | `complianceService` |
| Settings | `SettingsScreen` → Profile, Theme, ChangePassword; Admin: EntityMaster, Departments, Designations, AddEmployee, ReminderConfig, etc. | `authService`, `settingsService` |

### 2.2 Key Mobile Flows (to replicate in web)

- **Auth:** Login (password), Register (name, phone, password, role fixed to employee), OTP (request + verify), Profile update, Contacts sync.
- **Dashboard:** Statistics (self/assigned counts: Overdue, DueSoon, InProgress, Completed); Self Tasks / Assigned Tasks by category (general, documentManagement, complianceManagement); each task card shows status; tap → Task Detail.
- **Tasks:** List (filters: type, status); Create (title, description, task_type, assignees, reporting_member_id optional, dates, recurrence); Detail: Accept/Reject (assignee), Mark Complete (assignee), Verify (creator/reporting), Add Assignees (contacts + search by phone); Task Chat = conversation linked to task (`createTaskGroupConversation`), entered after accept.
- **Chat:** Conversations list; Direct and group chats; Task group chat (created when first assignee accepts); Messages: text, image, video, audio, document, location, voice_note; reactions, star, pin, search.
- **Documents:** Document instances from templates (create, list, view, edit, download); Document templates (Super Admin: list, create, edit, Template Builder).
- **Compliance:** List (filters), View, Create/Edit (Admin), categories, status, documents.
- **Settings:** Profile, Theme, Change password; Admin: Entity Master, Departments, Designations, Add Employee, Reminder config, Auto-escalation, Recurring tasks, Reporting hierarchy (mobile calls `/api/organization/hierarchy` — confirm if exists in API).

---

## 3. API Contract Summary by Module

### 3.1 Auth (`/api/auth`)

- `POST /request-otp` — body: `{ mobile }` (e.g. +91…)
- `POST /verify-otp` — body: `{ mobile, otpCode }`
- `POST /login` — body: `{ mobile, password }` → `{ success, data: { user, token } }`
- `POST /register` — body: `{ name, phone, password, role? }` (role optional, backend may fix to employee)
- `GET /me` — auth required → current user
- `GET /user/:userId` — auth required
- `PUT /profile` — body: `{ name, about?, contact_number?, profile_photo? }`
- `POST /contacts/sync` — body: `{ contacts: [{ name, mobile }] }`

### 3.2 Tasks (`/api/tasks`)

- `GET /` — query: `type`, `status`, `priority` (optional). Returns `{ tasks }` with assignees, `conversation_id`, `current_user_status`, etc.
- `GET /:id` — single task with assignees, reporting_member info, conversation_id
- `POST /` — body: `title`, `due_date`, `task_type?`, `priority?`, `assignee_ids?`, `reporting_member_id?` (must be one of assignee_ids), plus optional: description, start_date, target_date, recurrence_type, etc.
- `POST /:id/accept` — assignee accepts
- `POST /:id/reject` — body: `{ reason }`
- `PATCH /:id/status` — body: `{ status }` (pending | in_progress | completed | rejected)
- `PATCH /:id` — update task (updateTask)
- `GET /:id/assignees` — get assignees (query `all=true` for all members)
- `POST /:id/assignees` — body: `{ assignee_ids }`
- `POST /:id/members/:userId/complete` — mark member complete (self)
- `POST /:id/members/:userId/verify` — verify member (creator/reporting)
- Compliance: `POST /:taskId/compliance`, `DELETE /:taskId/compliance/:complianceId`, `GET /:taskId/compliance`

**Task response shape (relevant for web):**  
`id`, `title`, `description`, `task_type`, `status`, `due_date`, `start_date`, `target_date`, `creator_id`/`created_by`, `reporting_member_id`, `assignees` (array with `id`, `name`, `accepted_at`, `completed_at`, `verified_at`, etc.), `conversation_id`, `current_user_status`, `accepted_count`, `total_assignees`.

### 3.3 Dashboard (`/api/dashboard`)

- `GET /` — query: `dueSoonDays?`. Returns `{ success, data }` with:
  - `selfTasks`: `{ general, documentManagement, complianceManagement }` each `{ overdue, dueSoon, inProgress, completed }` (arrays of tasks)
  - `assignedTasks`: same structure
- `GET /statistics` — Returns `{ success, data }` with counts:  
  `selfTasksOverdue`, `selfTasksDueSoon`, `selfTasksInProgress`, `selfTasksCompleted`,  
  `assignedTasksOverdue`, `assignedTasksDueSoon`, `assignedTasksInProgress`, `assignedTasksCompleted`

**Web must:** Use same API; compute “Self” counts for dashboard from **assignee-level** fields (`completed_at`, `verified_at`) when needed (e.g. for “Self Completed” / “Self In Progress”) to match mobile logic (per-member status).

### 3.4 Conversations (`/api/conversations`)

- `GET /` — list conversations
- `POST /create` — body: `{ otherUserId }` → `conversationId`
- `GET /:conversationId` — details (include `task_id` for task groups so web can navigate to task)
- `GET /users/list` — all users
- `PUT /:conversationId/pin` — body: `{ is_pinned }`
- `POST /groups/create` — body: `{ name, memberIds, group_photo? }`
- `POST /groups/task-group` — body: `{ taskId, name, memberIds }` → task group conversation
- `POST /groups/:conversationId/members` — body: `{ memberIds }`
- `DELETE /groups/:conversationId/members/:memberId`
- `PUT /groups/:conversationId` — body: `{ name?, group_photo? }`

### 3.5 Messages (`/api/messages`)

- `POST /send` — body: messageType (text, image, video, audio, document, location, contact, voice_note), content, conversationId, etc.
- `GET /?receiverId=&groupId=&limit=` — legacy chat messages
- `GET /:conversationId` — messages by conversation (supports UUID or `direct_<userId>`)
- `PUT /:conversationId/read` — mark read
- `PUT /:messageId` — edit (body: `content`)
- `DELETE /:messageId` — delete
- Star: `POST /:messageId/star`, `DELETE /:messageId/star`; `GET /starred/all`
- Reactions: `POST /:messageId/reactions` (body: `reaction`), `DELETE /:messageId/reactions/:reaction`
- Search: `GET /search/:conversationId?` query `query`, `limit`
- Uploads: `POST /upload/image`, `/upload/video`, `/upload/audio`, `/upload/document`, `/upload/voice-note` (multipart)

### 3.6 Documents & Templates

- **Documents:** `GET /documents`, `GET /documents/:id`, `POST /` (Super Admin), `PUT /:id`, `PATCH /:id/status`, `DELETE /:id`
- **Instances:** `GET /document-instances`, `GET /document-instances/:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /:id/download`
- **Templates:**  
  - All: `GET /super-admin/document-templates/active` (all roles with org), `GET /super-admin/document-templates/:id`  
  - Super Admin: `GET /super-admin/document-templates`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /:id/versions`, `POST /:id/preview`

### 3.7 Compliance (`/api/compliance`)

- `GET /`, `GET /categories`, `GET /:id`, `GET /:id/documents`
- Admin/Super Admin: `POST /`, `PUT /:id`, `PATCH /:id/status`, `DELETE /:id`, `POST /:id/documents` (upload), `DELETE /:id/documents/:docId`

### 3.8 Admin (org-scoped)

- **Organization:** `GET /api/organization/data` (my org); Admin: `GET/POST/PUT /api/admin/organization`
- **Departments:** CRUD at `/api/admin/departments`
- **Designations:** CRUD at `/api/admin/designations`
- **Employees:** CRUD at `/api/admin/employees` (add with optional `user_id` for existing OrgIT user; password optional when user_id provided)

### 3.9 Notifications

- `GET /api/notifications` — query: `limit`, `unreadOnly`
- `POST /:notificationId/read`, `POST /read-all`, `DELETE /:notificationId`

### 3.10 Chat users & Contacts

- `GET /api/chat/users?q=&limit=` — search users (for assignees, new chat)
- `POST /api/contacts/match` — body: `{ contacts: [{ mobile }] }` — match device contacts to users

---

## 4. orgit-web Current State vs Reference

### 4.1 Already Aligned (from conversation summary)

- Task completion flow: Mark Complete → Pending Approval → Verify → Completed (using `completed_at` / `verified_at` and assignee-level logic).
- Role-based permissions: creator, assignee, reporting member; creator has no Accept/Reject.
- “Reporting to” field in task create (modal and full screen).
- Task group access: guard screen Accept/Reject; after accept, navigate to task chat; header click → full Task Details page; `effectiveTaskId` from conversation details (`task_id`/`taskId`).
- Rejected tasks hidden (client-side + backend flags).
- Dashboard “Self” counts computed from assignee status (e.g. verified_at, completed_at), not only global task status.
- Task card badges: viewer status (Completed, Pending Review, In Progress, Pending) from current user’s assignee status.
- Compliance module removed from web (commented out).
- Task priority removed from web UI (API still has optional priority in validation; web does not send/use it).
- Employee form: auto-fill name from mobile search; hide password when existing user; API supports `user_id` without password.

### 4.2 Web Service vs API (fix only in web)

- **taskService:**  
  - `getTaskAssignments` → API has `GET /tasks/:id/assignees` (web should use `getTaskAssignees` or same path with `/assignees`).  
  - `updateTask` → API uses `PATCH /:id` (ensure web uses PATCH and correct payload).  
  - No `reporting_member_id` in web create payload — ensure create payload includes `reporting_member_id` when “Reporting to” is set.
- **dashboardService:**  
  - Response: `data.data` or `data` for dashboard and statistics; ensure web reads `data.selfTasks`, `data.assignedTasks`, `data` (statistics) correctly and uses same count keys (e.g. `selfTasksOverdue`).
- **conversationService:**  
  - Ensure `getConversationDetails` returns `task_id` / `taskId` so task chat header can navigate to `/tasks/:taskId` or `/admin/tasks/:taskId`.

### 4.3 Settings / Platform settings

- Reminder, auto-escalation, recurring-tasks: only under `/api/super-admin/settings` in API.  
- Mobile calls `/api/settings/reminder` etc. — if API has no separate admin settings routes, web Admin settings that need these either:  
  - Show only for Super Admin and call `/api/super-admin/settings`, or  
  - Hide/disable those screens for Admin until backend adds admin-scoped endpoints (do not change API).

---

## 5. Module-Wise Implementation Order (for orgit-web)

Suggested order to implement or refine **without changing orgit-api or orgit-mobile**:

1. **Auth & profile**  
   - Login, Register, OTP (if used on web), Profile update, Change password.  
   - Ensure phone format (+international) and payload match API.

2. **Dashboard**  
   - Use `/api/dashboard` and `/api/dashboard/statistics`.  
   - Self/Assigned sections; status counts; task cards with viewer status; link to Task Detail and Task Chat where applicable.

3. **Tasks (core)**  
   - List (filters: type, status); Create (with reporting_member_id, assignee_ids, dates); Detail (Accept/Reject, Mark Complete, Verify, Add Assignees).  
   - Task chat: create/join task group conversation; header → Task Details; hide rejected tasks.

4. **Chat & messaging**  
   - Conversations list; direct/group/task-group chats; messages (text, media, voice_note if supported); mark read; reactions; search.  
   - Ensure conversation details include `task_id` for task chat navigation.

5. **Documents**  
   - Document instances: list, create, view, edit, download (same API as mobile).  
   - Document templates: for Super Admin — list, create, edit, Template Builder; use `/api/super-admin/document-templates` and preview/versions where needed.

6. **Compliance**  
   - Currently commented out on web. When re-enabling: list, view, create/edit (Admin), categories, status, documents — use same API as mobile without changing API.

7. **Settings**  
   - Profile, Theme, Change password.  
   - Admin: Entity Master (org data), Departments, Designations, Add Employee (with user search and optional password); Reminder / Auto-escalation / Recurring tasks only where API allows (e.g. Super Admin only today).  
   - Do not add `/api/organization/hierarchy` or `/api/settings/*` if not present in API; use only existing routes.

8. **Notifications**  
   - List, mark read, mark all read, delete; optional badge counts for nav (if API supports).

9. **Super Admin**  
   - Orgs, document templates, task monitoring, users, platform settings — all via existing super-admin routes.

---

## 6. Checklist Per Module (web-only changes)

Use this to go “one by one, module wise”:

- [ ] **Auth:** Login/Register/OTP payload and response handling; profile update; token storage.
- [ ] **Dashboard:** GET dashboard + statistics; Self/Assigned UI; correct count keys; task card status from assignee; links to task detail/chat.
- [ ] **Tasks:** Create (reporting_member_id, assignee_ids); Detail (roles, Accept/Reject, Complete, Verify, Add Assignees); list filters; rejected hidden; task chat route and header → task detail.
- [ ] **Chat:** Conversation list; create direct/group/task-group; messages by conversationId; send text/media; mark read; reactions; conversation details `task_id` for task chat.
- [ ] **Documents:** Instances CRUD + download; templates (Super Admin) CRUD + builder/preview.
- [ ] **Compliance:** (When re-enabled) List, view, create/edit, categories, documents — API-aligned.
- [ ] **Settings:** Profile, theme, password; Admin: Entity, Departments, Designations, Employees (with user_id/password logic); Reminder/Escalation/Recurring only per API scope.
- [ ] **Notifications:** List, read, read-all, delete; nav badges if applicable.
- [ ] **Super Admin:** Orgs, templates, tasks, users, platform settings — all read-only of API behavior.

This document is the single reference for implementing orgit-web functionality and UI from orgit-api and orgit-mobile without changing either of them.
