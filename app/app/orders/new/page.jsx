"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Wallet,
  Sparkles,
  ShieldCheck,
  Layers,
  Coins,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  X,
} from "lucide-react";

import styles from "./NewOrderPage.module.css";

import { useWeb3 } from "@/components/web3/Web3Provider";
import { WEB3_CONFIG } from "@/lib/web3/config";
import { toBytes32Label } from "@/lib/web3/bytes";
import { notifyOrderStage } from "@/lib/api";

const ZERO = "0x0000000000000000000000000000000000000000";
const TOKEN_DECIMALS = 18;

// --- API base (هماهنگ با lib/api.js شما) ---
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/";
const API_PREFIX = "api/accounts/";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function truncateMiddle(str, head = 8, tail = 6) {
  if (!str) return "";
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Autocomplete helpers ---------- */

function normalize(s) {
  return (s || "").trim().toLowerCase();
}

function isLikelyWalletQuery(q) {
  const x = normalize(q);
  return x.startsWith("0x") || /^[0-9a-fx]+$/i.test(x);
}

function useDebouncedValue(value, delayMs = 180) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

async function parseError(res) {
  try {
    const data = await res.json();
    return data?.detail || JSON.stringify(data);
  } catch {
    try {
      return await res.text();
    } catch {
      return "Unknown error";
    }
  }
}

async function fetchMeAll(token) {
  const res = await fetch(`${API_BASE}${API_PREFIX}me/all/`, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // اگر بک‌اند شما به کوکی/سشن متکیه این رو فعال کن
    // credentials: "include",
  });

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(`Get accounts failed: ${msg}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/* ---------- Unix & Date helpers ---------- */

function formatUnix(ts) {
  const n = Number(ts);
  if (!n || Number.isNaN(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toLocalDatetimeInputValue(unixSecondsStr) {
  const n = Number(unixSecondsStr);
  if (!n || Number.isNaN(n) || n <= 0) return "";
  const d = new Date(n * 1000);
  const pad = (x) => String(x).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromLocalDatetimeInputValue(dtLocalStr) {
  const d = new Date(dtLocalStr);
  if (Number.isNaN(d.getTime())) return "0";
  return String(Math.floor(d.getTime() / 1000));
}

/* ---------- Units (decimals=18) ---------- */

function parseUnits18(input) {
  const s0 = String(input ?? "").trim().replaceAll(",", "");
  if (!s0) return 0n;
  if (!/^\d+(\.\d+)?$/.test(s0)) throw new Error("Invalid amount format.");

  const [intPartRaw, fracPartRaw = ""] = s0.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = fracPartRaw.slice(0, TOKEN_DECIMALS);
  const fracPadded = fracPart.padEnd(TOKEN_DECIMALS, "0");

  const full = `${intPart}${fracPadded}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(full);
}

function formatUnits18(wei) {
  try {
    const w = BigInt(wei);
    const sign = w < 0n ? "-" : "";
    const x = w < 0n ? -w : w;
    const base = 10n ** BigInt(TOKEN_DECIMALS);
    const intPart = x / base;
    const fracPart = x % base;

    const fracStr = fracPart
      .toString()
      .padStart(TOKEN_DECIMALS, "0")
      .replace(/0+$/, "");
    return fracStr
      ? `${sign}${intPart.toString()}.${fracStr}`
      : `${sign}${intPart.toString()}`;
  } catch {
    return "—";
  }
}

/* ---------- Percent/BPS helpers ---------- */

function sanitizeNumberString(s) {
  return String(s ?? "").trim().replaceAll(",", ".");
}

function percentToBps(percentStr) {
  const p = Number(sanitizeNumberString(percentStr));
  if (Number.isNaN(p)) return null;
  const bps = Math.round(p * 100);
  return bps;
}

function bpsToPercentString(bpsStr) {
  const b = Number(String(bpsStr ?? "0"));
  if (Number.isNaN(b)) return "";
  const p = b / 100;
  return Number.isInteger(p) ? String(p) : String(p);
}

/* ---------- UI Primitives (NO Tailwind) ---------- */

function PageShell({ children }) {
  return <div className={styles.page}>{children}</div>;
}

function Container({ children }) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

/**
 * fullBleed => 100vw card width (full screen)
 */
function Card({ children, className, fullBleed = false }) {
  if (fullBleed) {
    return (
      <div className={styles.fullBleed}>
        <div className={styles.fullBleedInner}>
          <div className={cx(styles.card, className)}>{children}</div>
        </div>
      </div>
    );
  }
  return <div className={cx(styles.card, className)}>{children}</div>;
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className={styles.cardHeader}>
      <div className={styles.cardHeaderRow}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.cardTitle}>{title}</div>
          {subtitle ? (
            <div className={styles.cardSubtitle}>{subtitle}</div>
          ) : null}
        </div>
        {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
      </div>
    </div>
  );
}

function CardBody({ children }) {
  return <div className={styles.cardBody}>{children}</div>;
}

function SectionCard({ title, subtitle, children, className }) {
  return (
    <div className={cx(styles.section, className)}>
      {title || subtitle ? (
        <div style={{ marginBottom: 12 }}>
          {title ? <div className={styles.sectionTitle}>{title}</div> : null}
          {subtitle ? (
            <div className={styles.sectionSubtitle}>{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function InlineBanner({ kind = "info", title, children }) {
  const icon =
    kind === "error" ? (
      <AlertTriangle size={18} />
    ) : kind === "success" ? (
      <CheckCircle2 size={18} />
    ) : (
      <Sparkles size={18} />
    );

  const kindCls =
    kind === "error"
      ? styles.bannerError
      : kind === "success"
      ? styles.bannerSuccess
      : styles.bannerInfo;

  return (
    <div className={cx(styles.banner, kindCls)}>
      <div className={styles.bannerRow}>
        <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          {title ? <div className={styles.bannerTitle}>{title}</div> : null}
          <div className={styles.bannerText}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children, rightSlot }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className={styles.fieldTop}>
        <label className={styles.label}>{label}</label>
        <div className={styles.hintRow}>
          {hint ? <span className={styles.hint}>{hint}</span> : null}
          {rightSlot ? (
            <span style={{ flexShrink: 0 }}>{rightSlot}</span>
          ) : null}
        </div>
      </div>
      {children}
      {error ? <div className={styles.errorText}>{error}</div> : null}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
  error,
  mono,
  onFocus,
  onBlur,
}) {
  return (
    <input
      className={cx(
        styles.input,
        error && styles.inputError,
        mono && styles.inputMono
      )}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete}
    />
  );
}

function ButtonPrimary({ children, onClick, disabled, loading, className }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        styles.btn,
        styles.btnPrimary,
        (disabled || loading) && styles.btnDisabled,
        className
      )}
      type="button"
    >
      {loading ? (
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
      ) : null}
      {children}
    </button>
  );
}

function ButtonSecondary({ children, onClick, disabled, className }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        styles.btn,
        styles.btnSecondary,
        disabled && styles.btnDisabled,
        className
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function Chip({ kind = "neutral", children }) {
  return (
    <span
      className={cx(
        styles.chip,
        kind === "good" ? styles.chipGood : "",
        kind === "bad" ? styles.chipBad : ""
      )}
    >
      {children}
    </span>
  );
}

/* ---------- DeadlineField ---------- */

function DeadlineField({ label = "Deadline", value, onChange }) {
  const inputRef = useRef(null);
  const pretty = formatUnix(value);
  const hasDate = !!pretty;

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
      return;
    }
    el.focus();
    el.click();
  }

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div className={styles.fieldTop}>
        <div className={styles.label}>{label}</div>
      </div>

      <div style={{ marginTop: 10, position: "relative" }}>
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(2,6,23,0.12)",
            background: "rgba(255,255,255,0.92)",
            padding: 10,
            boxShadow: "0 1px 0 rgba(2,6,23,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={openPicker}
              className={cx(styles.btn, styles.btnSecondary)}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                minHeight: 40,
                width: "100%",
                justifyContent: "center",
              }}
              title="Pick date"
            >
              <Calendar size={18} />
              {hasDate ? (
                <span
                  style={{
                    maxWidth: 360,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pretty}
                </span>
              ) : (
                <span style={{ opacity: 0.7 }}>Pick date</span>
              )}
            </button>

            {hasDate ? (
              <button
                type="button"
                onClick={() => onChange("0")}
                className={cx(styles.btn, styles.btnSecondary)}
                style={{
                  width: 44,
                  height: 44,
                  padding: 0,
                  borderRadius: 14,
                  flexShrink: 0,
                }}
                title="Clear"
              >
                <X size={18} />
              </button>
            ) : null}

            <input
              ref={inputRef}
              type="datetime-local"
              value={toLocalDatetimeInputValue(value)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  onChange("0");
                  return;
                }
                onChange(fromLocalDatetimeInputValue(v));
              }}
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- MiniStat ---------- */

function MiniStat({ label, value, copyable }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      style={{
        borderRadius: 18,
        background: "rgba(255,255,255,0.80)",
        border: "1px solid rgba(2,6,23,0.10)",
        boxShadow: "0 1px 0 rgba(2,6,23,0.05)",
        padding: "14px 16px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(2,6,23,0.55)",
          }}
        >
          {label}
        </div>

        {copyable && value && value !== "—" ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(value);
              if (ok) {
                setCopied(true);
                setTimeout(() => setCopied(false), 900);
              }
            }}
            className={cx(styles.btn, styles.btnSecondary)}
            style={{ padding: "8px 10px", borderRadius: 999, fontSize: 12, gap: 8 }}
            title="Copy"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 13.5,
          fontWeight: 900,
          color: "rgba(2,6,23,0.92)",
          wordBreak: "break-all",
          fontFamily: copyable
            ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
            : undefined,
        }}
        title={copyable ? value : undefined}
      >
        {copyable ? truncateMiddle(value || "—") : value || "—"}
      </div>
    </div>
  );
}

/* ---------- Stepper ---------- */

function StepPill({ state, idx, label, onClick }) {
  const active = state === "active" || state === "done";
  return (
    <button type="button" onClick={onClick} className={styles.stepPill}>
      <span className={cx(styles.stepDot, active && styles.stepDotActive)}>
        {state === "done" ? "✓" : idx}
      </span>
      <span className={cx(styles.stepLabel, active && styles.stepLabelActive)}>
        {label}
      </span>
    </button>
  );
}

function WizardTop({ step, setStep, steps }) {
  const pct = ((step - 1) / (steps.length - 1)) * 100;

  return (
    <div className={styles.wizardTop}>
      <div className={styles.wizardTopRow}>
        <div className={styles.wTitle}>
          <div className={styles.kicker}>
            <Sparkles size={18} />
            SupplyGuarantee • Wizard
          </div>
          <div className={styles.headline}>New Order</div>
          <div className={styles.lead}>
            Step-by-step flow: enter details, configure milestones, review, then fund the escrow.
          </div>
        </div>

        <div className={styles.progressPill}>
          <span className={styles.progressLabel}>Progress</span>
          <span className={styles.progressValue}>{Math.round(pct)}%</span>
        </div>
      </div>

      <div className={styles.stepperWrap}>
        <div className={styles.stepsRow}>
          {steps.map((s) => {
            const state = step > s.k ? "done" : step === s.k ? "active" : "todo";
            return (
              <StepPill
                key={s.k}
                state={state}
                idx={s.k}
                label={s.label}
                onClick={() => setStep(s.k)}
              />
            );
          })}
        </div>

        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${pct}%` }} />
          <div className={styles.knob} style={{ left: `${pct}%` }} />
        </div>

        <div className={styles.barMeta}>
          <span>{steps[0].label}</span>
          <span>{steps[steps.length - 1].label}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Autocomplete Component for Address Fields ---------- */

function AddressAutocomplete({
  label,
  hint,
  value,
  setValue,
  error,
  accounts,
  loading,
  minChars = 2,
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);

  const debounced = useDebouncedValue(value, 160);

  const suggestions = useMemo(() => {
    const q = normalize(debounced);
    if (!q || q.length < minChars) return [];

    // سرچ ترکیبی: هم wallet هم email
    // اگر کاربر مثل wallet تایپ کرد (0x...) همون هم کار می‌کنه
    return accounts
      .filter((a) => {
        const w = normalize(a.wallet_address);
        const em = normalize(a.email);
        return w.includes(q) || em.includes(q);
      })
      .slice(0, 8);
  }, [accounts, debounced, minChars]);

  const show = open && suggestions.length > 0;

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function pick(item) {
    setValue(item.wallet_address || "");
    setOpen(false);
    setActiveIdx(-1);
  }

  return (
    <div ref={wrapRef} className={styles.autoWrap}>
      <Field
        label={label}
        hint={loading ? "Loading…" : hint}
        error={error}
        rightSlot={
          loading ? (
            <span style={{ fontSize: 12, opacity: 0.65 }}>loading</span>
          ) : null
        }
      >
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            // با کلیک روی suggestion blur می‌خوره؛ برای همین نمی‌بندیم اینجا
            // بستن با کلیک بیرون handle میشه
          }}
          placeholder="0x... or email..."
          autoComplete="new-password"
          inputMode="text"
          error={error}
          mono
        />
      </Field>

      {show ? (
        <div className={styles.suggestBox} role="listbox">
          {suggestions.map((a, idx) => (
            <button
              type="button"
              key={`${a.wallet_address}|${a.email}|${idx}`}
              className={cx(
                styles.suggestItem,
                idx === activeIdx && styles.suggestItemActive
              )}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={(e) => {
                // مهم: جلوگیری از blur قبل از pick
                e.preventDefault();
                pick(a);
              }}
            >
              <div className={styles.suggestMain}>{a.wallet_address}</div>
              {a.email ? (
                <div className={styles.suggestSub}>{a.email}</div>
              ) : (
                <div className={cx(styles.suggestSub, styles.suggestSubMuted)}>
                   
                </div>
              )}
            </button>
          ))}
        </div>
      ) : null}


    </div>
  );
}

/* ---------- Page ---------- */

export default function NewOrderPage() {
  const router = useRouter();
  const redirectTimerRef = useRef(null);

  const { account, isCorrectChain, connect, switchToTargetChain, contracts, accessToken } =
    useWeb3();

  const steps = useMemo(
    () => [
      { k: 1, label: "Header" },
      { k: 2, label: "Milestones" },
      { k: 3, label: "Review" },
    ],
    []
  );

  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});

  const [buyer, setBuyer] = useState("");
  const [seller, setSeller] = useState("");
  const [carrier, setCarrier] = useState("");
  const [inspector, setInspector] = useState("");

  const [token, setToken] = useState(WEB3_CONFIG.tokenAddress || "");
  const [priceHuman, setPriceHuman] = useState("");

  const [advancePercent, setAdvancePercent] = useState("20");
  const [advanceBps, setAdvanceBps] = useState("2000");
  const [advanceApprovalBy, setAdvanceApprovalBy] = useState("0");

  const [milestones, setMilestones] = useState([
    {
      name: "m1",
      bps: "3000",
      planBy: "0",
      deliveryBy: "0",
      inspectionBy: "0",
      buyerApprovalBy: "0",
    },
    {
      name: "m2",
      bps: "3000",
      planBy: "0",
      deliveryBy: "0",
      inspectionBy: "0",
      buyerApprovalBy: "0",
    },
    {
      name: "m3",
      bps: "2000",
      planBy: "0",
      deliveryBy: "0",
      inspectionBy: "0",
      buyerApprovalBy: "0",
    },
  ]);

  const [milestonePercents, setMilestonePercents] = useState(() => [
    bpsToPercentString("3000"),
    bpsToPercentString("3000"),
    bpsToPercentString("2000"),
  ]);

  const [orderId, setOrderId] = useState("");

  // --- accounts state for autocomplete ---
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");

  // ✅ Fetch accounts on page load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setAccountsLoading(true);
      setAccountsError("");
      try {
        // اگر توکن رو جای دیگه نگه می‌داری، اینو تغییر بده
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const data = await fetchMeAll(token);
        if (!cancelled) setAccounts(data);
      } catch (e) {
        if (!cancelled)
          setAccountsError(e?.message || "Failed to load accounts");
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (advancePercent === "") {
      setAdvanceBps("0");
      return;
    }
    const bps = percentToBps(advancePercent);
    if (bps === null) return;
    setAdvanceBps(String(bps));
  }, [advancePercent]);

  useEffect(() => {
    setMilestonePercents((prev) => {
      const next = [...prev];
      while (next.length < milestones.length) next.push("0");
      while (next.length > milestones.length) next.pop();
      for (let i = 0; i < milestones.length; i++) {
        const should = bpsToPercentString(milestones[i].bps);
        if (
          next[i] === "" ||
          Number(sanitizeNumberString(next[i])) * 100 !==
            Number(milestones[i].bps)
        ) {
          next[i] = should;
        }
      }
      return next;
    });
  }, [milestones.length]);

  const milestonesTotalBps = useMemo(
    () => milestones.reduce((sum, m) => sum + Number(m.bps || 0), 0),
    [milestones]
  );

  const totalBps = useMemo(
    () => Number(advanceBps || 0) + milestonesTotalBps,
    [advanceBps, milestonesTotalBps]
  );

  const canWrite =
    !!contracts?.sg && !!contracts?.token && !!account && isCorrectChain;

  const bpsOk = totalBps === 10000;
  const bpsChipKind = bpsOk ? "good" : "bad";

  const priceWei = useMemo(() => {
    try {
      if (!priceHuman) return 0n;
      return parseUnits18(priceHuman);
    } catch {
      return 0n;
    }
  }, [priceHuman]);

  function resetMsg() {
    setError("");
    setStatus("");
  }

  function resetFieldErrors() {
    setFieldErrors({});
  }

  function requireWeb3Ready() {
    if (!account) throw new Error("Connect wallet first.");
    if (!isCorrectChain) throw new Error("Switch to the target network.");
    if (!contracts?.sg || !contracts?.token) throw new Error("Web3 not ready.");
  }

  function validateHeaderSoft() {
    const fe = {};

    if (!buyer) fe.buyer = "Buyer is required.";
    if (!seller) fe.seller = "Seller is required.";
    if (!token) fe.token = "Token is required.";
    if (!inspector) fe.inspector = "Inspector is required for MVP.";

    if (!priceHuman) fe.priceHuman = "Price is required.";
    else {
      try {
        const w = parseUnits18(priceHuman);
        if (w <= 0n) fe.priceHuman = "Price must be > 0.";
      } catch (e) {
        fe.priceHuman = e?.message || "Invalid price format.";
      }
    }

    const p = Number(sanitizeNumberString(advancePercent));
    if (Number.isNaN(p) || p < 0 || p > 100)
      fe.advanceBps = "Advance must be between 0 and 100%.";

    setFieldErrors(fe);
    if (Object.keys(fe).length) throw new Error("Please fix the highlighted fields.");
  }

  function validateMilestonesSoft() {
    const fe = {};
    if (!milestones.length) fe.milestones = "Add at least one milestone.";

    milestones.forEach((m, idx) => {
      if (!m.name) fe[`ms_${idx}_name`] = `Milestone #${idx + 1}: name is required.`;

      const p = Number(sanitizeNumberString(milestonePercents[idx]));
      if (Number.isNaN(p) || p < 0 || p > 100) {
        fe[`ms_${idx}_bps`] = `Milestone #${idx + 1}: percent must be 0..100.`;
        return;
      }

      const bps = Number(m.bps);
      if (Number.isNaN(bps) || bps < 0 || bps > 10000) {
        fe[`ms_${idx}_bps`] = `Milestone #${idx + 1}: invalid BPS.`;
      }
    });

    if (!bpsOk) fe.bpsTotal = `BPS must sum to 10000. Current: ${totalBps}`;

    setFieldErrors(fe);
    if (Object.keys(fe).length) throw new Error("Please fix the highlighted fields.");
  }

  function addMilestoneRow() {
    setMilestones((prev) => [
      ...prev,
      {
        name: `m${prev.length + 1}`,
        bps: "0",
        planBy: "0",
        deliveryBy: "0",
        inspectionBy: "0",
        buyerApprovalBy: "0",
      },
    ]);
    setMilestonePercents((prev) => [...prev, "0"]);
  }

  function removeMilestoneRow(idx) {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
    setMilestonePercents((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMilestone(idx, key, value) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m))
    );
  }

  function updateMilestonePercent(idx, percentStr) {
    setMilestonePercents((prev) => prev.map((p, i) => (i === idx ? percentStr : p)));

    const bps = percentToBps(percentStr);
    if (bps === null) return;
    if (bps < 0 || bps > 10000) return;

    updateMilestone(idx, "bps", String(bps));
  }

  function goNext() {
    resetMsg();
    resetFieldErrors();
    try {
      if (step === 1) validateHeaderSoft();
      if (step === 2) validateMilestonesSoft();
      setStep((s) => Math.min(3, s + 1));
    } catch (e) {
      setError(e?.message || "Validation failed");
    }
  }

  function goBack() {
    resetMsg();
    resetFieldErrors();
    setStep((s) => Math.max(1, s - 1));
  }

  //**************************************************************************** */
  const createRunRef = useRef(0);
  const inFlightRef = useRef(false);

  async function handleCreateAndLock() {
    createRunRef.current += 1;
    const runId = createRunRef.current;
    console.log(
      `\n🟦 [Create&Lock] CLICK runId=${runId} busy=${busy} inFlight=${inFlightRef.current}`
    );

    if (inFlightRef.current) {
      console.warn(`🟨 [Create&Lock] BLOCKED (already inFlight) runId=${runId}`);
      return;
    }
    if (busy) {
      console.warn(`🟨 [Create&Lock] BLOCKED (busy state true) runId=${runId}`);
      return;
    }

    inFlightRef.current = true;

    resetMsg();
    resetFieldErrors();
    setBusy(true);

    const startedAt = Date.now();

    try {
      console.log(`🟦 [Create&Lock] START runId=${runId}`);

      requireWeb3Ready();
      validateHeaderSoft();
      validateMilestonesSoft();

      const odl = [BigInt(advanceApprovalBy || "0")];
      const wei = parseUnits18(priceHuman);

      setStatus("Creating order header… confirm in wallet.");
      const tx1 = await contracts.sg.createOrderHeader(
        buyer,
        seller,
        carrier || ZERO,
        inspector || ZERO,
        token,
        wei,
        Number(advanceBps),
        odl
      );

      setStatus("Waiting for confirmation…");
      const rc1 = await tx1.wait();

      let createdId = "";
      for (const log of rc1.logs || []) {
        try {
          const parsed = contracts.sg.interface.parseLog(log);
          if (parsed?.name === "OrderCreated") {
            createdId = parsed.args.orderId.toString();
            break;
          }
        } catch {}
      }
      if (!createdId) throw new Error("Could not parse OrderCreated event.");

      setOrderId(createdId);

      setStatus("Adding milestones… confirm in wallet for each milestone.");
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        const name32 = toBytes32Label(m.name);
        const dl = [
          BigInt(m.planBy || "0"),
          BigInt(m.deliveryBy || "0"),
          BigInt(m.inspectionBy || "0"),
          BigInt(m.buyerApprovalBy || "0"),
        ];

        setStatus(`Adding milestone ${i + 1}/${milestones.length}… confirm in wallet.`);
        const txM = await contracts.sg.addMilestone(
          BigInt(createdId),
          name32,
          Number(m.bps),
          dl
        );
        await txM.wait();
      }

      setStatus("Locking milestones… confirm in wallet.");
      const txLock = await contracts.sg.lockMilestones(BigInt(createdId));
      await txLock.wait();

      const elapsedMs = Date.now() - startedAt;
      console.log(`✅✅ [Create&Lock] DONE runId=${runId} elapsedMs=${elapsedMs}`, {
        orderId: createdId,
      });

      // Notify the next actor (the seller) that it's their turn — best effort.
      try {
        if (seller && seller.toLowerCase() !== String(account).toLowerCase()) {
          const orderstage =
            Number(advanceBps) > 0 ? "ثبت درخواست پیش‌پرداخت" : "ثبت برنامه ارسال";
          await notifyOrderStage(
            { walletAddress: seller, orderstage, orderId: createdId },
            accessToken
          );
        }
      } catch {}

      setStatus(`Created & locked ✅ orderId=${createdId}. Opening the order…`);
      router.push(`/app/orders/${createdId}`);
    } catch (e) {
      console.error(`🟥 [Create&Lock] ERROR runId=${runId}`, e);
      setError(e?.shortMessage || e?.message || "Create failed");
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }

  return (
    <PageShell>
      <Container>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <Link href="/app" className={styles.linkBtn}>
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            {!account ? (
              <ButtonPrimary onClick={connect}>
                <Wallet size={18} />
                Connect Wallet
              </ButtonPrimary>
            ) : !isCorrectChain ? (
              <ButtonPrimary onClick={switchToTargetChain}>
                Switch Network
                <ArrowRight size={18} />
              </ButtonPrimary>
            ) : (
              <span className={styles.progressPill}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#22c55e",
                    display: "inline-block",
                  }}
                />
                Connected
              </span>
            )}
          </div>
        </div>

        <WizardTop step={step} setStep={setStep} steps={steps} />

        <div className={styles.stack12} style={{ marginBottom: 24 }}>
          {accountsError ? (
            <InlineBanner kind="error" title="Accounts autocomplete error">
              {accountsError}
            </InlineBanner>
          ) : null}

          {status ? (
            <InlineBanner kind="success" title="Status">
              {status}
            </InlineBanner>
          ) : null}
          {error ? (
            <InlineBanner kind="error" title="Action needed">
              {error}
            </InlineBanner>
          ) : null}
        </div>

        {/* Main Column Only */}
        <div style={{ display: "grid", gap: 22 }}>
          {/* Step 1 */}
          {step === 1 ? (
            <Card fullBleed>
              <CardHeader
                title="Step 1 — Order Header"
                subtitle="Provide parties, settlement token, price (human), and advance terms."
                right={<ShieldCheck size={20} />}
              />
              <CardBody>
                <div className={styles.grid2}>
                  <SectionCard title="Parties" subtitle="Addresses that define the order participants">
                    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                      <AddressAutocomplete
                        label="Buyer"
                        hint="0x… or email…"
                        value={buyer}
                        setValue={setBuyer}
                        error={fieldErrors.buyer}
                        accounts={accounts}
                        loading={accountsLoading}
                        minChars={2}
                      />

                      <AddressAutocomplete
                        label="Seller"
                        hint="0x… or email…"
                        value={seller}
                        setValue={setSeller}
                        error={fieldErrors.seller}
                        accounts={accounts}
                        loading={accountsLoading}
                        minChars={2}
                      />

                      <AddressAutocomplete
                        label="Inspector (required)"
                        hint="0x… or email…"
                        value={inspector}
                        setValue={setInspector}
                        error={fieldErrors.inspector}
                        accounts={accounts}
                        loading={accountsLoading}
                        minChars={2}
                      />

                      <AddressAutocomplete
                        label="Carrier (optional)"
                        hint="0x… or email…"
                        value={carrier}
                        setValue={setCarrier}
                        error={fieldErrors.carrier}
                        accounts={accounts}
                        loading={accountsLoading}
                        minChars={2}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Payment & Token"
                    subtitle={`Human-friendly amount (decimals=${TOKEN_DECIMALS}) + percent-based advance`}
                  >
                    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                      <Field label="Token" error={fieldErrors.token} hint="from env by default">
                        <Input
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          placeholder="0x..."
                          autoComplete="off"
                          error={fieldErrors.token}
                          mono
                        />
                      </Field>

                      <Field
                        label="Price"
                        hint="e.g. 1.25"
                        error={fieldErrors.priceHuman}
                        rightSlot={
                          priceWei > 0n ? (
                            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>
                              wei: {truncateMiddle(priceWei.toString(), 10, 8)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, opacity: 0.6 }}>—</span>
                          )
                        }
                      >
                        <Input
                          value={priceHuman}
                          onChange={(e) => setPriceHuman(e.target.value)}
                          placeholder="0.0"
                          inputMode="decimal"
                          autoComplete="off"
                          error={fieldErrors.priceHuman}
                        />
                      </Field>

                      <Field
                        label="Advance (%)"
                        hint="e.g. 20 = 20%"
                        error={fieldErrors.advanceBps}
                        rightSlot={<span style={{ fontSize: 12, opacity: 0.65 }}>{advanceBps} bps</span>}
                      >
                        <Input
                          value={advancePercent}
                          onChange={(e) => setAdvancePercent(e.target.value)}
                          placeholder="20"
                          inputMode="decimal"
                          autoComplete="off"
                          error={fieldErrors.advanceBps}
                        />
                      </Field>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <DeadlineField
                          label="Advance approval deadline"
                          value={advanceApprovalBy}
                          onChange={setAdvanceApprovalBy}
                        />
                      </div>
                    </div>
                  </SectionCard>
                </div>

                <div className={styles.btnRow}>
                  <Chip kind={bpsOk ? "good" : "bad"}>
                    Total BPS: <span style={{ fontWeight: 900 }}>{totalBps}</span> / 10000
                  </Chip>

                  <ButtonPrimary
                    onClick={() => {
                      resetMsg();
                      resetFieldErrors();
                      goNext();
                    }}
                  >
                    Next <ArrowRight size={18} />
                  </ButtonPrimary>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* Step 2 */}
          {step === 2 ? (
            <Card fullBleed>
              <CardHeader
                title="Step 2 — Milestones"
                subtitle="Configure milestones and deadlines. Total BPS must be 10000."
                right={
                  <ButtonSecondary onClick={addMilestoneRow}>
                    <Plus size={18} />
                    Add Milestone
                  </ButtonSecondary>
                }
              />
              <CardBody>
                {fieldErrors.milestones ? (
                  <div style={{ marginBottom: 14 }}>
                    <InlineBanner kind="error">{fieldErrors.milestones}</InlineBanner>
                  </div>
                ) : null}

                <div className={styles.stack16}>
                  {milestones.map((m, idx) => (
                    <div
                      key={`ms-${idx}`}
                      style={{
                        borderRadius: 22,
                        background: "rgba(255,255,255,0.80)",
                        border: "1px solid rgba(2,6,23,0.10)",
                        boxShadow: "0 1px 0 rgba(2,6,23,0.05)",
                        padding: 16,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
                              <Layers size={18} />
                              Milestone #{idx + 1}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65, wordBreak: "break-word" }}>
                              bytes32:{" "}
                              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                                {toBytes32Label(m.name || "").slice(0, 18)}…
                              </span>
                            </div>
                          </div>

                          <ButtonSecondary onClick={() => removeMilestoneRow(idx)}>
                            <Trash2 size={18} />
                            Remove
                          </ButtonSecondary>
                        </div>

                        <div className={styles.grid2}>
                          <SectionCard title="Core" subtitle="Milestone identity & allocation">
                            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                              <Field label="Name" hint="m1 / steel_1" error={fieldErrors[`ms_${idx}_name`]}>
                                <Input
                                  value={m.name}
                                  onChange={(e) => updateMilestone(idx, "name", e.target.value)}
                                  placeholder="m1"
                                  autoComplete="off"
                                  error={fieldErrors[`ms_${idx}_name`]}
                                />
                              </Field>

                              <Field
                                label="Allocation (%)"
                                hint="e.g. 30 = 30%"
                                error={fieldErrors[`ms_${idx}_bps`]}
                                rightSlot={<span style={{ fontSize: 12, opacity: 0.65 }}>{m.bps} bps</span>}
                              >
                                <Input
                                  value={milestonePercents[idx] ?? ""}
                                  onChange={(e) => updateMilestonePercent(idx, e.target.value)}
                                  placeholder="30"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  error={fieldErrors[`ms_${idx}_bps`]}
                                />
                              </Field>
                            </div>
                          </SectionCard>

                          <SectionCard title="Deadlines" subtitle="Pick date & time">
                            <div className={styles.stack12}>
                              <DeadlineField label="planBy" value={m.planBy} onChange={(v) => updateMilestone(idx, "planBy", v)} />
                              <DeadlineField label="deliveryBy" value={m.deliveryBy} onChange={(v) => updateMilestone(idx, "deliveryBy", v)} />
                              <DeadlineField label="inspectionBy" value={m.inspectionBy} onChange={(v) => updateMilestone(idx, "inspectionBy", v)} />
                              <DeadlineField label="buyerApprovalBy" value={m.buyerApprovalBy} onChange={(v) => updateMilestone(idx, "buyerApprovalBy", v)} />
                            </div>
                          </SectionCard>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.btnRow} style={{ marginTop: 22 }}>
                  <Chip kind={bpsChipKind}>
                    Total BPS: <span style={{ fontWeight: 900 }}>{totalBps}</span> / 10000
                  </Chip>

                  {fieldErrors.bpsTotal ? (
                    <span style={{ fontSize: 12, color: "rgb(220,38,38)", fontWeight: 900 }}>
                      {fieldErrors.bpsTotal}
                    </span>
                  ) : null}

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <ButtonSecondary onClick={goBack}>
                      <ArrowLeft size={18} />
                      Back
                    </ButtonSecondary>
                    <ButtonPrimary onClick={goNext}>
                      Next <ArrowRight size={18} />
                    </ButtonPrimary>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* Step 3 */}
          {step === 3 ? (
            <Card fullBleed>
              <CardHeader
                title="Step 3 — Review"
                subtitle="Confirm everything, then create the order and lock milestones on-chain."
                right={<Sparkles size={20} />}
              />
              <CardBody>
                <div className={styles.grid2}>
                  <SectionCard title="Parties" subtitle="Verify participant addresses">
                    <div className={styles.stack12}>
                      <MiniStat label="Buyer" value={buyer || "—"} copyable />
                      <MiniStat label="Seller" value={seller || "—"} copyable />
                      <MiniStat label="Inspector" value={inspector || "—"} copyable />
                      <MiniStat label="Carrier" value={carrier || ZERO} copyable />
                    </div>
                  </SectionCard>

                  <SectionCard title="Terms" subtitle="Human-friendly UI, on-chain BPS">
                    <div className={styles.stack12}>
                      <MiniStat label="Token" value={token || "—"} copyable />
                      <MiniStat label="Price (human)" value={priceHuman || "—"} />
                      <MiniStat label="Price (wei)" value={priceWei > 0n ? priceWei.toString() : "—"} copyable />
                      <MiniStat label="Advance (%)" value={advancePercent || "0"} />
                      <MiniStat label="Advance (bps)" value={advanceBps || "0"} />
                      <MiniStat label="Milestones (bps)" value={`${milestonesTotalBps} / 10000`} />
                      <MiniStat label="Total BPS" value={`${totalBps} / 10000`} />
                      <MiniStat label="Advance Deadline" value={formatUnix(advanceApprovalBy) || "—"} />
                    </div>
                  </SectionCard>
                </div>

                <div className={styles.btnRow}>
                  <ButtonSecondary onClick={goBack} disabled={busy}>
                    <ArrowLeft size={18} />
                    Back
                  </ButtonSecondary>

                  <ButtonPrimary onClick={handleCreateAndLock} disabled={busy || !canWrite || !bpsOk} loading={busy}>
                    Create & Lock <ArrowRight size={18} />
                  </ButtonPrimary>
                </div>

                <div style={{ marginTop: 14 }}>
                  <InlineBanner kind="info" title="Staged payments">
                    No upfront deposit. After creating the order, the buyer locks
                    each stage's exact amount in escrow as the order progresses —
                    the advance first, then each milestone — released to the seller
                    on approval. You'll do this from the order page.
                  </InlineBanner>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Container>
    </PageShell>
  );
}