"use client";
import { useState } from "react";
import { RecordingReview } from "@/components/speaking/recording-review";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Check,
  Play,
} from "lucide-react";
import { useAcademy } from "@/store/use-academy";
import {
  Card,
  Badge,
  Modal,
  Tabs,
  Input,
  Pagination,
  EmptyState,
} from "@/components/ui/primitives";
import {
  SkillProgressChart,
  ActivityChart,
} from "@/components/charts/skill-chart";
import type { Row } from "@/types";
import { useRouter } from "next/navigation";
export function RoleWorkspace({ role }: { role: "teacher" | "admin" }) {
  const [tab, setTab] = useState(role === "teacher" ? "Students" : "Users");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [review, setReview] = useState<Row | null>(null);
  const [feedback, setFeedback] = useState("");
  const store = useAcademy();
  const router = useRouter();
  const authorized = store.session?.role === role;
  const groups =
    role === "teacher"
      ? ["Students", "Classes", "Assignments", "Reviews", "Courses", "Progress"]
      : [
          "Users",
          "Teachers",
          "Courses",
          "Tests",
          "Question bank",
          "Content",
          "Analytics",
          "Settings",
        ];
  const rows = (store.rows[tab] ?? []).filter((r) =>
    `${r.name} ${r.detail} ${r.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (!authorized)
    return (
      <Card className="role-gate">
        <Users size={36} />
        <h1>Choose your {role} demo.</h1>
        <p>
          This local workspace is only shown for the selected demo role. Demo
          role switching is not production authentication or access control.
        </p>
        <button
          className="button primary"
          onClick={() => {
            store.login(
              role === "teacher" ? "Jamie Taylor" : "Jordan Lee",
              `${role}@example.com`,
              role,
            );
          }}
        >
          Enter {role} demo
        </button>
      </Card>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {role.toUpperCase()} WORKSPACE · LOCAL DEMO
          </div>
          <h1>
            {role === "teacher"
              ? "Help someone find their next chapter."
              : "A thoughtful space to manage it all."}
          </h1>
          <p>
            {role === "teacher"
              ? "Your learners, their practice, and the progress you make together."
              : "Manage your demo platform. All changes stay in this browser."}
          </p>
        </div>
        <Badge color="purple">{role.toUpperCase()}</Badge>
      </div>
      <div className="summary-grid">
        {[
          {
            label: role === "teacher" ? "Learners" : "Users",
            value: store.rows[role === "teacher" ? "Students" : "Users"].length,
            icon: Users,
          },
          {
            label: "Courses",
            value: store.rows.Courses.length,
            icon: BookOpen,
          },
          {
            label: "Assignments",
            value: store.rows.Assignments.length,
            icon: ClipboardList,
          },
          {
            label: "Local sessions",
            value: store.attempts.length,
            icon: TrendingUp,
          },
        ].map((k) => (
          <Card key={k.label}>
            <div className="summary-label">
              <k.icon size={18} />
              {k.label}
            </div>
            <div className="summary-number">
              {k.value.toString().padStart(2, "0")}
            </div>
            <p>Local demo records</p>
          </Card>
        ))}
      </div>
      <Tabs
        items={groups}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setQuery("");
          setPage(1);
        }}
      />
      {tab === "Progress" || tab === "Analytics" ? (
        <div className="two-columns">
          <Card>
            <h3>Illustrative skill progress</h3>
            <p>Sample data, independent of user edits.</p>
            <SkillProgressChart />
          </Card>
          <Card>
            <h3>Illustrative activity</h3>
            <ActivityChart />
          </Card>
        </div>
      ) : tab === "Settings" ? (
        <Card>
          <h2>Platform preferences</h2>
          <p>Manage your local language, theme, and goals in settings.</p>
          <button
            className="button primary"
            onClick={() => router.push("/settings")}
          >
            Open settings
          </button>
        </Card>
      ) : (
        <Card className="table-card">
          <div className="section-heading">
            <div>
              <h2>{tab}</h2>
              <p>
                {rows.length} local records · changes are saved automatically
              </p>
            </div>
            <button
              className="button primary"
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  name: "",
                  detail: "",
                  status: "Active",
                })
              }
            >
              <Plus size={16} />
              Add{" "}
              {tab === "Classes"
                ? "class"
                : tab === "Question bank"
                  ? "question"
                  : tab.replace(/s$/, "").toLowerCase()}
            </button>
          </div>
          <div className="table-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={`Search ${tab.toLowerCase()}…`}
              aria-label={`Search ${tab.toLowerCase()}`}
            />
          </div>
          {rows.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Details</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice((page - 1) * 5, page * 5).map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className="table-avatar" aria-hidden="true">
                            {row.name.slice(0, 1)}
                          </span>
                          {row.name}
                        </td>
                        <td>
                          {row.detail.length > 85
                            ? row.detail.slice(0, 85) + "…"
                            : row.detail}
                        </td>
                        <td>
                          <Badge
                            color={
                              row.status === "Active" ||
                              row.status === "Published"
                                ? "green"
                                : "orange"
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            {tab === "Reviews" && (
                              <button
                                className="button outline small"
                                onClick={() => {
                                  setReview(row);
                                  setFeedback(
                                    store.drafts[`review-${row.id}`] ?? "",
                                  );
                                }}
                              >
                                Review
                              </button>
                            )}
                            <button
                              className="icon-button"
                              aria-label={`Edit ${row.name}`}
                              onClick={() => setEditing({ ...row })}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Delete ${row.name}`}
                              onClick={() => setDeleting(row)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                total={Math.ceil(rows.length / 5)}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState
              title="Room for something new"
              description="Add a record or adjust your search to get started."
            />
          )}
        </Card>
      )}
      {tab === "Reviews" && <RecordingReview />}
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={
          editing && store.rows[tab]?.some((r) => r.id === editing.id)
            ? `Edit ${tab.toLowerCase()} record`
            : `Add ${tab.toLowerCase()} record`
        }
        description="This is a local demo change. No invitation, email, or backend request is sent."
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing.name.trim()) {
                store.saveRow(tab, { ...editing, name: editing.name.trim() });
                setEditing(null);
              }
            }}
            className="form-stack"
          >
            <label className="field">
              Name
              <Input
                required
                maxLength={150}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label className="field">
              Details
              <textarea
                className="input"
                value={editing.detail}
                maxLength={3000}
                onChange={(e) =>
                  setEditing({ ...editing, detail: e.target.value })
                }
              />
            </label>
            <label className="field">
              Status
              <select
                className="input"
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                {[
                  "Active",
                  "Published",
                  "Draft",
                  "Review",
                  "Archived",
                  "Awaiting recording",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit">
              <Check size={16} />
              Save record
            </button>
          </form>
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this local record?"
        description={deleting?.name}
      >
        <p>This removes the record from this browser’s demo data.</p>
        <div className="dialog-actions">
          <button className="button outline" onClick={() => setDeleting(null)}>
            Cancel
          </button>
          <button
            className="button destructive"
            onClick={() => {
              if (deleting) store.deleteRow(tab, deleting.id);
              setDeleting(null);
              setPage(1);
            }}
          >
            Delete record
          </button>
        </div>
      </Modal>
      <Modal
        open={!!review}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
        title={review?.name ?? "Review response"}
        description="Local teacher feedback workspace."
      >
        {review && (
          <>
            <div className="review-response">{review.detail}</div>
            {review.name.includes("Speaking") && (
              <p className="notice">
                <Play size={16} />
                No sample audio is attached. Actual recordings can be replayed
                and downloaded in the Speaking workspace.
              </p>
            )}
            <label className="field">
              Teacher feedback
              <textarea
                className="input"
                rows={5}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Recognise a strength. Suggest a practical next step."
              />
            </label>
            <button
              className="button primary"
              disabled={!feedback.trim()}
              onClick={() => {
                store.draft(`review-${review.id}`, feedback);
                store.saveRow("Reviews", { ...review, status: "Reviewed" });
                setReview(null);
              }}
            >
              Save feedback locally
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
