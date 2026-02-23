"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWeb3 } from "@/components/web3/Web3Provider"; // مسیر را مطابق پروژه‌ات تنظیم کن

const defaultProfile = {
  wallet_address: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  bio: "",
  photo: null,
};

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizePhone(phone) {
  return (phone || "").replace(/[^\d+]/g, "");
}

function isValidPhone(phone) {
  const p = normalizePhone(phone);
  if (!p) return true;
  return /^\+?[0-9]{7,15}$/.test(p);
}

function isAbsUrl(u) {
  return /^https?:\/\//i.test(u || "");
}

function joinUrl(base, path) {
  if (!path) return "";
  if (isAbsUrl(path)) return path;
  const b = (base || "").endsWith("/") ? base : base + "/";
  const p = path.startsWith("/") ? path.slice(1) : path;
  return b + p;
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

  const {
    account,
    accessToken,
    profile: ctxProfile,
    login,
    isAuthLoading,
    isReady,
    isConnecting,
    isCorrectChain,
    error: web3Error,
  } = useWeb3();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/",
    []
  );
  const ME_URL = useMemo(() => `${API_BASE}api/accounts/me/`, [API_BASE]);

  const [profile, setProfile] = useState(defaultProfile);
  const [draft, setDraft] = useState(defaultProfile);

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState({ type: "", message: "" });

  // جلوگیری از اینکه اگر user Cancel کرد، دوباره پشت سر هم sign popup بیاد
  const [autoAuthTried, setAutoAuthTried] = useState(false);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(
      () => setToast({ type: "", message: "" }),
      2500
    );
  };

  const authHeaders = useMemo(() => {
    if (!accessToken) return {};
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  async function apiGetMe(tokenHeaders) {
    const res = await fetch(ME_URL, { headers: tokenHeaders });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || `Get profile failed (${res.status})`);
    }
    return res.json();
  }

  async function apiPatchMeJson(payload) {
    const res = await fetch(ME_URL, {
      method: "PATCH",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || `Update failed (${res.status})`);
    }
    return res.json();
  }

  async function apiPatchMeMultipart({ fields, photoFile }) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      fd.append(k, String(v));
    });
    if (photoFile) fd.append("photo", photoFile);

    const res = await fetch(ME_URL, {
      method: "PATCH",
      headers: {
        ...authHeaders,
      },
      body: fd,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || `Update failed (${res.status})`);
    }
    return res.json();
  }

  // 1) اگر Provider profile داده، از همان استفاده کن
  useEffect(() => {
    if (!ctxProfile) return;
    setProfile((p) => ({ ...p, ...ctxProfile }));
    setDraft((p) => ({ ...p, ...ctxProfile }));
    setAvatarPreview("");
    setAvatarFile(null);
    setRemovePhoto(false);
  }, [ctxProfile]);

  // 2) Auto flow on enter:
  // - اگر token داری: /me
  // - اگر token نداری: login() (sign) سپس /me (معمولاً Provider خودش هم /me می‌زند، ولی ما هم fallback داریم)
  useEffect(() => {
    if (!isReady) return;
    if (!account) return; // هنوز wallet connect نشده

    // اگر chain اشتباهه، اینجا sign بی‌فایده است
    if (!isCorrectChain) {
      showToast("error", "Wrong network. Please switch network in wallet.");
      return;
    }

    // اگر profile پر شد، کاری نکن
    if (ctxProfile) return;

    // اگر توکن هست، مستقیم /me بزن
    if (accessToken) {
      setLoading(true);
      apiGetMe(authHeaders)
        .then((me) => {
          setProfile((p) => ({ ...p, ...me }));
          setDraft((p) => ({ ...p, ...me }));
        })
        .catch((e) => showToast("error", e?.message || "Failed to load profile"))
        .finally(() => setLoading(false));
      return;
    }

    // توکن نداریم → یکبار auto-login انجام بده (فقط یکبار!)
    if (!autoAuthTried && typeof login === "function" && !isAuthLoading) {
      setAutoAuthTried(true);
      setLoading(true);

      login()
        .then(() => {
          // Provider معمولاً خودش profile رو ست می‌کنه.
          // اگر نکرد، با accessToken بعداً useEffect بالا /me رو می‌زند.
        })
        .catch((e) => {
          // user cancel یا خطای auth
          showToast("error", e?.message || "Login cancelled / failed");
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isReady,
    account,
    isCorrectChain,
    accessToken,
    ctxProfile,
    autoAuthTried,
    isAuthLoading,
    login,
    ME_URL,
  ]);

  // ---- Validation ----
  const errors = useMemo(() => {
    const e = {};
    if (!isValidEmail(draft.email)) e.email = "Please enter a valid email.";
    if (!isValidPhone(draft.phone_number))
      e.phone_number = "Phone must be 7-15 digits, optionally starting with +";
    if ((draft.bio || "").length > 280) e.bio = "Bio must be 280 characters or less.";
    return e;
  }, [draft]);

  const canSave = useMemo(() => {
    return Object.keys(errors).length === 0 && isEditing && !saving;
  }, [errors, isEditing, saving]);

  // ---- Avatar handlers ----
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
      setAvatarPreview(String(reader.result || ""));
      setAvatarFile(file);
      setRemovePhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const startEdit = () => {
    setDraft(profile);
    setIsEditing(true);
    setShowErrors(false);
    setAvatarPreview("");
    setAvatarFile(null);
    setRemovePhoto(false);
  };

  const cancelEdit = () => {
    setDraft(profile);
    setIsEditing(false);
    setShowErrors(false);
    setAvatarPreview("");
    setAvatarFile(null);
    setRemovePhoto(false);
    showToast("info", "Changes discarded.");
  };

  const save = async () => {
    setShowErrors(true);
    if (!canSave) return;

    if (!accessToken) {
      showToast("error", "Not authenticated.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: draft.first_name || "",
        last_name: draft.last_name || "",
        email: (draft.email || "").trim(),
        phone_number: normalizePhone(draft.phone_number || ""),
        bio: draft.bio || "",
      };

      let updated;

      if (removePhoto) {
        updated = await apiPatchMeJson({ ...payload, photo: null });
      } else if (avatarFile) {
        updated = await apiPatchMeMultipart({
          fields: payload,
          photoFile: avatarFile,
        });
      } else {
        updated = await apiPatchMeJson(payload);
      }

      setProfile((p) => ({ ...p, ...updated }));
      setDraft((p) => ({ ...p, ...updated }));

      setIsEditing(false);
      setShowErrors(false);
      setAvatarPreview("");
      setAvatarFile(null);
      setRemovePhoto(false);

      showToast("success", "Profile saved.");
    } catch (e) {
      showToast("error", e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const photoUrl = useMemo(() => {
    if (avatarPreview) return avatarPreview;
    if (removePhoto) return "";
    return profile.photo ? joinUrl(API_BASE, profile.photo) : "";
  }, [avatarPreview, removePhoto, profile.photo, API_BASE]);

  const view = isEditing ? draft : profile;

  return (
    <div className="pf-page">
      <style>{css}</style>

      <div className="pf-container">
        <div className="pf-header">
          <div>
            <div className="pf-title">Profile</div>
            <div className="pf-subtitle">Manage your personal information.</div>

            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              Wallet: <code>{account || "-"}</code>
            </div>

            {web3Error ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#991b1b" }}>
                {web3Error}
              </div>
            ) : null}
          </div>

          <div className="pf-actions">
            {!isEditing ? (
              <button
                className="pf-btn pf-btn-primary"
                onClick={startEdit}
                disabled={loading || saving || isConnecting || !accessToken}
                title={!accessToken ? "Login required" : ""}
              >
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
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Profile avatar" className="pf-avatar-img" />
                ) : (
                  <div className="pf-avatar-fallback">
                    {(view.first_name?.[0] || "U").toUpperCase()}
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

                  {(avatarPreview || profile.photo) && !removePhoto ? (
                    <button
                      className="pf-btn pf-btn-small"
                      onClick={() => {
                        setAvatarPreview("");
                        setAvatarFile(null);
                        setRemovePhoto(true);
                      }}
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
                {(view.first_name || "First") + " " + (view.last_name || "Last")}
              </div>
              <div className="pf-meta">
                <span className="pf-pill">{view.email ? view.email : "Email: —"}</span>
                <span className="pf-pill">
                  {view.phone_number ? view.phone_number : "Phone: —"}
                </span>
              </div>
              <div className="pf-bio-view">
                {view.bio?.trim() ? view.bio : "No bio added yet."}
              </div>

              {loading ? (
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                  Loading / signing…
                </div>
              ) : null}

              {!accessToken && isReady && account && autoAuthTried ? (
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                  If MetaMask was cancelled, refresh page to try again.
                </div>
              ) : null}
            </div>
          </div>

          <div className="pf-divider" />

          {/* Form */}
          <div className="pf-form">
            <Field label="First Name" hint="Optional">
              <input
                className="pf-input"
                value={draft.first_name}
                disabled={!isEditing}
                onChange={(e) => setDraft((p) => ({ ...p, first_name: e.target.value }))}
                placeholder="e.g. John"
              />
            </Field>

            <Field label="Last Name" hint="Optional">
              <input
                className="pf-input"
                value={draft.last_name}
                disabled={!isEditing}
                onChange={(e) => setDraft((p) => ({ ...p, last_name: e.target.value }))}
                placeholder="e.g. Doe"
              />
            </Field>

            <Field
              label="Phone"
              hint="Optional"
              error={showErrors ? errors.phone_number : ""}
            >
              <input
                className="pf-input"
                value={draft.phone_number}
                disabled={!isEditing}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, phone_number: e.target.value }))
                }
                placeholder="+1 555 123 4567"
                inputMode="tel"
              />
            </Field>

            <Field label="Email" hint="Optional" error={showErrors ? errors.email : ""}>
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

        {toast.message ? <div className={`pf-toast ${toast.type}`}>{toast.message}</div> : null}
      </div>
    </div>
  );
}

const css = `
/* همون CSS قبلی شما */
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
.pf-actions{ display:flex; gap:10px; flex-wrap:wrap; }
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
.pf-avatar-actions{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
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