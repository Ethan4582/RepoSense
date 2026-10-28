"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  FileClock,
  RotateCcw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";

type ProjectRole = "OWNER" | "EDITOR" | "CONTRIBUTOR" | "VIEWER";

interface Governance {
  role: ProjectRole;
  ownerId: string;
  automaticUpdatesEnabled: boolean;
  directEditNotifications: boolean;
}

interface Member {
  userId: string;
  role: ProjectRole;
  createdAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    emailAddress: string;
    imageUrl: string | null;
  };
}

interface Revision {
  id: string;
  status: "PUBLISHED" | "PENDING";
  additions: number;
  deletions: number;
  createdAt: string;
  sourceCommitSha: string | null;
  page: { id: string; slug: string; title: string };
  actor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  } | null;
}

interface AuditEvent {
  id: string;
  action: string;
  createdAt: string;
  actor: {
    firstName: string | null;
    lastName: string | null;
    emailAddress: string;
  } | null;
}

const roleLabels: Record<ProjectRole, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  CONTRIBUTOR: "Contributor",
  VIEWER: "Viewer",
};

function displayName(member: Member["user"]): string {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.emailAddress
  );
}

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [governance, setGovernance] = React.useState<Governance | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [revisions, setRevisions] = React.useState<Revision[]>([]);
  const [audit, setAudit] = React.useState<AuditEvent[]>([]);
  const [inviteRole, setInviteRole] =
    React.useState<Exclude<ProjectRole, "OWNER">>("VIEWER");
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const governanceResponse = await fetch(
      `/api/projects/${projectId}/governance`,
      { cache: "no-store" },
    );
    if (!governanceResponse.ok) return;
    const governanceBody = (await governanceResponse.json()) as Governance;
    setGovernance(governanceBody);

    const requests = [
      fetch(`/api/projects/${projectId}/access/members`, { cache: "no-store" }),
      fetch(`/api/projects/${projectId}/revisions`, { cache: "no-store" }),
      governanceBody.role === "OWNER"
        ? fetch(`/api/projects/${projectId}/audit`, { cache: "no-store" })
        : Promise.resolve(null),
    ] as const;
    const [membersResponse, revisionsResponse, auditResponse] =
      await Promise.all(requests);
    if (membersResponse.ok) {
      const body = (await membersResponse.json()) as { members?: Member[] };
      setMembers(body.members ?? []);
    }
    if (revisionsResponse.ok) {
      const body = (await revisionsResponse.json()) as {
        revisions?: Revision[];
      };
      setRevisions(body.revisions ?? []);
    }
    if (auditResponse?.ok) {
      const body = (await auditResponse.json()) as { events?: AuditEvent[] };
      setAudit(body.events ?? []);
    }
  }, [projectId]);

  React.useEffect(() => void load(), [load]);

  const updateGovernance = async (data: Partial<Governance>) => {
    const response = await fetch(`/api/projects/${projectId}/governance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) return toast.error("Could not update project settings.");
    setGovernance((current) => (current ? { ...current, ...data } : current));
    toast.success("Project settings updated");
  };

  const createInvitation = async () => {
    const response = await fetch(
      `/api/projects/${projectId}/access/invitations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      },
    );
    if (!response.ok) return toast.error("Could not create invitation.");
    const body = (await response.json()) as { token: string };
    setInviteUrl(`${window.location.origin}/join/${body.token}`);
  };

  const updateMember = async (
    userId: string,
    role: Exclude<ProjectRole, "OWNER">,
  ) => {
    const response = await fetch(
      `/api/projects/${projectId}/access/members/${userId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      },
    );
    if (!response.ok) return toast.error("Could not update this member.");
    await load();
  };

  const transferOwnership = async (member: Member) => {
    if (!window.confirm(`Transfer ownership to ${member.user.emailAddress}?`))
      return;
    const response = await fetch(`/api/projects/${projectId}/access/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.userId }),
    });
    if (!response.ok) return toast.error("Could not transfer ownership.");
    toast.success("Ownership transferred");
    await load();
  };

  const removeMember = async (member: Member) => {
    if (
      !window.confirm(`Remove ${member.user.emailAddress} from this project?`)
    )
      return;
    const response = await fetch(
      `/api/projects/${projectId}/access/members/${member.userId}`,
      { method: "DELETE" },
    );
    if (!response.ok) return toast.error("Could not remove this member.");
    await load();
  };

  const revisionAction = async (
    revisionId: string,
    action: "approve" | "rollback",
  ) => {
    const response = await fetch(
      `/api/projects/${projectId}/revisions/${revisionId}/${action}`,
      {
        method: "POST",
      },
    );
    if (!response.ok) return toast.error("Could not apply this revision.");
    toast.success(
      action === "approve" ? "Revision published" : "Page restored",
    );
    await load();
  };

  if (!governance) {
    return (
      <div className="text-muted-foreground mx-auto w-full max-w-6xl p-6 text-sm">
        Loading project settings...
      </div>
    );
  }

  const canManage = governance.role === "OWNER";
  const canPublish =
    governance.role === "OWNER" || governance.role === "EDITOR";
  const requestedTab = searchParams.get("tab");
  const activeTab =
    requestedTab === "access" ||
    requestedTab === "history" ||
    (requestedTab === "audit" && canManage)
      ? requestedTab
      : "general";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Project settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage updates, access, versions, and security history.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/wiki/${projectId}`}>
            <ExternalLink data-icon="inline-start" />
            Open wiki
          </Link>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          router.replace(`/settings/projects/${projectId}?tab=${value}`)
        }
      >
        <TabsList className="bg-muted/60 h-auto w-full justify-start gap-1 rounded-xl p-1 sm:w-fit">
          <TabsTrigger className="rounded-lg px-4" value="general">
            General
          </TabsTrigger>
          <TabsTrigger className="rounded-lg px-4" value="access">
            Access
          </TabsTrigger>
          <TabsTrigger className="rounded-lg px-4" value="history">
            Versions
          </TabsTrigger>
          {canManage && (
            <TabsTrigger className="rounded-lg px-4" value="audit">
              Audit log
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Automatic wiki updates</CardTitle>
              <CardDescription>
                Update the default-branch wiki about 5–10 minutes after a merged
                pull request.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Update after merge</p>
                  <p className="text-muted-foreground text-xs">
                    Uses the owner&apos;s saved provider key.
                  </p>
                </div>
                <Switch
                  checked={governance.automaticUpdatesEnabled}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    void updateGovernance({ automaticUpdatesEnabled: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    Notify on direct editor changes
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Contributors always require approval.
                  </p>
                </div>
                <Switch
                  checked={governance.directEditNotifications}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    void updateGovernance({ directEditNotifications: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="mt-4 flex flex-col gap-4">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Invite a member</CardTitle>
                <CardDescription>
                  Links expire after seven days and can be accepted once.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <Select
                  value={inviteRole}
                  onValueChange={(value) =>
                    setInviteRole(value as typeof inviteRole)
                  }
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                      <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                      <SelectItem value="EDITOR">Editor</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button onClick={() => void createInvitation()}>
                  <UserPlus data-icon="inline-start" />
                  Create invitation
                </Button>
                {inviteUrl && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void navigator.clipboard.writeText(inviteUrl)
                    }
                  >
                    <Copy data-icon="inline-start" />
                    Copy link
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Only signed-in members receive project access.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarImage
                              src={member.user.imageUrl ?? undefined}
                            />
                            <AvatarFallback>
                              {displayName(member.user)
                                .slice(0, 1)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {displayName(member.user)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {member.user.emailAddress}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManage && member.role !== "OWNER" ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              void updateMember(
                                member.userId,
                                value as Exclude<ProjectRole, "OWNER">,
                              )
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="VIEWER">Viewer</SelectItem>
                                <SelectItem value="CONTRIBUTOR">
                                  Contributor
                                </SelectItem>
                                <SelectItem value="EDITOR">Editor</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">
                            {roleLabels[member.role]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && member.role !== "OWNER" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void transferOwnership(member)}
                            >
                              Transfer ownership
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void removeMember(member)}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Page versions</CardTitle>
              <CardDescription>
                Published, proposed, generated, and restored versions remain
                available.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Empty className="min-h-52 gap-3 p-6">
                          <EmptyMedia variant="icon">
                            <FileClock />
                          </EmptyMedia>
                          <EmptyHeader>
                            <EmptyTitle className="text-sm">
                              No versions yet
                            </EmptyTitle>
                            <EmptyDescription>
                              Published edits and automatic updates will appear
                              here.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {revisions.map((revision) => (
                    <TableRow key={revision.id}>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {revision.page.title}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(revision.createdAt).toLocaleString()}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {revision.actor
                          ? [revision.actor.firstName, revision.actor.lastName]
                              .filter(Boolean)
                              .join(" ") || "Member"
                          : "Automatic update"}
                      </TableCell>
                      <TableCell className="text-sm">
                        +{revision.additions} / -{revision.deletions}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            revision.status === "PENDING"
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {revision.status === "PENDING"
                            ? "Needs review"
                            : "Published"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {revision.status === "PENDING" && canPublish ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              void revisionAction(revision.id, "approve")
                            }
                          >
                            <Check data-icon="inline-start" />
                            Approve
                          </Button>
                        ) : revision.status === "PUBLISHED" && canPublish ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void revisionAction(revision.id, "rollback")
                            }
                          >
                            <RotateCcw data-icon="inline-start" />
                            Restore
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Security audit log</CardTitle>
                <CardDescription>
                  Access, ownership, settings, and publishing activity.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {audit.length === 0 ? (
                  <Empty className="min-h-52 gap-3 p-6">
                    <EmptyMedia variant="icon">
                      <ShieldCheck />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle className="text-sm">
                        No security activity yet
                      </EmptyTitle>
                      <EmptyDescription>
                        Permission, ownership, and publishing changes will be
                        recorded here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : null}
                {audit.map((event) => (
                  <Alert key={event.id}>
                    <AlertTitle>
                      {event.action.replaceAll("_", " ").toLowerCase()}
                    </AlertTitle>
                    <AlertDescription>
                      {event.actor
                        ? [event.actor.firstName, event.actor.lastName]
                            .filter(Boolean)
                            .join(" ") || event.actor.emailAddress
                        : "System"}{" "}
                      · {new Date(event.createdAt).toLocaleString()}
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
