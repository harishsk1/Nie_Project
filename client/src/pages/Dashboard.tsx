import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Database,
  RefreshCw,
  Clock,
  Radio,
  BarChart3,
  Server,
  Zap,
  Info,
  Wifi,
  WifiOff,
  TrendingUp,
  Layers,
  ChevronRight,
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  FlameKindling,
  Eye,
  Milestone,
  Waves,
  Sun,
  CloudRain,
  Atom,
  Sigma,
} from "lucide-react";
import { deviceApi } from "../api/deviceApi";
import { dataApi } from "../api/dataApi";
import { formatDateTime, formatTime } from "../utils/dateTime";
import { useTheme } from "../contexts/ThemeContext";

interface ParameterLatest {
  name: string;
  value: string | number;
  unit?: string;
  updatedAt?: string;
  totalRecords: number;
}

interface SensorCardData {
  id: number;
  name: string;
  status: "healthy" | "warning" | "critical" | "offline";
  lastSync: string;
  totalRecords: number;
  parameters: ParameterLatest[];
}

const actionButtons = [
  {
    icon: Activity,
    label: "Live Streams",
    desc: "Monitor real-time sensor feeds",
    path: "/live-data",
    type: "navigate" as const,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: Database,
    label: "Archive Reports",
    desc: "Generate and export historical data",
    path: "/reports",
    type: "navigate" as const,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    gradient: "from-purple-500/20 to-purple-500/5",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    desc: "View detailed graphical analysis",
    path: "/bar-chart",
    type: "navigate" as const,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
];

const STATUS_CONFIG = {
  healthy: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    glow: "bg-emerald-500/10",
    icon: CheckCircle2,
    label: "Healthy",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
    glow: "bg-amber-500/10",
    icon: AlertTriangle,
    label: "Warning",
  },
  critical: {
    dot: "bg-rose-500",
    badge: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
    glow: "bg-rose-500/10",
    icon: Zap,
    label: "Critical",
  },
  offline: {
    dot: "bg-zinc-400",
    badge: "bg-zinc-500/10 border-zinc-500/30 text-zinc-500 dark:text-zinc-400",
    glow: "bg-zinc-500/10",
    icon: WifiOff,
    label: "Offline",
  },
};

// Colour palette cycling for parameter chips
const PARAM_COLORS = [
  "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
];

// Maps a parameter name keyword -> lucide icon component
const getParamIcon = (name: string): React.ElementType => {
  const n = name.toLowerCase();
  if (n.includes("temp"))                             return Thermometer;
  if (n.includes("humid") || n.includes("rh"))        return Droplets;
  if (n.includes("dew"))                              return CloudRain;
  if (n.includes("co2") || n.includes("carbon"))      return Wind;
  if (n.includes("press") || n.includes("baro"))      return Gauge;
  if (n.includes("gas") || n.includes("flame") || n.includes("smoke")) return FlameKindling;
  if (n.includes("light") || n.includes("lux") || n.includes("solar")) return Sun;
  if (n.includes("altitude") || n.includes("alt"))    return Milestone;
  if (n.includes("rain") || n.includes("precip"))     return CloudRain;
  if (n.includes("wind") || n.includes("air"))        return Wind;
  if (n.includes("moisture") || n.includes("water"))  return Waves;
  if (n.includes("visibility") || n.includes("vis"))  return Eye;
  if (n.includes("nh3") || n.includes("nox") || n.includes("pm")) return Atom;
  return Sigma; // generic fallback
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  const [sensorCards, setSensorCards] = useState<SensorCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsRefreshing(true);

      // 1. Get all devices
      const deviceList = await deviceApi.getAll();

      // 2. For each device, get the latest value of EVERY parameter
      const cardPromises = deviceList.map(async (device) => {
        let parameters: ParameterLatest[] = [];
        let totalRecs = 0;
        let status: SensorCardData["status"] = "offline";
        let lastSync = "Never";

        try {
          // Fetch the most recent 20 records so we can pick the latest value
          // for each distinct parameter name
          const response = await dataApi.fetchSensorData(device.name, {
            page: 1,
            limit: 50,
          });

          totalRecs = response.pagination?.totalRecords || 0;

          // Per-parameter counts returned by the backend
          const paramCounts = response.parameterCounts ?? {};

          // Build a map: paramName -> latest record for that param
          const paramMap = new Map<string, any>();
          const rawParams: any[] = response.parameters || [];

          // Records come in descending order (latest first); keep only the
          // first occurrence per parameter name.
          rawParams.forEach((p) => {
            if (!paramMap.has(p.name)) {
              paramMap.set(p.name, p);
            }
          });

          // Convert map to array, attaching the per-parameter record count
          parameters = Array.from(paramMap.values()).map((p) => ({
            name: p.name,
            value: p.value,
            unit: p.unit,
            updatedAt: p.created_at,
            totalRecords: paramCounts[p.name] ?? 0,
          }));

          // Determine status from parameters
          const firstParam = rawParams[0];
          if (!firstParam) {
            status = "offline";
          } else if (
            firstParam.status === "critical" ||
            firstParam.status === "error"
          ) {
            status = "critical";
          } else if (firstParam.status === "warning") {
            status = "warning";
          } else {
            status = "healthy";
          }

          lastSync = firstParam
            ? formatDateTime(firstParam.created_at)
            : "Never";
        } catch {
          status = "offline";
        }

        return {
          id: device.id,
          name: device.name,
          status,
          lastSync,
          totalRecords: totalRecs,
          parameters,
        } as SensorCardData;
      });

      const cards = await Promise.all(cardPromises);
      setSensorCards(cards);
      const total = cards.reduce((acc, c) => acc + c.totalRecords, 0);
      setTotalRecords(total);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const healthyCount = sensorCards.filter((d) => d.status === "healthy").length;
  const totalSensors = sensorCards.length;
  const totalParameters = sensorCards.reduce((acc, c) => acc + c.parameters.length, 0);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 overflow-x-hidden min-h-screen bg-background/50">

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs uppercase tracking-widest text-emerald-500 font-semibold">
              System Online
            </p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Dashboard

          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
            Real-time telemetry and live sensor monitoring for the NIE infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-card px-4 py-2.5 rounded-2xl border border-border shadow-sm">
          <div className="flex flex-col items-end border-r border-border pr-4">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
              Local Time
            </span>
            <div className="flex items-center gap-1.5 text-foreground font-semibold">
              <Clock className="w-4 h-4 text-primary" />
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          </div>
          <div className="flex flex-col items-start pl-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
              Last Sync
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{formatTime(lastRefresh)}</span>
              <button
                onClick={fetchDashboardData}
                disabled={isRefreshing}
                className={`p-1.5 rounded-md hover:bg-accent transition-colors ${isRefreshing
                  ? "animate-spin text-primary"
                  : "text-muted-foreground"
                  }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── KPI CARDS ────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Total Sensors */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all" />
          <div className="flex justify-between items-start mb-5 relative z-10">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Radio className="w-6 h-6" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <Wifi className="w-3 h-3" />
              {healthyCount} Active
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-bold text-foreground">
              {loading ? (
                <span className="inline-block w-12 h-8 bg-muted animate-pulse rounded-lg" />
              ) : (
                totalSensors
              )}
            </h3>
            <p className="text-sm font-semibold text-muted-foreground mt-1">
              Total Sensors
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              All registered sensor nodes
            </p>
          </div>
        </div>

        {/* Total Parameters */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl group-hover:bg-teal-500/20 transition-all" />
          <div className="flex justify-between items-start mb-5 relative z-10">
            <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-teal-500 bg-teal-500/10 px-2.5 py-1 rounded-full">
              Live
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-bold text-foreground">
              {loading ? (
                <span className="inline-block w-12 h-8 bg-muted animate-pulse rounded-lg" />
              ) : (
                totalParameters
              )}
            </h3>
            <p className="text-sm font-semibold text-muted-foreground mt-1">
              Total Parameters
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Unique readings across all sensors
            </p>
          </div>
        </div>

        {/* Data Records */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all" />
          <div className="flex justify-between items-start mb-5 relative z-10">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground bg-accent px-2.5 py-1 rounded-full">
              All Time
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-bold text-foreground">
              {loading ? (
                <span className="inline-block w-20 h-8 bg-muted animate-pulse rounded-lg" />
              ) : (
                totalRecords.toLocaleString()
              )}
            </h3>
            <p className="text-sm font-semibold text-muted-foreground mt-1">
              Data Records
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Cumulative across all sensors
            </p>
          </div>
        </div>
      </section>

      {/* ── SENSOR CARDS ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Sensor Overview</h2>
              <p className="text-xs text-muted-foreground">
                Latest parameter readings per sensor
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 bg-accent rounded-full text-muted-foreground">
            {totalSensors} Node{totalSensors !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          /* Skeleton grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card rounded-2xl border border-border p-5 shadow-sm animate-pulse"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-muted rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-10 bg-muted rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : sensorCards.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-14 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <Info className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              No Sensors Provisioned
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Add devices in Settings to begin real-time monitoring.
            </p>
            <button
              onClick={() => navigate("/settings")}
              className="mt-5 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              Go to Settings
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sensorCards.map((sensor) => {
              const cfg = STATUS_CONFIG[sensor.status];

              return (
                <div
                  key={sensor.id}
                  className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-border/60 bg-muted/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`relative p-2.5 ${cfg.glow} rounded-xl flex-shrink-0`}>
                          <Server className="w-5 h-5 text-foreground/70" />
                          <span
                            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${cfg.dot} ${sensor.status === "healthy" ? "animate-pulse" : ""}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-foreground text-base truncate leading-tight">
                            {sensor.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {sensor.lastSync !== "Never"
                              ? `Updated: ${sensor.lastSync}`
                              : "No data yet"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.badge}`}
                      >
                        {sensor.parameters.length}{" "}
                        {sensor.parameters.length === 1 ? "Parameter" : "Parameters"}
                      </span>
                    </div>

                    {/* Records mini-stat */}
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>
                        <strong className="text-foreground font-semibold">
                          {sensor.totalRecords.toLocaleString()}
                        </strong>{" "}
                        total records
                      </span>
                    </div>
                  </div>

                  {/* Parameter Grid */}
                  <div className="p-4 flex-1">
                    {sensor.parameters.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <WifiOff className="w-8 h-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          No parameter data available
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {sensor.parameters.map((param, idx) => {
                          const Icon = getParamIcon(param.name);
                          const colorCls = PARAM_COLORS[idx % PARAM_COLORS.length];
                          return (
                            <div
                              key={param.name}
                              className={`rounded-xl border px-3 py-3 flex flex-col gap-1.5 ${colorCls} hover:brightness-95 dark:hover:brightness-110 transition-all`}
                            >
                              {/* Icon + Label row */}
                              <div className="flex items-center gap-1.5">
                                <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-75 truncate leading-none">
                                  {param.name}
                                </span>
                              </div>

                              {/* Value + Unit */}
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-extrabold leading-none tracking-tight">
                                  {param.value !== undefined && param.value !== null
                                    ? String(param.value)
                                    : "--"}
                                </span>
                                {param.unit && (
                                  <span className="text-[11px] font-semibold opacity-70">
                                    {param.unit}
                                  </span>
                                )}
                              </div>

                              {/* Records footer */}
                              <div className="flex items-center gap-1 pt-1.5 border-t border-current/10">
                                <Database className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />
                                <span className="text-[9px] font-semibold opacity-55 truncate">
                                  {param.totalRecords.toLocaleString()} records
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  {/* <div className="px-4 pb-4">
                    <button
                      onClick={() => navigate("/live-data")}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-primary border border-primary/20 hover:bg-primary/5 transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      View Live Stream
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div> */}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── FLEET TELEMETRY TABLE ──────────────────────────────────────── */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Fleet Telemetry</h2>
              <p className="text-xs text-muted-foreground">Latest readings per sensor node</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
            {totalSensors} Node{totalSensors !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col style={{ width: "60px" }} />
              <col style={{ width: "180px" }} />
              <col style={{ width: "200px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "220px" }} />
            </colgroup>
            <thead>
              <tr className="bg-muted/60">
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-3.5 border-2 border-border">
                  Sl No
                </th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-3.5 border-2 border-border">
                  Sensors
                </th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-3.5 border-2 border-border">
                  Parameters
                </th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-3.5 border-2 border-border">
                  <span className="flex items-center justify-center gap-1">
                    Latest Value
                  </span>
                </th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-3.5 border-2 border-border">
                  Unit
                </th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-3.5 border-2 border-border">
                  Latest Update
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3 py-3.5 border-2 border-border/50">
                      <div className="h-4 bg-muted rounded w-6 mx-auto" />
                    </td>
                    <td className="px-4 py-3.5 border-2 border-border/50">
                      <div className="h-4 bg-muted rounded w-24 mx-auto" />
                    </td>
                    <td className="px-4 py-3.5 border-2 border-border/50">
                      <div className="h-4 bg-muted rounded-md w-24 mx-auto" />
                    </td>
                    <td className="px-4 py-3.5 border-2 border-border/50">
                      <div className="h-5 bg-muted rounded w-14 mx-auto" />
                    </td>
                    <td className="px-4 py-3.5 border-2 border-border/50">
                      <div className="h-4 bg-muted rounded w-10 mx-auto" />
                    </td>
                    <td className="px-4 py-3.5 border-2 border-border/50">
                      <div className="h-4 bg-muted rounded w-32 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : sensorCards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Info className="w-8 h-8 text-muted-foreground/30" />
                      <span>No sensors provisioned yet.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sensorCards.flatMap((sensor, sensorIdx) => {
                  const params = sensor.parameters;
                  const rowSpanCount = params.length > 0 ? params.length : 1;

                  if (params.length === 0) {
                    return [(
                      <tr
                        key={`${sensor.id}-empty`}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-3 py-3.5 text-center align-middle border-2 border-border/70 bg-muted/10">
                          <span className="text-sm font-bold text-foreground/60">{sensorIdx + 1}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle border-2 border-border/70">
                          <span className="font-semibold text-foreground text-sm">{sensor.name}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center border-2 border-border/70">
                          <span className="text-muted-foreground/40 text-xs italic">No data</span>
                        </td>
                        <td className="px-4 py-3.5 text-center border-2 border-border/70">
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        </td>
                        <td className="px-4 py-3.5 text-center border-2 border-border/70">
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        </td>
                        <td className="px-4 py-3.5 text-center border-2 border-border/70">
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        </td>
                      </tr>
                    )];
                  }

                  return params.map((param, pIdx) => {
                    const colorClass = PARAM_COLORS[pIdx % PARAM_COLORS.length];
                    const isFirst = pIdx === 0;
                    const isLastInGroup = pIdx === params.length - 1;

                    const paramTimestamp = param.updatedAt
                      ? formatDateTime(param.updatedAt)
                      : "—";

                    return (
                      <tr
                        key={`${sensor.id}-${param.name}`}
                        className="bg-card transition-colors hover:bg-primary/5"
                      >
                        {/* Sl No — rowspan */}
                        {isFirst && (
                          <td
                            rowSpan={rowSpanCount}
                            className="px-3 text-center align-middle border-2 border-border/70 bg-muted/10"
                          >
                            <span className="text-sm font-bold text-foreground/60">
                              {sensorIdx + 1}
                            </span>
                          </td>
                        )}

                        {/* Sensor name — rowspan */}
                        {isFirst && (
                          <td
                            rowSpan={rowSpanCount}
                            className="px-4 text-center align-middle border-2 border-border/70"
                          >
                            <span className="font-semibold text-foreground text-sm">
                              {sensor.name}
                            </span>
                          </td>
                        )}

                        {/* Parameter name */}
                        <td className="px-4 py-3 text-center border-2 border-border/70">
                          <span className="text-[12px] font-semibold text-foreground/80 tracking-wide">
                            {param.name}
                          </span>
                        </td>

                        {/* Latest Value */}
                        <td className="px-4 py-3 text-center border-2 border-border/70">
                          {param.value !== undefined && param.value !== null ? (
                            <span className="text-sm font-bold text-foreground tabular-nums">
                              {String(param.value)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>

                        {/* Unit */}
                        <td className="px-4 py-3 text-center border-2 border-border/70">
                          {param.unit ? (
                            <span className="text-[12px] font-mono font-medium text-muted-foreground">
                              {param.unit}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>

                        {/* Latest Update */}
                        <td className="px-4 py-3 text-center border-2 border-border/70">
                          <span className="text-xs font-medium text-foreground/60 tabular-nums">
                            {paramTimestamp}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl border border-border shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 bg-gradient-to-bl from-primary/5 to-transparent blur-3xl rounded-full pointer-events-none" />

        <h2 className="text-lg font-bold text-foreground mb-1 relative z-10">
          Quick Actions
        </h2>
        <p className="text-sm text-muted-foreground mb-6 relative z-10">
          Jump straight into essential workflows.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
          {actionButtons.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="group relative overflow-hidden rounded-xl border border-border bg-background p-5 text-left transition-all hover:shadow-md hover:border-primary/20"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity`}
                />
                <div
                  className={`absolute top-0 right-0 w-16 h-16 ${action.bg} rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150`}
                />

                <div
                  className={`relative z-10 p-2.5 w-11 h-11 flex items-center justify-center rounded-xl ${action.bg} ${action.color} mb-4`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <h3 className="relative z-10 font-bold text-foreground text-base mb-1 group-hover:text-primary transition-colors">
                  {action.label}
                </h3>
                <p className="relative z-10 text-xs font-medium text-muted-foreground">
                  {action.desc}
                </p>

                <div className="relative z-10 mt-4 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

