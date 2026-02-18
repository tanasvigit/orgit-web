# Compliance Management - Full Process Flow

## Overview
The Compliance Management system supports three user roles: **Super Admin**, **Admin**, and **Employee**. Each role has different permissions and workflows for managing compliance requirements.

---

## User Roles & Permissions

### 1. Super Admin
- **Scope**: Can create and manage **GLOBAL** compliances (visible to all organizations)
- **Capabilities**:
  - Create new GLOBAL compliances directly
  - View and manage ALL compliances (both GLOBAL and ORG-scoped)
  - Approve/Reject Admin-created ORG compliances
  - Edit any GLOBAL compliance
  - Delete GLOBAL compliances
  - Cannot edit ORG-scoped compliances (read-only)

### 2. Admin (Organization Admin)
- **Scope**: Can create and manage **ORG** compliances (visible only to their organization)
- **Capabilities**:
  - Create new ORG compliances (requires Super Admin approval)
  - Edit their own ORG compliances
  - View all compliances (GLOBAL + their ORG compliances)
  - Cannot edit GLOBAL compliances (read-only)
  - Cannot delete GLOBAL compliances

### 3. Employee
- **Scope**: View-only access
- **Capabilities**:
  - View all compliances (GLOBAL + their organization's ORG compliances)
  - Assign compliance items as tasks to team members
  - Cannot create, edit, or delete compliances

---

## Compliance Lifecycle & Status Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLIANCE LIFECYCLE                         │
└─────────────────────────────────────────────────────────────────┘

1. CREATION PHASE
   ┌─────────────┐
   │   Draft     │ ← Admin creates ORG compliance
   └─────────────┘
        │
        │ Super Admin Reviews
        │
   ┌────┴────┐
   │         │
   ▼         ▼
┌────────┐ ┌──────────┐
│Approved│ │ Rejected │
└────────┘ └──────────┘
   │
   │ Scope changed to GLOBAL
   ▼
┌─────────────┐
│   ACTIVE    │ ← Visible to all organizations
└─────────────┘
   │
   │ Status change
   ▼
┌─────────────┐
│  INACTIVE   │
└─────────────┘
```

---

## Detailed Process Flows

### Flow 1: Super Admin Creates GLOBAL Compliance

**Steps:**
1. Super Admin navigates to `/super-admin/compliance`
2. Views Excel Grid interface (all compliances)
3. Clicks "Add Row" button
4. Fills in compliance details:
   - Title, Category, Description
   - Compliance Type (ONE_TIME or RECURRING)
   - Frequency (if RECURRING: MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY)
   - Legal Information (Applicable Law, Section/Rule Reference, etc.)
   - Applicability (State, Industry, Entity Type, Threshold)
   - Risk & Penalty Information
   - Due Date Information
5. Clicks "Save" on the row
6. Compliance is created with:
   - `scope: 'GLOBAL'`
   - `approvalStatus: 'Approved'`
   - `status: 'ACTIVE'`
7. Compliance is immediately visible to all organizations

**Files Involved:**
- `web/src/screens/super-admin/compliance/ComplianceExcelGrid.tsx`
- `web/src/services/complianceService.ts` (create API)

---

### Flow 2: Admin Creates ORG Compliance (Requires Approval)

**Steps:**
1. Admin navigates to `/compliance` (ComplianceManagementHome)
2. Clicks "Add Compliance" button
3. Views Excel Grid interface (`AdminComplianceExcelGrid`)
4. Clicks "Add Row" button
5. Fills in compliance details (same fields as Super Admin)
6. Clicks "Save" on the row
7. Compliance is created with:
   - `scope: 'ORG'`
   - `approvalStatus: 'Draft'`
   - `status: 'ACTIVE'`
8. Compliance is visible only to the Admin's organization
9. Super Admin receives notification (via custom event/storage)
10. Super Admin views the compliance in their Excel Grid
11. Super Admin can:
    - **Approve**: Changes scope to GLOBAL, approvalStatus to Approved
    - **Reject**: Changes approvalStatus to Rejected

**Approval Process:**
- Super Admin sees Draft ORG compliances highlighted in yellow
- Approve button changes scope to GLOBAL and makes it visible to all orgs
- Reject button marks it as Rejected (stays ORG-scoped)

**Files Involved:**
- `web/src/screens/compliance/ComplianceManagementHome.tsx`
- `web/src/screens/admin/compliance/AdminComplianceExcelGrid.tsx`
- `web/src/screens/super-admin/compliance/ComplianceExcelGrid.tsx` (approval)

---

### Flow 3: Admin Edits Approved ORG Compliance

**Steps:**
1. Admin views approved compliance (approvalStatus: 'Approved')
2. Makes changes via Excel Grid
3. Saves the changes
4. Compliance automatically reverts to:
   - `approvalStatus: 'Draft'` (requires re-approval)
   - `scope: 'ORG'` (remains)
5. Super Admin is notified
6. Super Admin must re-approve to make changes visible again

**Files Involved:**
- `web/src/screens/admin/compliance/AdminComplianceExcelGrid.tsx`
- `web/src/services/complianceService.ts` (update API)

---

### Flow 4: Employee Views Compliance & Assigns as Task

**Steps:**
1. Employee navigates to `/compliance`
2. Views compliance list (table or card view)
3. Can filter by:
   - Category (Tax, Labour, Corporate, Environmental)
   - Status (ACTIVE, INACTIVE)
   - Search (title, description)
4. Clicks on a compliance item to view details
5. Views detailed compliance information:
   - Basic Information
   - Legal Information
   - Applicability
   - Risk & Penalty
   - Due Date Information
6. Can click "Assign as Task" button
7. Modal opens to assign compliance as task:
   - Task Title (pre-filled from compliance)
   - Description (pre-filled)
   - Priority (Low, Medium, High)
   - Due Date (defaults to compliance due date or 30 days)
   - Assignees (select from all users)
8. Task is created with:
   - `compliance_id` linked to the compliance
   - Task type matches compliance type (one_time or recurring)
   - Recurrence settings match compliance frequency
9. Task appears in task management system

**Files Involved:**
- `web/src/screens/compliance/ComplianceManagementHome.tsx`
- `web/src/screens/compliance/ComplianceView.tsx`
- `web/src/services/taskService.ts` (createTask API)

---

## UI Components & Routes

### Super Admin Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/super-admin/compliance` | `ComplianceList` | Lists all compliances (shows Excel Grid for Super Admin) |
| `/super-admin/compliance/create` | `ComplianceForm` | Simple form for creating compliances (alternative to Excel) |
| `/super-admin/compliance/:id` | `ComplianceForm` | View/edit compliance details |
| `/super-admin/compliance/:id/edit` | `ComplianceForm` | Edit compliance (same as above) |

### Admin Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/compliance` | `ComplianceManagementHome` | Main compliance management page |
| `/admin/compliance/:id` | `AdminComplianceForm` | View/edit ORG compliance (detailed form) |

### Employee Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/compliance` | `ComplianceManagementHome` | View compliance list (table/card view) |
| `/compliance/:id` | `ComplianceView` | View detailed compliance (read-only) |

---

## Key Features

### 1. Excel Grid Interface (Super Admin & Admin)
- **Super Admin**: Full Excel-like grid with all compliances
  - Can add rows
  - Can edit cells inline
  - Can approve/reject Draft ORG compliances
  - Can save all changes at once
  - Shows pending approvals count

- **Admin**: Similar Excel grid but only for ORG compliances
  - Can add rows
  - Can edit cells inline
  - Cannot approve/reject
  - Shows approval status (Draft/Approved)

### 2. Filtering & Search
- Filter by Category (Tax, Labour, Corporate, Environmental)
-  (ACTIVE, INACTIVE)
- Filter by Scope (GLOBAL, ORG) - Super Admin only
- Search by title, description

### 3. View Modes (Admin & Employee)
- **Table View**: Detailed tabular format with all columns
- **Card View**: Card-based layout with key information

### 4. Task Assignment
- Convert compliance to task with one click
- Auto-populate task details from compliance
- Link task to compliance via `compliance_id`
- Support for recurring tasks based on compliance frequency

---

## API Endpoints

### Compliance Service (`complianceService.ts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/compliance` | Get all compliances (with filters) |
| `GET` | `/compliance/:id` | Get compliance by ID |
| `POST` | `/compliance` | Create new compliance |
| `PUT` | `/compliance/:id` | Update compliance |
| `PATCH` | `/compliance/:id/status` | Update compliance status |
| `DELETE` | `/compliance/:id` | Delete compliance |
| `GET` | `/compliance/categories` | Get compliance categories |
| `POST` | `/compliance/:id/documents` | Upload document for compliance |
| `GET` | `/compliance/:id/documents` | Get documents for compliance |
| `DELETE` | `/compliance/:id/documents/:docId` | Delete compliance document |

---

## Data Model

### ComplianceMaster Type
```typescript
{
  id: string;
  complianceCode?: string;
  title: string;
  description?: string;
  category: string;
  actName?: string;
  
  // Compliance Type
  complianceType: 'ONE_TIME' | 'RECURRING';
  frequency?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
  
  // Legal Information
  applicableLaw?: string;
  sectionRuleReference?: string;
  governingAuthority?: string;
  jurisdictionType?: string;
  
  // Applicability
  stateApplicability?: string;
  industryApplicability?: string;
  entityTypeApplicability?: string;
  applicabilityThreshold?: string;
  mandatoryFlag?: boolean;
  
  // Risk & Penalty
  riskLevel?: string;
  penaltySummary?: string;
  maxPenaltyAmount?: number;
  imprisonmentFlag?: boolean;
  
  // Due Date Information
  dueDateType?: string;
  dueDate?: Date | string;
  dueDateRule?: string;
  gracePeriodDays?: number;
  complianceFrequency?: string;
  financialYearApplicable?: boolean;
  firstTimeCompliance?: boolean;
  triggerEvent?: string;
  
  // Status & Scope
  status: 'ACTIVE' | 'INACTIVE';
  scope: 'GLOBAL' | 'ORG';
  approvalStatus?: 'Draft' | 'Approved' | 'Rejected';
  
  // Metadata
  version?: string;
  effectiveDate?: Date | string;
  approvedBy?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  organizationId?: string;
}
```

---

## State Management

### React Query Keys
- `['compliance', filters]` - Filtered compliance list
- `['compliance', id]` - Single compliance by ID
- `['compliance', 'all']` - All compliances (Super Admin)
- `['compliance', 'admin', 'all']` - Admin's ORG compliances

### Cross-Tab Communication
- Custom events: `compliance-updated` (notifies Super Admin when Admin creates/updates)
- localStorage: Used for cross-tab communication
- Auto-refetch: Super Admin grid listens for events and refetches data

---

## Key Business Rules

1. **Scope Management**:
   - Super Admin can only create/edit GLOBAL compliances
   - Admin can only create/edit ORG compliances
   - GLOBAL compliances are visible to all organizations
   - ORG compliances are visible only to the creating organization

2. **Approval Workflow**:
   - Admin-created compliances start as `Draft` with `ORG` scope
   - Super Admin approval converts `ORG` → `GLOBAL` and `Draft` → `Approved`
   - Editing an approved ORG compliance reverts it to `Draft` (requires re-approval)

3. **Compliance Type Validation**:
   - `ONE_TIME`: `frequency` must be `null`
   - `RECURRING`: `frequency` is required (MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY)

4. **Delete Permissions**:
   - Super Admin can delete GLOBAL compliances
   - Admin cannot delete GLOBAL compliances
   - Admin can delete their own ORG compliances

5. **Edit Permissions**:
   - Super Admin can edit GLOBAL compliances
   - Admin can edit ORG compliances (but loses approval if previously approved)
   - Admin cannot edit GLOBAL compliances (read-only)
   - Super Admin cannot edit ORG compliances (read-only)

---

## User Interface Highlights

### Super Admin Excel Grid
- Highlighted rows: Yellow background for Draft ORG compliances pending approval
- Actions column: Approve/Reject buttons for Draft ORG compliances
- Save indicators: Yellow background for unsaved changes
- Pending count: Shows number of pending approvals in toolbar

### Admin Excel Grid
- Approval status badges: Green for Approved, Yellow for Draft
- Info banner: Reminds that changes require Super Admin approval
- Approved rows: Light green background for approved compliances

### Employee View
- Clean, read-only interface
- Detailed sections: Basic Info, Legal Info, Applicability, Risk & Penalty, Due Date
- Task assignment: Prominent button to convert compliance to task

---

## Integration Points

### Task Management
- Compliance can be assigned as tasks
- Task inherits compliance details (title, description, type, frequency)
- Task is linked to compliance via `compliance_id`

### Document Management
- Compliance can have associated documents
- Documents uploaded via `/compliance/:id/documents` endpoint
- Documents viewable in compliance detail view

---

## Error Handling

- Toast notifications for success/error messages
- Validation errors for required fields
- Permission checks before actions
- Confirmation dialogs for destructive actions (delete, reject)

---

## Future Enhancements (Potential)

1. Bulk operations (bulk approve/reject)
2. Compliance templates
3. Compliance reminders/notifications
4. Compliance reporting and analytics
5. Version history for compliance changes
6. Compliance checklist items
7. Document templates linked to compliances

