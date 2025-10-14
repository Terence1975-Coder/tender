import React, { useEffect, useMemo, useState } from "react";

// Weavi-style App Store — single-file React component
// - Left nav, rounded cards, purple theme
// - Admin gate with code 1975 to add/edit apps
// - Preview opens the app's first page (iframe if url supplied, else generated template)
// - Data persisted to localStorage under key "appstore.apps.v1"
// - No external UI libs required; Tailwind classes only
// Default export: <WeaviAppStore />

// ------------------ Helpers ------------------
const LS_KEY = "appstore.apps.v1";

const demoApps = [
  {
    id: cryptoRandomId(),
    name: "Opportunities",
    category: "Sales",
    color: "#5B5BD6",
    emoji: "🚀",
    description: "Track pipeline value, win rate and velocity.",
    previewUrl: "", // optional — if empty, we render a generated first page
    template: "dashboard",
  },
  {
    id: cryptoRandomId(),
    name: "Research",
    category: "Insights",
    color: "#6E59A5",
    emoji: "🔎",
    description: "Search and segment organisations.",
    previewUrl: "",
    template: "list",
  },
  {
    id: cryptoRandomId(),
    name: "Marketing",
    category: "Campaigns",
    color: "#2E90FA",
    emoji: "📣",
    description: "Plan and measure campaign performance.",
    previewUrl: "",
    template: "cards",
  },
];

function cryptoRandomId() {
  try {
    return self.crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ------------------ Root Component ------------------
export default function WeaviAppStore() {
  const [apps, setApps] = useLocalStorageArray(LS_KEY, demoApps);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [admin, setAdmin] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [previewApp, setPreviewApp] = useState(null);
  const [editing, setEditing] = useState(null); // app | null

  const categories = useMemo(() => [
    "All",
    ...Array.from(new Set(apps.map((a) => a.category))).sort(),
  ], [apps]);

  const filtered = apps.filter((a) => {
    const matchQ = a.name.toLowerCase().includes(query.toLowerCase());
    const matchC = category === "All" || a.category === category;
    return matchQ && matchC;
  });

  function upsertApp(partial) {
    setApps((prev) => {
      const idx = prev.findIndex((p) => p.id === partial.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...partial };
        return next;
      }
      return [{
        id: cryptoRandomId(),
        name: "New App",
        category: "General",
        color: "#5B5BD6",
        emoji: "✨",
        description: "",
        previewUrl: "",
        template: "dashboard",
        ...partial,
      }, ...prev];
    });
  }

  function removeApp(id) {
    setApps((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#F6F1FF] text-[#301B52]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Burger />
              <span className="text-xl font-semibold tracking-wide">weavi.ai</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 items-center rounded-full bg-white/70 px-3 text-sm shadow">15</span>
              <button
                onClick={() => setShowGate(true)}
                className="rounded-xl bg-white/70 px-3 py-2 text-sm font-medium shadow hover:shadow-md"
                title={admin ? "Admin enabled" : "Enter admin code"}
              >
                {admin ? "Admin On" : "Admin"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-16 pt-6 md:grid-cols-[240px_1fr]">
        {/* Left nav */}
        <aside className="hidden md:block">
          <div className="sticky top-16 space-y-3">
            {[
              ["Dashboard", "✨"],
              ["Opportunities", "🚀"],
              ["Research", "🔎"],
              ["Marketing", "📣"],
              ["Operations", "⚙️"],
              ["Settings", "⚙"],
              ["SaaS Place", "☁️"],
            ].map(([label, icon]) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-black/5"
              >
                <span className="text-lg" aria-hidden>{icon}</span>
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main column */}
        <main>
          <section className="rounded-3xl bg-gradient-to-r from-[#5B5BD6] to-[#2E90FA] p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">App Store</h1>
              <Lightbulb />
            </div>
          </section>

          {/* Filters */}
          <div className="mt-4 grid items-center gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps..."
                className="w-full rounded-2xl border-0 bg-white p-3 pl-10 text-sm shadow ring-1 ring-black/10 placeholder:text-[#8E78BE] focus:outline-none focus:ring-2 focus:ring-[#6E59A5]"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">🔎</span>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-2xl bg-white px-3 py-2 text-sm shadow ring-1 ring-black/10 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {admin && (
              <button
                onClick={() => setEditing({})}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold shadow transition hover:shadow-md"
              >
                + New App
              </button>
            )}
          </div>

          {/* App grid */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((app) => (
              <div
                key={app.id}
                className="group rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{background: hexToSoft(app.color)}}>
                      <span className="text-xl" aria-hidden>{app.emoji}</span>
                    </span>
                    <div>
                      <h3 className="font-semibold text-[#301B52]">{app.name}</h3>
                      <p className="text-xs text-[#6D5C94]">{app.category}</p>
                    </div>
                  </div>
                  {admin && (
                    <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                      <IconButton onClick={() => setEditing(app)} title="Edit">✏️</IconButton>
                      <IconButton onClick={() => removeApp(app.id)} title="Delete">🗑️</IconButton>
                    </div>
                  )}
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-[#4D3B7B]">{app.description}</p>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setPreviewApp(app)}
                    className="rounded-xl bg-[#6E59A5] px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110"
                  >
                    Preview
                  </button>
                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs">First page</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Admin Gate Modal */}
      {showGate && (
        <Modal onClose={() => setShowGate(false)} title="Enter Admin Code">
          <AdminGate onSuccess={() => { setAdmin(true); setShowGate(false); }} />
        </Modal>
      )}

      {/* Preview Modal */}
      {previewApp && (
        <Modal onClose={() => setPreviewApp(null)} title={`${previewApp.name} — First page`} wide>
          <AppPreview app={previewApp} />
        </Modal>
      )}

      {/* Editor Modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit App" : "Create App"}>
          <AppEditor
            value={editing}
            onCancel={() => setEditing(null)}
            onSave={(next) => {
              upsertApp(next);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ------------------ Subcomponents ------------------
function AppPreview({ app }) {
  if (app.previewUrl) {
    return (
      <div className="h-[70vh] overflow-hidden rounded-2xl ring-1 ring-black/10">
        <iframe title="preview" src={app.previewUrl} className="h-full w-full" />
      </div>
    );
  }

  // Generated templates to mimic a "first page"
  switch (app.template) {
    case "list":
      return <ListTemplate app={app} />;
    case "cards":
      return <CardsTemplate app={app} />;
    default:
      return <DashboardTemplate app={app} />;
  }
}

function DashboardTemplate({ app }) {
  return (
    <div className="h-[70vh] overflow-auto rounded-3xl bg-white p-6 ring-1 ring-black/10">
      <div className="rounded-3xl bg-gradient-to-r from-[#5B5BD6] to-[#2E90FA] p-6 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{app.name} Dashboard</h2>
          <span className="text-2xl" aria-hidden>{app.emoji}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Conversion Rate", "32.0%"],
          ["Avg Deal Size", "$16,439"],
          ["Win Rate", "32.0%"],
          ["Velocity", "94 days"],
        ].map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Panel title="Sales" subtitle="Total Revenue">
          <BigNumber>$263,029.00</BigNumber>
        </Panel>
        <Panel title="Opportunities" subtitle="Pipeline Value">
          <BigNumber>$120,842.77</BigNumber>
        </Panel>
      </div>
    </div>
  );
}

function ListTemplate({ app }) {
  const items = [
    "Allica Bank",
    "AU Bullion South West LTD",
    "Best Western The Dartmouth Hotel, Golf & Spa",
    "Birth From Within South West CIC",
    "Children's Hospice South West",
  ];
  return (
    <div className="h-[70vh] overflow-auto rounded-3xl bg-white p-6 ring-1 ring-black/10">
      <div className="rounded-3xl bg-[#8FD0E8] p-5 text-[#301B52]">
        <h2 className="text-xl font-bold">Manage Organisations</h2>
      </div>
      <div className="mt-4">
        <div className="relative">
          <input className="w-full rounded-2xl border-0 bg-[#F6F1FF] p-3 pl-10 text-sm ring-1 ring-black/10 focus:outline-none" placeholder="Search" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔎</span>
        </div>
        <ul className="mt-4 space-y-3">
          {items.map((name) => (
            <li key={name} className="rounded-2xl bg-[#F6F1FF] p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#3A2370]">{name}</span>
                <div className="flex gap-2">
                  <IconButton title="Delete">🗑️</IconButton>
                  <IconButton title="Refresh">🔄</IconButton>
                  <IconButton title="More">▾</IconButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CardsTemplate({ app }) {
  const cards = [
    { title: "Audience", body: "B2B • EMEA • SaaS" },
    { title: "Channel", body: "Email + LinkedIn" },
    { title: "Goal", body: "Book 40 demos" },
  ];
  return (
    <div className="h-[70vh] overflow-auto rounded-3xl bg-white p-6 ring-1 ring-black/10">
      <div className="rounded-3xl bg-[#0EA5E9] p-5 text-white">
        <h2 className="text-xl font-bold">{app.name} — Campaign Setup</h2>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl bg-[#F6F1FF] p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-semibold text-[#6E59A5]">{c.title}</div>
            <div className="mt-2 text-[#3A2370]">{c.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppEditor({ value, onSave, onCancel }) {
  const [form, setForm] = useState({
    id: value.id,
    name: value.name || "",
    category: value.category || "General",
    color: value.color || "#5B5BD6",
    emoji: value.emoji || "✨",
    description: value.description || "",
    previewUrl: value.previewUrl || "",
    template: value.template || "dashboard",
  });

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="grid gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
        </Field>
        <Field label="Category">
          <input value={form.category} onChange={(e) => set("category", e.target.value)} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Emoji Icon">
          <input value={form.emoji} onChange={(e) => set("emoji", e.target.value)} className="input" />
        </Field>
        <Field label="Brand Color">
          <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-10 w-full rounded-xl" />
        </Field>
      </div>
      <Field label="Description">
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input min-h-[80px]" />
      </Field>
      <Field label="First Page URL (optional)">
        <input value={form.previewUrl} onChange={(e) => set("previewUrl", e.target.value)} placeholder="https://... (leave blank to use a template)" className="input" />
      </Field>
      <Field label="Template (used when URL is empty)">
        <select value={form.template} onChange={(e) => set("template", e.target.value)} className="input">
          <option value="dashboard">Dashboard</option>
          <option value="list">List</option>
          <option value="cards">Cards</option>
        </select>
      </Field>

      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl bg-black/10 px-4 py-2 text-sm">Cancel</button>
        <button type="submit" className="rounded-xl bg-[#6E59A5] px-4 py-2 text-sm font-semibold text-white">Save</button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-[#4D3B7B]">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-[#3A2370] shadow-sm ring-1 ring-black/5">
      <div className="text-sm text-[#6E59A5]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="text-sm font-semibold text-[#6E59A5]">{title}</div>
      <div className="text-xs text-[#7B6AA7]">{subtitle}</div>
      <div className="mt-3 text-[#3A2370]">{children}</div>
    </div>
  );
}

function BigNumber({ children }) {
  return <div className="text-2xl font-extrabold tracking-tight">{children}</div>;
}

function IconButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-9 w-9 place-items-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-black/10 hover:bg-black/5"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

function Burger() {
  return (
    <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 shadow ring-1 ring-black/10">
      <div className="h-3 w-4">
        <div className="mb-1 h-0.5 w-full rounded bg-[#6E59A5]" />
        <div className="mb-1 h-0.5 w-3/4 rounded bg-[#6E59A5]" />
        <div className="h-0.5 w-1/2 rounded bg-[#6E59A5]" />
      </div>
    </div>
  );
}

function Lightbulb() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/30">
      💡
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className={cx(
        "w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/10",
        wide && "max-w-5xl"
      )}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#3A2370]">{title}</h3>
          <button onClick={onClose} className="rounded-xl bg-black/10 px-3 py-1 text-sm">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminGate({ onSuccess }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() === "1975") onSuccess();
        else setError("Incorrect code");
      }}
      className="grid gap-3"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter 4-digit code"
        className="input"
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" className="rounded-xl bg-[#6E59A5] px-4 py-2 text-sm font-semibold text-white">Unlock</button>
      </div>
    </form>
  );
}

// ------------------ Hooks & utils ------------------
function useLocalStorageArray(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {}
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

function hexToSoft(hex) {
  // blend with white for a soft badge background
  try {
    const c = hex.replace('#','');
    const r = parseInt(c.substring(0,2), 16);
    const g = parseInt(c.substring(2,4), 16);
    const b = parseInt(c.substring(4,6), 16);
    const blend = (v) => Math.round((v + 255*2) / 3); // 2/3 white blend
    return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
  } catch {
    return "#EEE";
  }
}

// Tailwind-friendly input class
const style = document.createElement('style');
style.innerHTML = `.input{border:0; background:#F6F1FF; padding:.75rem 1rem; border-radius:1rem; box-shadow:0 1px 2px rgba(0,0,0,.06); outline:none;}
.input:focus{box-shadow:0 0 0 2px #6E59A5, 0 1px 2px rgba(0,0,0,.06);}`;
document.head.appendChild(style);
