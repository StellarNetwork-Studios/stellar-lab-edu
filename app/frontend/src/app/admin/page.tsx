"use client";

import { useEffect, useMemo, useState } from "react";
import { getQuickexApiBase } from "@/lib/api";

type FeatureFlag = {
  key: string;
  description: string;
  owner: string;
  enabled: boolean;
};

type ServiceHealth = {
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  detail: string;
};

type OpsEvent = {
  id: string;
  event: string;
  actor: string;
  severity: "info" | "warning" | "critical";
  timestampIso: string;
};

type HealthResponse = {
  status: string;
  version: string;
  uptime: number;
};

type ReadyResponse = {
  ready: boolean;
  checks: Array<{
    name: string;
    status: "up" | "down";
    latency?: string;
    details?: string[];
  }>;
};

const FLAGS_STORAGE_KEY = "admin-console-flags-v1";

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    key: "signed_action_prompts",
    description: "Require explicit signed intent for high-risk actions.",
    owner: "Security Team",
    enabled: true,
  },
  {
    key: "privacy_xray_mode",
    description: "Allow private transfer mode for eligible flows.",
    owner: "Payments Team",
    enabled: true,
  },
  {
    key: "marketplace_live_bidding",
    description: "Enable real-time marketplace bid updates.",
    owner: "Growth Team",
    enabled: false,
  },
];

const INITIAL_OPS_EVENTS: OpsEvent[] = [
  {
    id: "OPS-1083",
    event: "Feature flag updated: signed_action_prompts",
    actor: "menjay7",
    severity: "info",
    timestampIso: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: "OPS-1082",
    event: "Latency spike detected on Stellar Horizon",
    actor: "health-bot",
    severity: "warning",
    timestampIso: new Date(Date.now() - 9 * 60_000).toISOString(),
  },
  {
    id: "OPS-1081",
    event: "Payment retries crossed threshold on testnet",
    actor: "ops-bot",
    severity: "critical",
    timestampIso: new Date(Date.now() - 17 * 60_000).toISOString(),
  },
];

const FALLBACK_SERVICES: ServiceHealth[] = [
  {
    name: "api",
    status: "degraded",
    latencyMs: 0,
    detail: "Waiting for health checks...",
  },
];

function statusPillClass(status: ServiceHealth["status"]) {
  if (status === "healthy") return "text-emerald-300 bg-emerald-500/10";
  if (status === "degraded") return "text-amber-300 bg-amber-500/10";
  return "text-red-300 bg-red-500/10";
}

function severityPillClass(severity: OpsEvent["severity"]) {
  if (severity === "info") return "text-blue-300 bg-blue-500/10";
  if (severity === "warning") return "text-amber-300 bg-amber-500/10";
  return "text-red-300 bg-red-500/10";
}

export default function AdminConsolePage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);
  const [services, setServices] = useState<ServiceHealth[]>(FALLBACK_SERVICES);
  const [opsEvents, setOpsEvents] = useState<OpsEvent[]>(INITIAL_OPS_EVENTS);
  const [healthInfo, setHealthInfo] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const enabledFlagsCount = useMemo(
    () => flags.filter((flag) => flag.enabled).length,
    [flags],
  );

  const apiBase = useMemo(() => getQuickexApiBase(), []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FLAGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FeatureFlag[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setFlags(parsed);
      }
    } catch {
      // Ignore malformed local storage data.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(flags));
  }, [flags]);

  const pushOpsEvent = (event: Omit<OpsEvent, "id" | "timestampIso">) => {
    setOpsEvents((prev) => [
      {
        id: `OPS-${Math.floor(Math.random() * 9000) + 1000}`,
        timestampIso: new Date().toISOString(),
        ...event,
      },
      ...prev,
    ]);
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const [healthRes, readyRes] = await Promise.all([
        fetch(`${apiBase}/health`),
        fetch(`${apiBase}/ready`),
      ]);

      if (!healthRes.ok) {
        throw new Error(`/health failed (${healthRes.status})`);
      }

      const healthJson = (await healthRes.json()) as HealthResponse;
      setHealthInfo(healthJson);

      let serviceRows: ServiceHealth[] = [
        {
          name: "api",
          status: healthJson.status === "ok" ? "healthy" : "degraded",
          latencyMs: 0,
          detail: `Version ${healthJson.version} | Uptime ${healthJson.uptime}s`,
        },
      ];

      if (readyRes.ok || readyRes.status === 503) {
        const readyJson = (await readyRes.json()) as ReadyResponse;
        const dependencyRows = readyJson.checks.map((check) => {
          const parsedLatency = Number((check.latency ?? "").replace("ms", ""));
          return {
            name: check.name,
            status:
              check.status === "up"
                ? "healthy"
                : check.name === "environment"
                  ? "degraded"
                  : "down",
            latencyMs: Number.isFinite(parsedLatency) ? parsedLatency : 0,
            detail: check.details?.join(" | ") ?? "No extra details",
          } as ServiceHealth;
        });

        serviceRows = [...serviceRows, ...dependencyRows];
        if (!readyJson.ready) {
          pushOpsEvent({
            event: "Readiness check failed",
            actor: "health-bot",
            severity: "warning",
          });
        }
      }

      setServices(serviceRows);
    } catch {
      setHealthError("Unable to load backend health data.");
      setServices(FALLBACK_SERVICES);
      pushOpsEvent({
        event: "Health checks unavailable",
        actor: "health-bot",
        severity: "critical",
      });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(() => {
      void loadHealth();
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const toggleFlag = (key: string) => {
    setFlags((prev) => {
      const next = prev.map((flag) =>
        flag.key === key ? { ...flag, enabled: !flag.enabled } : flag,
      );
      const changed = next.find((item) => item.key === key);
      if (changed) {
        pushOpsEvent({
          event: `Feature flag ${changed.enabled ? "enabled" : "disabled"}: ${changed.key}`,
          actor: "admin-user",
          severity: "info",
        });
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen text-white">
      <section className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-3">
          Admin Console v1
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">
          Flags + Health + Ops Views
        </h1>
        <p className="text-neutral-400 max-w-3xl">
          Operate core production controls in one place. This view centralizes
          feature gating, service health, and operational events for faster
          incident response.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            Feature Flags
          </p>
          <p className="text-3xl font-black">{enabledFlagsCount}</p>
          <p className="text-xs text-neutral-500">Enabled now</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            Services Healthy
          </p>
          <p className="text-3xl font-black">
            {services.filter((svc) => svc.status === "healthy").length}/
            {services.length}
          </p>
          <p className="text-xs text-neutral-500">Current checks</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            Open Critical Ops
          </p>
          <p className="text-3xl font-black">
            {opsEvents.filter((evt) => evt.severity === "critical").length}
          </p>
          <p className="text-xs text-neutral-500">Needs attention</p>
        </div>
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5">
          <p className="text-xs uppercase tracking-widest text-indigo-200/80 mb-3">
            Repo Avatar
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center">
              Q
            </div>
            <div>
              <p className="font-bold">QiuckEx</p>
              <p className="text-xs text-indigo-100/70">menjay7/QiuckEx</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 rounded-3xl border border-white/10 bg-neutral-900/40 p-6">
          <h2 className="text-xl font-black mb-1">Feature Flags</h2>
          <p className="text-sm text-neutral-400 mb-5">
            Runtime controls for staged rollouts and risk mitigation.
          </p>
          <div className="space-y-4">
            {flags.map((flag) => (
              <div
                key={flag.key}
                className="rounded-2xl border border-white/10 p-4 bg-black/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm">{flag.key}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {flag.description}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-2">
                      Owner: {flag.owner}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFlag(flag.key)}
                    className={`text-xs px-3 py-1 rounded-full font-bold transition ${
                      flag.enabled
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-neutral-700 text-neutral-300"
                    }`}
                  >
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-1 rounded-3xl border border-white/10 bg-neutral-900/40 p-6">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-xl font-black">Health View</h2>
            <button
              type="button"
              onClick={() => {
                void loadHealth();
              }}
              className="text-xs px-3 py-1.5 rounded-full font-bold bg-white/10 hover:bg-white/20 transition"
            >
              Refresh
            </button>
          </div>
          <p className="text-sm text-neutral-400 mb-5">
            Service availability and basic latency posture.
          </p>
          {healthError && (
            <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
              {healthError}
            </p>
          )}
          {healthInfo && (
            <p className="text-xs text-neutral-500 mb-4">
              API v{healthInfo.version} | uptime {healthInfo.uptime}s
            </p>
          )}
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="rounded-2xl border border-white/10 p-4 bg-black/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold">{service.name}</p>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${statusPillClass(service.status)}`}
                  >
                    {service.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-neutral-400">
                  <span>
                    Latency: {service.latencyMs > 0 ? `${service.latencyMs}ms` : "n/a"}
                  </span>
                  <span className="text-right">{service.detail}</span>
                </div>
              </div>
            ))}
            {healthLoading && (
              <p className="text-xs text-neutral-500">Refreshing health checks...</p>
            )}
          </div>
        </div>

        <div className="xl:col-span-1 rounded-3xl border border-white/10 bg-neutral-900/40 p-6">
          <h2 className="text-xl font-black mb-1">Ops View</h2>
          <p className="text-sm text-neutral-400 mb-5">
            Recent operational events and alerts.
          </p>
          <div className="space-y-4">
            {opsEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 p-4 bg-black/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold">{event.id}</p>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${severityPillClass(event.severity)}`}
                  >
                    {event.severity}
                  </span>
                </div>
                <p className="text-sm text-neutral-200 mb-2">{event.event}</p>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>Actor: {event.actor}</span>
                  <span>{new Date(event.timestampIso).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
