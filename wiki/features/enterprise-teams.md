# Enterprise Teams: Organization & Member Management

A feature that introduces a first-class **Organization** entity into Flowcraft. Users can create an org, invite teammates by email, assign roles, and share resources org-wide by setting visibility to `"team"`. This is the foundation for Projects, Shared Credits, Usage Analytics, and SSO — every subsequent enterprise feature references the org model defined here.

---

## Confirmed Decisions

| Decision                  | Choice                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-org membership      | One org per user — a user must leave their current org before joining another                                                                           |
| Org-level resource access | Resources must be explicitly set to `"team"` visibility; joining an org does not expose private resources                                               |
| Roles                     | `owner`, `admin`, `member`, `viewer` (no role skipped)                                                                                                  |
| Viewer capabilities       | Read-only: view flows/canvases but cannot execute, edit, or consume credits                                                                             |
| Invite mechanism          | Email only via transactional email (Resend). Invitee does not need an existing account                                                                  |
| Invite state machine      | `pending → accepted` (or `expired` / `cancelled`)                                                                                                       |
| Invite expiry             | 7 days                                                                                                                                                  |
| Owner count               | Exactly one owner per org at all times — transfer requires explicit owner reassignment                                                                  |
| `sharedWith` coexistence  | Existing per-resource `sharedWith` is unchanged; `"team"` visibility is additive                                                                        |
| Firestore structure       | `organizations/{orgId}` top-level; members inline as a map (up to ~500 members); `invitations/{inviteId}` top-level for email-queryable pending invites |
| User profile              | `users/{userId}` top-level collection stores `organizationId`; looked up once per session                                                               |
| Collections               | `ORGANIZATIONS`, `INVITATIONS`, `USERS` added to `COLLECTIONS` in `constants.ts`                                                                        |

**Out of scope for v1:** domain claiming, SSO auto-provisioning, project-scoped roles, seat limits, bulk invite (CSV), org deletion.

---

## Data Model

### Firestore: `organizations/{orgId}`

```ts
interface OrganizationDocument {
    id: string;
    name: string;
    slug: string; // URL-safe, unique across orgs
    ownerId: string; // userId of the owner (exactly one)
    members: Record<string, OrgMember>; // keyed by userId
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

interface OrgMember {
    userId: string;
    email: string; // denormalized for display
    displayName: string; // denormalized for display
    photoURL?: string; // denormalized for avatars
    role: OrgRole;
    joinedAt: Timestamp;
}

type OrgRole = "owner" | "admin" | "member" | "viewer";
```

**Role capability matrix:**

| Action                  | owner | admin            | member | viewer |
| ----------------------- | ----- | ---------------- | ------ | ------ |
| View team resources     | ✓     | ✓                | ✓      | ✓      |
| Execute flows/canvases  | ✓     | ✓                | ✓      | ✗      |
| Create & edit resources | ✓     | ✓                | ✓      | ✗      |
| Invite members          | ✓     | ✓                | ✗      | ✗      |
| Remove members          | ✓     | ✓                | ✗      | ✗      |
| Change member roles     | ✓     | ✓ (not to owner) | ✗      | ✗      |
| Rename org              | ✓     | ✗                | ✗      | ✗      |
| Transfer ownership      | ✓     | ✗                | ✗      | ✗      |
| Delete org              | ✓     | ✗                | ✗      | ✗      |

---

### Firestore: `invitations/{inviteId}`

```ts
interface InvitationDocument {
    id: string;
    organizationId: string;
    organizationName: string; // denormalized for email rendering
    invitedByUserId: string;
    invitedByName: string; // denormalized
    email: string; // the invitee's email
    role: OrgRole; // role to assign on accept (not "owner")
    status: InvitationStatus;
    token: string; // crypto-random, used in accept URL
    expiresAt: Timestamp; // createdAt + 7 days
    createdAt: Timestamp;
    acceptedAt?: Timestamp;
}

type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";
```

---

### Firestore: `users/{userId}`

New top-level collection (or merged with existing user profile if one exists).

```ts
interface UserDocument {
    id: string; // same as auth uid
    email: string;
    displayName: string;
    photoURL?: string;
    organizationId?: string; // null if not in any org
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
```

---

### Resource documents — visibility extension

Add `"team"` to the visibility enum on all resource types. A resource with `visibility: "team"` is readable/usable by any member of the org that owns it (resolved via `organizationId` on the resource).

```ts
// Extend on: flows, canvases, styles, rulesets, user_skills
visibility: "private" | "public" | "restricted" | "team";
organizationId?: string;   // set when visibility = "team", or when resource is created inside a team context
```

Access rule: a user can read a team-visibility resource if `resource.organizationId === user.organizationId`.

---

### Constants

Add to `COLLECTIONS` in `src/lib/constants.ts`:

```ts
ORGANIZATIONS: "organizations",
INVITATIONS: "invitations",
USERS: "users",
```

---

## Invitation Flow

```
Admin sends invite (POST /api/org/invitations)
  → create InvitationDocument { status: "pending", token: uuid, expiresAt: now+7d }
  → send email via Resend: "You've been invited to join <OrgName> on Flowcraft"
      → email contains: GET /api/org/invitations/accept?token=<token>

Invitee clicks link
  → if not logged in: redirect to sign-in, then back to accept URL
  → GET /api/org/invitations/accept?token=<token>
      → validate token: exists, status=pending, not expired
      → if invitee.organizationId is set → error: "You're already in an org"
      → add invitee to org.members with assigned role
      → set invitee's users/{userId}.organizationId = orgId
      → set invitation.status = "accepted"
      → redirect to /dashboard with success toast

Expiry (nightly cron or on next read)
  → invitations where expiresAt < now AND status = "pending" → set status = "expired"
```

---

## API Routes

All routes require a valid session (`auth()`). Org-mutating routes additionally require `admin` or `owner` role.

### `POST /api/org` — create organization

Request:

```ts
{
    name: string;
} // slug auto-derived from name
```

Response `201`:

```ts
{
    organization: OrganizationDocument;
}
```

Errors: `ALREADY_IN_ORG (409)` if user has an existing `organizationId`.

---

### `GET /api/org` — get current user's organization

Response `200`:

```ts
{
    organization: OrganizationDocument;
}
```

Errors: `NOT_IN_ORG (404)`.

---

### `PATCH /api/org` — update organization (owner only)

Request:

```ts
{ name?: string }
```

Response `200`:

```ts
{
    organization: OrganizationDocument;
}
```

---

### `POST /api/org/invitations` — invite a member (admin or owner)

Request:

```ts
{
    email: string;
    role: "admin" | "member" | "viewer";
}
```

Response `201`:

```ts
{
    invitation: InvitationDocument;
}
```

Errors: `ALREADY_MEMBER (409)` if email belongs to an existing member. `PENDING_INVITE (409)` if a pending invite already exists for this email.

---

### `GET /api/org/invitations` — list invitations (admin or owner)

Response `200`:

```ts
{ invitations: InvitationDocument[] }
```

---

### `DELETE /api/org/invitations/[inviteId]` — cancel a pending invite (admin or owner)

Response `200`:

```ts
{
    invitation: InvitationDocument;
} // status: "cancelled"
```

---

### `GET /api/org/invitations/accept` — accept an invitation (any authenticated user)

Query param: `token=<string>`

Redirects to `/dashboard` on success. Returns error page on invalid/expired token.

---

### `PATCH /api/org/members/[userId]` — change a member's role (admin or owner)

Request:

```ts
{
    role: "admin" | "member" | "viewer";
}
```

Owners cannot be demoted via this route — use `/transfer-ownership`. Admins cannot promote to `owner`.

Response `200`:

```ts
{
    member: OrgMember;
}
```

---

### `DELETE /api/org/members/[userId]` — remove a member (admin or owner; owner cannot remove themselves)

Response `200`:

```ts
{
    removedUserId: string;
}
```

Side effect: sets `users/{userId}.organizationId = null`. Sets `visibility = "private"` on all `"team"` resources owned by that user (resources owned by the org retain team visibility).

---

### `POST /api/org/transfer-ownership` — transfer ownership (owner only)

Request:

```ts
{
    newOwnerUserId: string;
}
```

Atomically sets new owner's role to `"owner"` and current owner's role to `"admin"`. Updates `organization.ownerId`.

Response `200`:

```ts
{
    organization: OrganizationDocument;
}
```

---

### `DELETE /api/org/members/me` — leave organization (any member except sole owner)

Response `200`:

```ts
{
    leftOrganizationId: string;
}
```

---

## Service Layer

Create `src/lib/services/organization.service.ts`:

```ts
createOrganization(userId: string, data: { name: string }) → OrganizationDocument
getOrganization(orgId: string) → OrganizationDocument
getOrganizationByUserId(userId: string) → OrganizationDocument | null
updateOrganization(orgId: string, actorId: string, data: { name?: string }) → OrganizationDocument
inviteMember(orgId: string, actorId: string, data: { email: string; role: OrgRole }) → InvitationDocument
listInvitations(orgId: string) → InvitationDocument[]
cancelInvitation(orgId: string, inviteId: string, actorId: string) → InvitationDocument
acceptInvitation(token: string, userId: string, userEmail: string) → OrganizationDocument
updateMemberRole(orgId: string, actorId: string, targetUserId: string, role: OrgRole) → OrgMember
removeMember(orgId: string, actorId: string, targetUserId: string) → void
transferOwnership(orgId: string, currentOwnerId: string, newOwnerUserId: string) → OrganizationDocument
leaveOrganization(orgId: string, userId: string) → void
```

Create `src/lib/services/user.service.ts`:

```ts
getUserDocument(userId: string) → UserDocument | null
upsertUserDocument(userId: string, data: Partial<UserDocument>) → UserDocument
```

---

## Zod Schemas

Add to `src/lib/schemas.ts`:

```ts
export const OrgRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const CreateOrganizationSchema = z.object({
    name: z.string().min(2).max(64),
});

export const InviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(["admin", "member", "viewer"]),
});

export const UpdateMemberRoleSchema = z.object({
    role: z.enum(["admin", "member", "viewer"]),
});

export const TransferOwnershipSchema = z.object({
    newOwnerUserId: z.string(),
});
```

---

## Session Context

To avoid per-request Firestore lookups for `organizationId`, extend the next-auth session:

```ts
// src/auth.ts — add to session callback
session.user.organizationId = token.organizationId ?? null;
session.user.orgRole = token.orgRole ?? null;
```

Populate `token.organizationId` and `token.orgRole` in the `jwt` callback by reading `users/{userId}.organizationId` and then `organizations/{orgId}.members[userId].role`. Cache on the token (refreshed on sign-in; explicitly refreshed after role/membership changes via `update()` from `next-auth/react`).

---

## Email Templates (Resend)

Single transactional email: **Org Invite**.

Subject: `<InviterName> invited you to join <OrgName> on Flowcraft`

Body:

- Inviter name + org name
- Role being assigned
- CTA button: `Accept Invitation` → `/api/org/invitations/accept?token=<token>`
- Expiry note: "This invitation expires in 7 days."

Use React Email for the template at `src/emails/org-invite.tsx`.

---

## UI

### 1. Create Organization

Accessible from the user menu (top-right) when the user has no org: **"Create Team"** option.

Modal:

- Org name input (2–64 chars)
- Submit → POST /api/org → redirect to `/settings/team`

### 2. Team Settings — `/settings/team`

Only accessible to `owner` and `admin`.

**Members tab:**

```
Team Members                              [Invite Member]

Avatar  Name              Email                  Role      Action
──────────────────────────────────────────────────────────────────
 MB    Matthieu Blanc    blanc@company.com      Owner     —
 JD    Jane Doe          jane@company.com       Admin     [⋯]
 RK    Robert Kim        robert@company.com     Member    [⋯]
 VP    Viewer Person     viewer@company.com     Viewer    [⋯]

Pending Invitations
────────────────────────────────────────────────
      alice@company.com                Member    [Cancel]
      bob@example.com                  Viewer    [Cancel]
        Invited 2 days ago — expires in 5 days
```

`[⋯]` action menu per member: **Change role** (submenu with available roles), **Remove from team**. Owner is not removable; admins cannot change owner role.

**Invite Member** button → modal:

- Email input
- Role dropdown (admin / member / viewer) with short descriptions
- Send Invite → POST /api/org/invitations

### 3. User Menu — org context indicator

Show org name and user's role badge in the account dropdown:

```
Matthieu Blanc
blanc@company.com
Acme Corp  ·  Owner
──────────────────
Settings
Team Settings      ← visible to admin/owner only
Sign out
```

### 4. Resource sharing — visibility picker extension

When sharing a flow or canvas, the visibility picker gains a new option:

```
● Private — only you
○ Team — all Acme Corp members        ← new, shown only if user is in an org
○ Public — anyone with the link
```

Selecting "Team" sets `visibility: "team"` and `organizationId: <orgId>` on the resource. If the user is not in an org, the "Team" option is hidden.

### 5. Accept Invitation page — `/invite/accept`

Shown when an unauthenticated user lands on the accept link:

```
You've been invited to join Acme Corp on Flowcraft

Invited by: Matthieu Blanc
Your role: Member

[Sign in with Google to accept]
```

After sign-in, auto-processes the token and redirects to `/dashboard`.

---

## Access Control in Existing Services

Each service's read/list methods must be extended to include `"team"` visibility. Example pattern (mirrors existing `sharedWithEmails` query):

```ts
// In list queries — add a third branch alongside "my" and "shared"
.where("visibility", "==", "team")
.where("organizationId", "==", userOrgId)
```

This requires `(visibility ASC, organizationId ASC)` composite indexes on all affected collections.

---

## Firestore Indexes

```
// organizations
{ ownerId: ASC }                        // lookup by owner

// invitations
{ organizationId: ASC, status: ASC }    // list pending invites for an org
{ email: ASC, status: ASC }             // check for existing pending invite by email

// All resource collections (flows, canvases, styles, rulesets, user_skills)
{ visibility: ASC, organizationId: ASC, updatedAt: DESC }  // team tab queries
```

---

## File Checklist

```
NEW:
  src/lib/services/organization.service.ts
  src/lib/services/user.service.ts
  src/app/api/org/route.ts                         ← POST (create), GET
  src/app/api/org/invitations/route.ts             ← POST (invite), GET (list)
  src/app/api/org/invitations/accept/route.ts      ← GET (accept token)
  src/app/api/org/invitations/[inviteId]/route.ts  ← DELETE (cancel)
  src/app/api/org/members/[userId]/route.ts        ← PATCH (role), DELETE (remove)
  src/app/api/org/members/me/route.ts              ← DELETE (leave)
  src/app/api/org/transfer-ownership/route.ts      ← POST
  src/app/(main)/settings/team/page.tsx
  src/components/org/invite-member-dialog.tsx
  src/components/org/members-table.tsx
  src/components/org/pending-invitations-list.tsx
  src/components/org/create-org-dialog.tsx
  src/app/invite/accept/page.tsx
  src/emails/org-invite.tsx

MODIFY:
  src/lib/constants.ts                             ← add ORGANIZATIONS, INVITATIONS, USERS
  src/lib/schemas.ts                               ← add org/invite Zod schemas; extend visibility enum
  src/auth.ts                                      ← extend session with organizationId, orgRole
  src/lib/services/canvas.service.ts              ← add "team" visibility branch
  src/lib/services/flow.service.ts                ← add "team" visibility branch
  src/lib/services/ruleset.service.ts             ← add "team" visibility branch
  src/lib/services/library.service.ts             ← add "team" visibility branch
  src/components/shared/visibility-picker.tsx     ← add "Team" option
  src/components/layout/user-menu.tsx             ← show org name + role
```
