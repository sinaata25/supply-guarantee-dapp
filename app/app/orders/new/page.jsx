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

import { useWeb3 } from "@/components/web3/Web3Provider";
import { WEB3_CONFIG } from "@/lib/web3/config";
import { toBytes32Label } from "@/lib/web3/bytes";

const ZERO = "0x0000000000000000000000000000000000000000";
const TOKEN_DECIMALS = 18;

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

/* ---------- UI Primitives ---------- */

function Badge({ kind = "neutral", children }) {
  const cls =
    kind === "good"
      ? "bg-green-50 text-green-800 ring-green-200"
      : kind === "bad"
        ? "bg-red-50 text-red-800 ring-red-200"
        : "bg-white text-gray-700 ring-black/10";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
        cls
      )}
    >
      {children}
    </span>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(900px_450px_at_15%_0%,rgba(0,0,0,0.06),transparent_55%),radial-gradient(900px_450px_at_90%_10%,rgba(0,0,0,0.05),transparent_55%),linear-gradient(to_bottom,#fafafa,#ffffff)]">
      {children}
    </div>
  );
}

function Container({ children }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-12 pb-24">
      {children}
    </div>
  );
}

function Card({ children, className }) {
  return (
    <div
      className={cx(
        "rounded-[24px] bg-white/80 backdrop-blur",
        "shadow-[0_1px_0_rgba(17,24,39,0.05),0_18px_60px_rgba(17,24,39,0.10)]",
        "ring-1 ring-black/5 overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="px-6 sm:px-7 pt-6 sm:pt-7">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-gray-900 truncate">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-sm text-gray-600 leading-relaxed">
              {subtitle}
            </div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

function CardBody({ children }) {
  return (
    <div className="px-6 sm:px-7 pb-10 sm:pb-12 pt-5 sm:pt-6">
      {children}
    </div>
  );
}

function SectionCard({ title, subtitle, children, className }) {
  return (
    <div
      className={cx(
        "rounded-[20px] bg-white/70 backdrop-blur",
        "ring-1 ring-black/10 shadow-[0_1px_0_rgba(17,24,39,0.05)]",
        "p-5 sm:p-6",
        className
      )}
    >
      {title || subtitle ? (
        <div className="mb-4">
          {title ? (
            <div className="text-sm font-semibold text-gray-900">{title}</div>
          ) : null}
          {subtitle ? (
            <div className="mt-1 text-xs text-gray-600">{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function InlineBanner({ kind = "info", title, children }) {
  const base = "rounded-2xl px-5 py-4 text-sm leading-relaxed ring-1";
  const styles =
    kind === "error"
      ? "bg-red-50/70 text-red-900 ring-red-200"
      : kind === "success"
        ? "bg-green-50/70 text-green-900 ring-green-200"
        : "bg-white/70 text-gray-900 ring-black/10";

  const icon =
    kind === "error" ? (
      <AlertTriangle className="h-4 w-4" />
    ) : kind === "success" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : (
      <Sparkles className="h-4 w-4" />
    );

  return (
    <div className={cx(base, styles)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0">
          {title ? <div className="font-semibold">{title}</div> : null}
          <div className={title ? "mt-1" : ""}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children, rightSlot }) {
  return (
    <div className="min-w-0">
      <div className="flex items-end justify-between gap-3">
        <label className="text-xs font-medium text-gray-700 truncate">
          {label}
        </label>
        <div className="flex items-center gap-2 min-w-0">
          {hint ? (
            <span className="text-xs text-gray-500 truncate">{hint}</span>
          ) : null}
          {rightSlot ? <span className="shrink-0">{rightSlot}</span> : null}
        </div>
      </div>
      {children}
      {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
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
}) {
  return (
    <input
      className={cx(
        "mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none transition",
        "border shadow-[0_1px_0_rgba(17,24,39,0.05)]",
        error
          ? "border-red-300 focus:border-red-400"
          : "border-gray-200 focus:border-gray-300",
        mono && "font-mono text-[13px]"
      )}
      value={value}
      onChange={onChange}
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
        "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium",
        "bg-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]",
        "transition hover:opacity-90 active:scale-[0.99] whitespace-nowrap",
        (disabled || loading) && "pointer-events-none opacity-60 shadow-none",
        className
      )}
      type="button"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
        "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium",
        "bg-white text-gray-900 ring-1 ring-black/10 shadow-[0_1px_0_rgba(17,24,39,0.05)]",
        "transition hover:bg-gray-50 active:scale-[0.99] whitespace-nowrap",
        disabled && "pointer-events-none opacity-60 shadow-none",
        className
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function Chip({ kind = "neutral", children }) {
  const cls =
    kind === "good"
      ? "bg-green-50 text-green-800 ring-green-200"
      : kind === "bad"
        ? "bg-red-50 text-red-800 ring-red-200"
        : "bg-white text-gray-900 ring-black/10";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1",
        cls
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
    <div className="w-full min-w-0">
      <div className="flex items-end justify-between gap-3">
        <div className="text-xs font-medium text-gray-700 truncate">
          {label}
        </div>
      </div>

      <div
        className={cx(
          "mt-2 w-full min-w-0 box-border",
          "rounded-2xl border border-gray-200 bg-white",
          "shadow-[0_1px_0_rgba(17,24,39,0.05)]",
          "px-3 py-2"
        )}
      >
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={openPicker}
            className={cx(
              "w-full sm:w-auto",
              "inline-flex items-center justify-center gap-2",
              "rounded-xl border border-gray-200 bg-white",
              "px-3 py-2 text-sm font-medium text-gray-900",
              "hover:bg-gray-50 transition",
              "min-h-[36px]"
            )}
            title="Pick date"
          >
            <Calendar className="h-4 w-4 text-gray-700" />
            {hasDate ? (
              <span className="max-w-[240px] truncate">{pretty}</span>
            ) : null}
          </button>

          {hasDate ? (
            <button
              type="button"
              onClick={() => onChange("0")}
              className={cx(
                "inline-flex items-center justify-center",
                "rounded-xl border border-gray-200 bg-white",
                "h-9 w-9 shrink-0",
                "hover:bg-gray-50 transition"
              )}
              title="Clear"
            >
              <X className="h-4 w-4 text-gray-700" />
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
  );
}

/* ---------- Stat ---------- */

function MiniStat({ label, value, copyable }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/10 px-5 py-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-gray-500">{label}</div>
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
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 hover:bg-gray-50 transition"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>

      <div
        className={cx(
          "mt-1 text-sm font-semibold text-gray-900 break-all",
          copyable && "font-mono text-[13px]"
        )}
        title={copyable ? value : undefined}
      >
        {copyable ? truncateMiddle(value || "—") : value || "—"}
      </div>
    </div>
  );
}

/* ---------- Stepper ---------- */

function StepPill({ state, idx, label, onClick }) {
  const dot =
    state === "done"
      ? "bg-black text-white"
      : state === "active"
        ? "bg-black text-white"
        : "bg-white text-gray-700 ring-1 ring-black/10";

  const text =
    state === "active"
      ? "text-gray-900"
      : state === "done"
        ? "text-gray-900"
        : "text-gray-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group inline-flex items-center gap-3 rounded-2xl px-3 py-2 transition select-none",
        "hover:bg-white/70"
      )}
    >
      <span
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition",
          dot
        )}
      >
        {state === "done" ? <Check className="h-5 w-5" /> : idx}
      </span>
      <span className={cx("text-sm font-medium whitespace-nowrap", text)}>
        {label}
      </span>
    </button>
  );
}

function WizardTop({ step, setStep, steps }) {
  const pct = ((step - 1) / (steps.length - 1)) * 100;

  return (
    <div className="mb-8 sm:mb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Sparkles className="h-4 w-4" />
            SupplyGuarantee • Wizard
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            New Order
          </div>
          <div className="mt-2 text-sm text-gray-600 max-w-2xl leading-relaxed">
            Step-by-step flow: enter details, configure milestones, review, then
            fund the escrow.
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">Progress</span>
          <span className="rounded-full bg-white ring-1 ring-black/10 px-3 py-1.5 text-xs font-semibold text-gray-900">
            {Math.round(pct)}%
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-[20px] bg-white/60 ring-1 ring-black/10 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
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

        <div className="mt-5">
          <div className="relative h-3 rounded-full bg-black/10 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-black to-gray-700 transition-all"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white ring-2 ring-black shadow-[0_8px_20px_rgba(0,0,0,0.20)] transition-all"
              style={{ left: `calc(${pct}% - 10px)` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{steps[0].label}</span>
            <span>{steps[steps.length - 1].label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function NewOrderPage() {
  const router = useRouter();
  const redirectTimerRef = useRef(null);

  const { account, isCorrectChain, connect, switchToTargetChain, contracts } =
    useWeb3();

  const steps = useMemo(
    () => [
      { k: 1, label: "Header" },
      { k: 2, label: "Milestones" },
      { k: 3, label: "Review" },
      { k: 4, label: "Funding" },
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
  const [bank, setBank] = useState("");
  const [arbiter, setArbiter] = useState("");

  const [token, setToken] = useState(WEB3_CONFIG.tokenAddress || "");

  const [priceHuman, setPriceHuman] = useState("");

  // Advance: UI percent, internal bps
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

  // ✅ UI percent for each milestone (same index as milestones)
  const [milestonePercents, setMilestonePercents] = useState(() => [
    bpsToPercentString("3000"),
    bpsToPercentString("3000"),
    bpsToPercentString("2000"),
  ]);

  const [orderId, setOrderId] = useState("");

  // cleanup redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // advance percent -> bps
  useEffect(() => {
    if (advancePercent === "") {
      setAdvanceBps("0");
      return;
    }
    const bps = percentToBps(advancePercent);
    if (bps === null) return;
    setAdvanceBps(String(bps));
  }, [advancePercent]);

  // sync milestonePercents length with milestones length + keep percents in sync if milestones bps change
  useEffect(() => {
    setMilestonePercents((prev) => {
      const next = [...prev];
      while (next.length < milestones.length) next.push("0");
      while (next.length > milestones.length) next.pop();
      for (let i = 0; i < milestones.length; i++) {
        const should = bpsToPercentString(milestones[i].bps);
        if (
          next[i] === "" ||
          Number(sanitizeNumberString(next[i])) * 100 !== Number(milestones[i].bps)
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

  const canWrite = !!contracts?.sg && !!contracts?.token && !!account && isCorrectChain;

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
    if (!bank) fe.bank = "Bank is required.";
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
    if (Object.keys(fe).length)
      throw new Error("Please fix the highlighted fields.");
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
    if (Object.keys(fe).length)
      throw new Error("Please fix the highlighted fields.");
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
      setStep((s) => Math.min(4, s + 1));
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
    // لاگ کلیک
    createRunRef.current += 1;
    const runId = createRunRef.current;
    console.log(`\n🟦 [Create&Lock] CLICK runId=${runId} busy=${busy} inFlight=${inFlightRef.current}`);

    // ✅ گارد خیلی محکم برای جلوگیری از اجرای دوباره
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

      console.log(`🟦 [Create&Lock] requireWeb3Ready... runId=${runId}`);
      requireWeb3Ready();

      console.log(`🟦 [Create&Lock] validateHeaderSoft... runId=${runId}`);
      validateHeaderSoft();

      console.log(`🟦 [Create&Lock] validateMilestonesSoft... runId=${runId}`);
      validateMilestonesSoft();

      const odl = [BigInt(advanceApprovalBy || "0")];
      const wei = parseUnits18(priceHuman);

      console.log(`🟦 [Create&Lock] Prepared params runId=${runId}`, {
        buyer,
        seller,
        carrier: carrier || ZERO,
        inspector: inspector || ZERO,
        bank,
        arbiter: arbiter || ZERO,
        token,
        wei: wei.toString(),
        advanceBps,
        odl: odl.map(String),
        milestonesCount: milestones.length,
        milestonesBps: milestones.map((m) => m.bps),
      });

      // ------------------ TX#1: createOrderHeader ------------------
      console.log(`🟦 [Create&Lock] TX#1 createOrderHeader: sending... runId=${runId}`);
      setStatus("Creating order header… confirm in wallet.");

      const tx1 = await contracts.sg.createOrderHeader(
        buyer,
        seller,
        carrier || ZERO,
        inspector || ZERO,
        bank,
        arbiter || ZERO,
        token,
        wei,
        Number(advanceBps),
        odl
      );

      console.log(`🟩 [Create&Lock] TX#1 SENT runId=${runId}`, {
        hash: tx1?.hash,
        nonce: tx1?.nonce,
        from: tx1?.from,
        to: tx1?.to,
      });

      setStatus("Waiting for confirmation…");
      const rc1 = await tx1.wait();

      console.log(`🟩 [Create&Lock] TX#1 CONFIRMED runId=${runId}`, {
        blockNumber: rc1?.blockNumber,
        transactionHash: rc1?.transactionHash,
        status: rc1?.status,
        logsLen: (rc1?.logs || []).length,
      });

      // parse orderId
      let createdId = "";
      for (const log of rc1.logs || []) {
        try {
          const parsed = contracts.sg.interface.parseLog(log);
          if (parsed?.name === "OrderCreated") {
            createdId = parsed.args.orderId.toString();
            break;
          }
        } catch (err) {
          // خیلی شلوغ نشه
        }
      }

      console.log(`🟦 [Create&Lock] Parsed orderId runId=${runId}`, { createdId });

      if (!createdId) throw new Error("Could not parse OrderCreated event.");

      setOrderId(createdId);

      // ------------------ TX#2..N: addMilestone ------------------
      console.log(`🟦 [Create&Lock] Adding milestones runId=${runId} count=${milestones.length}`);
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

        console.log(`🟦 [Create&Lock] TX addMilestone #${i + 1} PREP runId=${runId}`, {
          idx: i,
          name: m.name,
          name32,
          bps: m.bps,
          deadlines: dl.map(String),
        });

        setStatus(`Adding milestone ${i + 1}/${milestones.length}… confirm in wallet.`);
        const txM = await contracts.sg.addMilestone(
          BigInt(createdId),
          name32,
          Number(m.bps),
          dl
        );

        console.log(`🟩 [Create&Lock] TX addMilestone #${i + 1} SENT runId=${runId}`, {
          hash: txM?.hash,
          nonce: txM?.nonce,
          from: txM?.from,
          to: txM?.to,
        });

        const rcM = await txM.wait();

        console.log(`🟩 [Create&Lock] TX addMilestone #${i + 1} CONFIRMED runId=${runId}`, {
          txHash: rcM?.transactionHash,
          status: rcM?.status,
          blockNumber: rcM?.blockNumber,
        });
      }

      // ------------------ LAST TX: lockMilestones ------------------
      console.log(`🟦 [Create&Lock] TX lockMilestones PREP runId=${runId}`, {
        orderId: createdId,
      });

      setStatus("Locking milestones… confirm in wallet.");
      const txLock = await contracts.sg.lockMilestones(BigInt(createdId));

      console.log(`🟩 [Create&Lock] TX lockMilestones SENT runId=${runId}`, {
        hash: txLock?.hash,
        nonce: txLock?.nonce,
        from: txLock?.from,
        to: txLock?.to,
      });

      const rcLock = await txLock.wait();

      console.log(`🟩 [Create&Lock] TX lockMilestones CONFIRMED runId=${runId}`, {
        txHash: rcLock?.transactionHash,
        status: rcLock?.status,
        blockNumber: rcLock?.blockNumber,
      });

      const elapsedMs = Date.now() - startedAt;
      console.log(`✅✅ [Create&Lock] DONE runId=${runId} elapsedMs=${elapsedMs}`, {
        orderId: createdId,
      });

      setStatus(`Created & locked ✅ orderId=${createdId}. Redirecting to home…`);

      // ⚠️ ریدایرکت اینجا مشکلی ایجاد نمی‌کند؛ فقط ناوبری است.
      // اگر home شما /app است این را عوض کن
      router.push("/");
    } catch (e) {
      console.error(`🟥 [Create&Lock] ERROR runId=${runId}`, e);
      setError(e?.shortMessage || e?.message || "Create failed");
    } finally {
      console.log(`🟦 [Create&Lock] FINALLY runId=${runId} busy->false inFlight->false`);
      setBusy(false);
      inFlightRef.current = false;
    }
  }


  //******************************************************************************** */
  async function handleApproveAndFund() {
    resetMsg();
    resetFieldErrors();
    setBusy(true);
    try {
      requireWeb3Ready();
      if (!orderId) throw new Error("No orderId. Create the order first.");

      const amt = parseUnits18(priceHuman);
      if (amt <= 0n) throw new Error("Invalid price.");

      setStatus("Approving token spend… confirm in wallet.");
      const tx1 = await contracts.token.approve(WEB3_CONFIG.sgAddress, amt);
      await tx1.wait();

      setStatus("Funding escrow… confirm in wallet.");
      const tx2 = await contracts.sg.fund(BigInt(orderId), amt);
      await tx2.wait();

      setStatus("Funded ✅");
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Approve/Fund failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <Container>
        {/* Top Bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/10 px-5 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {!account ? (
              <ButtonPrimary onClick={connect}>
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </ButtonPrimary>
            ) : !isCorrectChain ? (
              <ButtonPrimary onClick={switchToTargetChain}>
                Switch Network
                <ArrowRight className="h-4 w-4" />
              </ButtonPrimary>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-black/10 px-4 py-2 text-sm font-medium text-gray-900">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Connected
              </span>
            )}
          </div>
        </div>

        <WizardTop step={step} setStep={setStep} steps={steps} />

        <div className="space-y-3 mb-8">
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

        <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
          {/* Main */}
          <div className="min-w-0 space-y-8">
            {/* Step 1 */}
            {step === 1 ? (
              <Card>
                <CardHeader
                  title="Step 1 — Order Header"
                  subtitle="Provide parties, settlement token, price (human), and advance terms."
                  right={<ShieldCheck className="h-5 w-5 text-gray-900" />}
                />
                <CardBody>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <SectionCard
                      title="Parties"
                      subtitle="Addresses that define the order participants"
                    >
                      <div className="grid gap-6 sm:grid-cols-2">
                        <Field label="Buyer" error={fieldErrors.buyer} hint="0x…">
                          <Input
                            value={buyer}
                            onChange={(e) => setBuyer(e.target.value)}
                            placeholder="0x..."
                            autoComplete="off"
                            error={fieldErrors.buyer}
                            mono
                          />
                        </Field>
                        <Field label="Seller" error={fieldErrors.seller} hint="0x…">
                          <Input
                            value={seller}
                            onChange={(e) => setSeller(e.target.value)}
                            placeholder="0x..."
                            autoComplete="off"
                            error={fieldErrors.seller}
                            mono
                          />
                        </Field>
                        <Field label="Bank" error={fieldErrors.bank} hint="0x…">
                          <Input
                            value={bank}
                            onChange={(e) => setBank(e.target.value)}
                            placeholder="0x..."
                            autoComplete="off"
                            error={fieldErrors.bank}
                            mono
                          />
                        </Field>
                        <Field
                          label="Inspector (required)"
                          error={fieldErrors.inspector}
                          hint="0x…"
                        >
                          <Input
                            value={inspector}
                            onChange={(e) => setInspector(e.target.value)}
                            placeholder="0x..."
                            autoComplete="off"
                            error={fieldErrors.inspector}
                            mono
                          />
                        </Field>
                        <Field label="Carrier (optional)" hint="0x… or empty">
                          <Input
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                            placeholder="0x... or empty"
                            autoComplete="off"
                            mono
                          />
                        </Field>
                        <Field label="Arbiter (optional)" hint="0x… or empty">
                          <Input
                            value={arbiter}
                            onChange={(e) => setArbiter(e.target.value)}
                            placeholder="0x... or empty"
                            autoComplete="off"
                            mono
                          />
                        </Field>
                      </div>
                    </SectionCard>

                    <SectionCard
                      title="Payment & Token"
                      subtitle={`Human-friendly amount (decimals=${TOKEN_DECIMALS}) + percent-based advance`}
                    >
                      <div className="grid gap-6 sm:grid-cols-2">
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
                              <span className="inline-flex items-center gap-2">
                                <Badge kind="good">Wei</Badge>
                                <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">
                                  {truncateMiddle(priceWei.toString(), 10, 8)}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
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
                          rightSlot={
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {advanceBps} bps
                            </span>
                          }
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

                        <div className="sm:col-span-2">
                          <DeadlineField
                            label="Advance approval deadline"
                            value={advanceApprovalBy}
                            onChange={setAdvanceApprovalBy}
                          />
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <Chip kind={bpsOk ? "good" : "bad"}>
                      Total BPS: <span className="font-semibold">{totalBps}</span> / 10000
                    </Chip>

                    <ButtonPrimary
                      onClick={() => {
                        resetMsg();
                        resetFieldErrors();
                        goNext();
                      }}
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </ButtonPrimary>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {/* Step 2 */}
            {step === 2 ? (
              <Card>
                <CardHeader
                  title="Step 2 — Milestones"
                  subtitle="Configure milestones and deadlines. Total BPS must be 10000."
                  right={
                    <ButtonSecondary onClick={addMilestoneRow}>
                      <Plus className="h-4 w-4" />
                      Add Milestone
                    </ButtonSecondary>
                  }
                />
                <CardBody>
                  {fieldErrors.milestones ? (
                    <div className="mb-5">
                      <InlineBanner kind="error">{fieldErrors.milestones}</InlineBanner>
                    </div>
                  ) : null}

                  <div className="space-y-6">
                    {milestones.map((m, idx) => (
                      <div
                        key={`ms-${idx}`}
                        className="rounded-[20px] bg-white ring-1 ring-black/10 px-6 py-5 shadow-[0_1px_0_rgba(17,24,39,0.05)] overflow-hidden"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                              <Layers className="h-4 w-4" />
                              Milestone #{idx + 1}
                            </div>
                            <div className="mt-2 text-xs text-gray-500 break-words">
                              bytes32:{" "}
                              <span className="font-mono">
                                {toBytes32Label(m.name || "").slice(0, 18)}…
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => removeMilestoneRow(idx)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/10 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 transition whitespace-nowrap"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        </div>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                          <SectionCard
                            title="Core"
                            subtitle="Milestone identity & allocation"
                            className="bg-white"
                          >
                            <div className="grid gap-6 sm:grid-cols-2">
                              <Field
                                label="Name"
                                hint="m1 / steel_1"
                                error={fieldErrors[`ms_${idx}_name`]}
                              >
                                <Input
                                  value={m.name}
                                  onChange={(e) =>
                                    updateMilestone(idx, "name", e.target.value)
                                  }
                                  placeholder="m1"
                                  autoComplete="off"
                                  error={fieldErrors[`ms_${idx}_name`]}
                                />
                              </Field>

                              <Field
                                label="Allocation (%)"
                                hint="e.g. 30 = 30%"
                                error={fieldErrors[`ms_${idx}_bps`]}
                                rightSlot={
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {m.bps} bps
                                  </span>
                                }
                              >
                                <Input
                                  value={milestonePercents[idx] ?? ""}
                                  onChange={(e) =>
                                    updateMilestonePercent(idx, e.target.value)
                                  }
                                  placeholder="30"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  error={fieldErrors[`ms_${idx}_bps`]}
                                />
                              </Field>
                            </div>
                          </SectionCard>

                          <SectionCard
                            title="Deadlines"
                            subtitle="Pick date & time"
                            className="bg-white"
                          >
                            <div className="grid gap-4">
                              <DeadlineField
                                label="planBy"
                                value={m.planBy}
                                onChange={(v) => updateMilestone(idx, "planBy", v)}
                              />
                              <DeadlineField
                                label="deliveryBy"
                                value={m.deliveryBy}
                                onChange={(v) =>
                                  updateMilestone(idx, "deliveryBy", v)
                                }
                              />
                              <DeadlineField
                                label="inspectionBy"
                                value={m.inspectionBy}
                                onChange={(v) =>
                                  updateMilestone(idx, "inspectionBy", v)
                                }
                              />
                              <DeadlineField
                                label="buyerApprovalBy"
                                value={m.buyerApprovalBy}
                                onChange={(v) =>
                                  updateMilestone(idx, "buyerApprovalBy", v)
                                }
                              />
                            </div>
                          </SectionCard>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 pt-8 flex flex-wrap items-center justify-between gap-4">
                    <Chip kind={bpsChipKind}>
                      Total BPS: <span className="font-semibold">{totalBps}</span> / 10000
                    </Chip>

                    {fieldErrors.bpsTotal ? (
                      <span className="text-xs text-red-600">{fieldErrors.bpsTotal}</span>
                    ) : null}

                    <div className="flex items-center gap-3">
                      <ButtonSecondary onClick={goBack}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </ButtonSecondary>
                      <ButtonPrimary onClick={goNext}>
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </ButtonPrimary>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {/* Step 3 */}
            {step === 3 ? (
              <Card>
                <CardHeader
                  title="Step 3 — Review"
                  subtitle="Confirm everything, then create the order and lock milestones on-chain."
                  right={<Sparkles className="h-5 w-5 text-gray-900" />}
                />
                <CardBody>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <SectionCard
                      title="Parties"
                      subtitle="Verify participant addresses"
                      className="bg-white"
                    >
                      <div className="grid gap-3">
                        <MiniStat label="Buyer" value={buyer || "—"} copyable />
                        <MiniStat label="Seller" value={seller || "—"} copyable />
                        <MiniStat label="Bank" value={bank || "—"} copyable />
                        <MiniStat label="Inspector" value={inspector || "—"} copyable />
                        <MiniStat label="Carrier" value={carrier || ZERO} copyable />
                        <MiniStat label="Arbiter" value={arbiter || ZERO} copyable />
                      </div>
                    </SectionCard>

                    <SectionCard
                      title="Terms"
                      subtitle="Human-friendly UI, on-chain BPS"
                      className="bg-white"
                    >
                      <div className="grid gap-3">
                        <MiniStat label="Token" value={token || "—"} copyable />
                        <MiniStat label="Price (human)" value={priceHuman || "—"} />
                        <MiniStat
                          label="Price (wei)"
                          value={priceWei > 0n ? priceWei.toString() : "—"}
                          copyable
                        />
                        <MiniStat label="Advance (%)" value={advancePercent || "0"} />
                        <MiniStat label="Advance (bps)" value={advanceBps || "0"} />
                        <MiniStat
                          label="Milestones (bps)"
                          value={`${milestonesTotalBps} / 10000`}
                        />
                        <MiniStat label="Total BPS" value={`${totalBps} / 10000`} />
                        <MiniStat
                          label="Advance Deadline"
                          value={formatUnix(advanceApprovalBy) || "—"}
                        />
                      </div>
                    </SectionCard>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <ButtonSecondary onClick={goBack} disabled={busy}>
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </ButtonSecondary>

                    <ButtonPrimary
                      onClick={handleCreateAndLock}
                      disabled={busy || !canWrite || !bpsOk}
                      loading={busy}
                    >
                      Create & Lock
                      <ArrowRight className="h-4 w-4" />
                    </ButtonPrimary>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {/* Step 4 */}
            {step === 4 ? (
              <Card>
                <CardHeader
                  title="Step 4 — Funding"
                  subtitle="Approve token allowance, then fund escrow with the full price."
                  right={
                    orderId ? (
                      <span className="rounded-full bg-white ring-1 ring-black/10 px-4 py-2 text-sm font-semibold text-gray-900">
                        orderId: <span className="font-mono">{orderId}</span>
                      </span>
                    ) : null
                  }
                />
                <CardBody>
                  <div className="grid gap-6 md:grid-cols-2">
                    <MiniStat label="Token" value={WEB3_CONFIG.tokenAddress} copyable />
                    <MiniStat
                      label="Escrow (SupplyGuarantee)"
                      value={WEB3_CONFIG.sgAddress}
                      copyable
                    />
                    <MiniStat label="ChainId" value={String(WEB3_CONFIG.chainId)} />
                    <MiniStat label="Amount (human)" value={priceHuman || "—"} />
                    <MiniStat
                      label="Amount (wei)"
                      value={priceWei > 0n ? priceWei.toString() : "—"}
                      copyable
                    />
                    <MiniStat
                      label="Formatted check"
                      value={priceWei > 0n ? formatUnits18(priceWei) : "—"}
                    />
                  </div>

                  <div className="mt-6">
                    <InlineBanner kind="info" title="What will happen">
                      This triggers <span className="font-mono">token.approve()</span>{" "}
                      and then <span className="font-mono">sg.fund()</span>.
                    </InlineBanner>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <ButtonSecondary onClick={goBack} disabled={busy}>
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </ButtonSecondary>

                    {!account ? (
                      <ButtonPrimary onClick={connect}>
                        <Wallet className="h-4 w-4" />
                        Connect Wallet
                      </ButtonPrimary>
                    ) : !isCorrectChain ? (
                      <ButtonPrimary onClick={switchToTargetChain}>
                        Switch Network
                        <ArrowRight className="h-4 w-4" />
                      </ButtonPrimary>
                    ) : (
                      <ButtonPrimary
                        onClick={handleApproveAndFund}
                        disabled={!canWrite || !orderId || priceWei <= 0n}
                        loading={busy}
                      >
                        <Coins className="h-4 w-4" />
                        Approve + Fund
                      </ButtonPrimary>
                    )}
                  </div>
                </CardBody>
              </Card>
            ) : null}
          </div>

          {/* Side */}
        </div>
      </Container>
    </PageShell>
  );
}
