"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "sg_profile_v1";

const defaultProfile = {
  avatarDataUrl: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  bio: "",
};

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function isValidPhone(phone) {
  if (!phone) return true;
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return digits.length >= 8;
}

// ✅ IMPORTANT: defined OUTSIDE to prevent remount (cursor jumping)
function Field({ label, hint, error, children }) {
  return (
    <div className="pf-field">
      <div className="pf-field-head">
        <div className="pf-label">{label}</div>
        {hint ? <div className="pf-hint">{hint}</div> : null}
      </div>
      {children}
      {error ? <div className="pf-error">{error}</div> : null}
    </div>
  );
}

export default function ProfilePage() {
  const fileRef = useRef(null);

  const [profile, setProfile] = useState(defaultProfile);
  const [draft, setDraft] = useState(defaultProfile);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // show validation only after user tries to save (optional UX)
  const [showErrors, setShowErrors] = useState(false);

  const [toast, setToast] = useState({ type: "", message: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const safe = { ...defaultProfile, ...parsed };
        setProfile(safe);
        setDraft(safe);
      }
    } catch {
      // ignore
    }
  }, []);

  // ✅ No required for first/last name anymore.
  const errors = useMemo(() => {
    const e = {};
    if (!isValidEmail(draft.email)) e.email = "Please enter a valid email.";
    if (!isValidPhone(draft.phone)) e.phone = "Please enter a valid phone number.";
    if ((draft.bio || "").length > 280) e.bio = "Bio must be 280 characters or less.";
    return e;
  }, [draft]);

  const canSave = useMemo(() => {
    return Object.keys(errors).length === 0 && isEditing && !saving;
  }, [errors, isEditing, saving]);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(
      () => setToast({ type: "", message: "" }),
      2500
    );
  };

  const onPickAvatar = () => fileRef.current?.click();

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("error", "Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("error", "Image must be smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraft((p) => ({ ...p, avatarDataUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const startEdit = () => {
    setDraft(profile);
    setIsEditing(true);
    setShowErrors(false);
  };

  const cancelEdit = () => {
    setDraft(profile);
    setIsEditing(false);
    setShowErrors(false);
    showToast("info", "Changes discarded.");
  };

  const save = async () => {
    setShowErrors(true);
    if (!canSave) return;

    setSaving(true);
    try {
      // Later: replace with API call
      const payload = {
        ...draft,
        phone: normalizePhone(draft.phone || ""),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setProfile(payload);
      setIsEditing(false);
      setShowErrors(false);
      showToast("success", "Profile saved.");
    } catch {
      showToast("error", "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const view = isEditing ? draft : profile;

  return (
    <div className="pf-page">
      <style>{css}</style>

      <div className="pf-container">
        <div className="pf-header">
          <div>
            <div className="pf-title">Profile</div>
            <div className="pf-subtitle">Manage your personal information.</div>
          </div>

          <div className="pf-actions">
            {!isEditing ? (
              <button className="pf-btn pf-btn-primary" onClick={startEdit}>
                Edit
              </button>
            ) : (
              <>
                <button className="pf-btn" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="pf-btn pf-btn-primary"
                  onClick={save}
                  disabled={!canSave}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pf-card">
          <div className="pf-top">
            {/* Avatar */}
            <div className="pf-avatar-wrap">
              <div className="pf-avatar">
                {view.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={view.avatarDataUrl}
                    alt="Profile avatar"
                    className="pf-avatar-img"
                  />
                ) : (
                  <div className="pf-avatar-fallback">
                    {(view.firstName?.[0] || "U").toUpperCase()}
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="pf-avatar-actions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={onAvatarChange}
                    style={{ display: "none" }}
                  />
                  <button className="pf-btn pf-btn-small" onClick={onPickAvatar}>
                    Upload
                  </button>
                  {draft.avatarDataUrl ? (
                    <button
                      className="pf-btn pf-btn-small"
                      onClick={() => setDraft((p) => ({ ...p, avatarDataUrl: "" }))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Summary */}
            <div className="pf-summary">
              <div className="pf-name">
                {(view.firstName || "First") + " " + (view.lastName || "Last")}
              </div>
              <div className="pf-meta">
                <span className="pf-pill">{view.email ? view.email : "Email: —"}</span>
                <span className="pf-pill">{view.phone ? view.phone : "Phone: —"}</span>
              </div>
              <div className="pf-bio-view">
                {view.bio?.trim() ? view.bio : "No bio added yet."}
              </div>
            </div>
          </div>

          <div className="pf-divider" />

          {/* Form */}
          <div className="pf-form">
            <Field label="First Name" hint="Optional">
              <input
                className="pf-input"
                value={draft.firstName}
                disabled={!isEditing}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, firstName: e.target.value }))
                }
                placeholder="e.g. John"
              />
            </Field>

            <Field label="Last Name" hint="Optional">
              <input
                className="pf-input"
                value={draft.lastName}
                disabled={!isEditing}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, lastName: e.target.value }))
                }
                placeholder="e.g. Doe"
              />
            </Field>

            <Field
              label="Phone"
              hint="Optional"
              error={showErrors ? errors.phone : ""}
            >
              <input
                className="pf-input"
                value={draft.phone}
                disabled={!isEditing}
                onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555 123 4567"
                inputMode="tel"
              />
            </Field>

            <Field
              label="Email"
              hint="Optional"
              error={showErrors ? errors.email : ""}
            >
              <input
                className="pf-input"
                value={draft.email}
                disabled={!isEditing}
                onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                placeholder="name@example.com"
                inputMode="email"
              />
            </Field>

            <Field
              label="Bio"
              hint={`${(draft.bio || "").length}/280`}
              error={showErrors ? errors.bio : ""}
            >
              <textarea
                className="pf-textarea"
                value={draft.bio}
                disabled={!isEditing}
                onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                placeholder="A short bio about you…"
                rows={5}
              />
            </Field>
          </div>
        </div>

        {toast.message ? (
          <div className={`pf-toast ${toast.type}`}>{toast.message}</div>
        ) : null}
      </div>
    </div>
  );
}

const css = `
.pf-page{
  background: #f7f7fb;
  min-height: calc(100vh - 64px);
  padding: 28px 16px 48px;
  direction: ltr;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
}

.pf-container{ max-width: 920px; margin: 0 auto; }

.pf-header{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:16px; margin-bottom:16px;
}

.pf-title{ font-size:22px; font-weight:800; color:#111827; }
.pf-subtitle{ margin-top:6px; font-size:13px; color:#6b7280; }

.pf-actions{ display:flex; gap:10px; }

.pf-card{
  background:#fff; border:1px solid #e5e7eb; border-radius:16px;
  box-shadow:0 10px 24px rgba(0,0,0,.05); overflow:hidden;
}

.pf-top{
  display:grid; grid-template-columns:220px 1fr;
  gap:18px; padding:18px;
}

.pf-avatar-wrap{ display:flex; flex-direction:column; align-items:center; gap:10px; }

.pf-avatar{
  width:140px; height:140px; border-radius:999px;
  border:1px solid #e5e7eb; overflow:hidden; background:#f3f4f6;
  display:grid; place-items:center;
}

.pf-avatar-img{ width:100%; height:100%; object-fit:cover; }

.pf-avatar-fallback{
  width:100%; height:100%; display:grid; place-items:center;
  font-weight:900; font-size:44px; color:#111827;
}

.pf-avatar-actions{ display:flex; gap:8px; }

.pf-summary{ display:flex; flex-direction:column; gap:10px; justify-content:center; }
.pf-name{ font-size:20px; font-weight:800; color:#111827; }

.pf-meta{ display:flex; flex-wrap:wrap; gap:8px; }

.pf-pill{
  font-size:12px; padding:6px 10px; border-radius:999px;
  background:#f3f4f6; color:#374151; border:1px solid #e5e7eb;
}

.pf-bio-view{
  font-size:13px; color:#374151; line-height:1.9; white-space:pre-wrap;
}

.pf-divider{ height:1px; background:#e5e7eb; }

.pf-form{
  padding:18px;
  display:grid; grid-template-columns:1fr 1fr;
  gap:14px;
}

.pf-field{ display:flex; flex-direction:column; gap:8px; }

.pf-field-head{
  display:flex; justify-content:space-between; align-items:baseline; gap:10px;
}

.pf-label{ font-size:13px; font-weight:700; color:#111827; }
.pf-hint{ font-size:12px; color:#6b7280; }

.pf-input{
  width:100%; border:1px solid #e5e7eb; border-radius:12px;
  padding:10px 12px; font-size:14px; outline:none; background:#fff;
}

.pf-input:focus{
  border-color:#111827; box-shadow:0 0 0 3px rgba(17,24,39,.08);
}

.pf-input:disabled{ background:#f9fafb; color:#6b7280; }

.pf-textarea{
  width:100%; border:1px solid #e5e7eb; border-radius:12px;
  padding:10px 12px; font-size:14px; outline:none; resize:vertical;
  background:#fff; grid-column:1 / -1;
}

.pf-textarea:focus{
  border-color:#111827; box-shadow:0 0 0 3px rgba(17,24,39,.08);
}

.pf-textarea:disabled{ background:#f9fafb; color:#6b7280; }

.pf-error{ font-size:12px; color:#dc2626; }

.pf-btn{
  border:1px solid #e5e7eb; background:#fff; color:#111827;
  padding:9px 12px; border-radius:12px; font-size:13px; cursor:pointer;
}

.pf-btn:hover{ background:#f9fafb; }
.pf-btn:disabled{ opacity:.6; cursor:not-allowed; }

.pf-btn-primary{ background:#111827; color:#fff; border-color:#111827; }
.pf-btn-primary:hover{ opacity:.92; }

.pf-btn-small{ padding:8px 10px; font-size:12px; border-radius:10px; }

.pf-toast{
  position:fixed; bottom:18px; right:18px;
  background:#111827; color:#fff; padding:10px 12px;
  border-radius:12px; font-size:13px;
  box-shadow:0 12px 30px rgba(0,0,0,.2);
}

.pf-toast.success{ background:#065f46; }
.pf-toast.error{ background:#991b1b; }
.pf-toast.info{ background:#1f2937; }

@media (max-width: 820px){
  .pf-top{ grid-template-columns:1fr; justify-items:center; text-align:center; }
  .pf-form{ grid-template-columns:1fr; }
  .pf-textarea{ grid-column:auto; }
}
`;