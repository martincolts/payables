import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Popover,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  addMonths,
  billStatuses,
  currentMonthKey,
  defaultStatsWindow,
  monthsBetween,
  type BillStatus,
  type MonthKey,
} from "@payables/shared";
import { useDashboardStats, type StatsWindow } from "../queries/useDashboardStats";
import { formatMoney } from "../lib/format";
import {
  STATUS_LABELS,
  VENDOR_PALETTE,
  formatMonthLabel,
  statusColor,
  statusChartColor,
  truncate,
} from "../components/charts/chartHelpers";
import { TopVendorsChart } from "../components/charts/TopVendorsChart";
import { BillsByStatusChart } from "../components/charts/BillsByStatusChart";
import { MonthlyCostTrendChart } from "../components/charts/MonthlyCostTrendChart";
import { BillVolumeChart } from "../components/charts/BillVolumeChart";

function MetricCard({
  label,
  value,
  color,
  to,
  children,
}: {
  label: string;
  value: string;
  color?: string;
  to?: string;
  children?: ReactNode;
}) {
  const card = (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        ...(to && {
          cursor: "pointer",
          transition: "box-shadow 0.15s, border-color 0.15s",
          "&:hover": { boxShadow: 2, borderColor: "primary.main" },
        }),
      }}
    >
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" component="div" sx={{ color, fontWeight: 600 }}>
          {value}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
  if (!to) return card;
  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
      {card}
    </Link>
  );
}

function OutstandingBreakdown({
  rows,
}: {
  rows: { status: BillStatus; amount: number; color: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <Stack spacing={0.5} sx={{ mt: 1.5 }}>
      {rows.map((r) => (
        <Box
          key={r.status}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: r.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {STATUS_LABELS[r.status]}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {formatMoney(String(r.amount))}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function CountBreakdown({
  rows,
}: {
  rows: { key: string; label: string; count: number; color: string; to: string; emphasize?: boolean }[];
}) {
  if (rows.length === 0) return null;
  return (
    <Stack spacing={0.5} sx={{ mt: 1.5 }}>
      {rows.map((r) => (
        <Box
          key={r.key}
          component={Link}
          to={r.to}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            textDecoration: "none",
            color: "inherit",
            borderRadius: 0.5,
            px: 0.5,
            mx: -0.5,
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: r.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {r.label}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontVariantNumeric: "tabular-nums",
              fontWeight: r.emphasize && r.count > 0 ? 700 : 500,
              color: r.emphasize && r.count > 0 ? "error.main" : "text.primary",
            }}
          >
            {r.count}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function windowToDateRange(w: StatsWindow): { issueAfter: string; issueBefore: string } {
  const [ty, tm] = w.to.split("-").map(Number);
  const issueAfter = `${w.from}-01`;
  const lastDay = new Date(ty!, tm!, 0).getDate();
  const issueBefore = `${w.to}-${String(lastDay).padStart(2, "0")}`;
  return { issueAfter, issueBefore };
}

function billsHref(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return `/bills?${sp.toString()}`;
}

function formatMonthLong(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

type PresetId = "3m" | "6m" | "12m" | "24m" | "ytd";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "3m", label: "3m" },
  { id: "6m", label: "6m" },
  { id: "12m", label: "12m" },
  { id: "24m", label: "24m" },
  { id: "ytd", label: "YTD" },
];

function presetWindow(id: PresetId): StatsWindow {
  const to = currentMonthKey();
  switch (id) {
    case "3m":
      return { from: addMonths(to, -2), to };
    case "6m":
      return { from: addMonths(to, -5), to };
    case "12m":
      return { from: addMonths(to, -11), to };
    case "24m":
      return { from: addMonths(to, -23), to };
    case "ytd":
      return { from: `${to.slice(0, 4)}-01`, to };
  }
}

function matchedPreset(w: StatsWindow): PresetId | null {
  for (const p of PRESETS) {
    const pw = presetWindow(p.id);
    if (pw.from === w.from && pw.to === w.to) return p.id;
  }
  return null;
}

function windowLabel(w: StatsWindow): string {
  return `${formatMonthLong(w.from)} – ${formatMonthLong(w.to)}`;
}

function RangePicker({
  value,
  onChange,
}: {
  value: StatsWindow;
  onChange: (w: StatsWindow) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<MonthKey>(value.from);
  const [to, setTo] = useState<MonthKey>(value.to);
  const [error, setError] = useState<string | null>(null);
  const active = matchedPreset(value);

  function openPopover() {
    setFrom(value.from);
    setTo(value.to);
    setError(null);
    setOpen(true);
  }

  function apply() {
    if (from > to) {
      setError("From must be on or before To");
      return;
    }
    if (monthsBetween(from, to) > 60) {
      setError("Range can be at most 60 months");
      return;
    }
    onChange({ from, to });
    setOpen(false);
  }

  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            size="small"
            color={active === p.id ? "primary" : "default"}
            variant={active === p.id ? "filled" : "outlined"}
            onClick={() => onChange(presetWindow(p.id))}
            clickable
          />
        ))}
        <Button
          ref={anchorRef}
          onClick={openPopover}
          size="small"
          variant={active === null ? "contained" : "outlined"}
          startIcon={<CalendarMonthIcon fontSize="small" />}
          sx={{ textTransform: "none" }}
        >
          {active === null ? windowLabel(value) : "Custom"}
        </Button>
      </Stack>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Custom range
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="From"
              type="month"
              size="small"
              value={from}
              onChange={(e) => setFrom(e.target.value as MonthKey)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="To"
              type="month"
              size="small"
              value={to}
              onChange={(e) => setTo(e.target.value as MonthKey)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            {error && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={apply}>
                Apply
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

export function Dashboard() {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();

  const [window, setWindow] = useState<StatsWindow>(() => {
    const d = defaultStatsWindow();
    return { from: d.from, to: d.to };
  });
  const [selectedStatuses, setSelectedStatuses] = useState<BillStatus[]>(() => [
    ...billStatuses,
  ]);
  const hasStatusFilter = selectedStatuses.length > 0;
  const selectedSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const { data: stats, isLoading: statsLoading, isError: statsError } =
    useDashboardStats(window, selectedStatuses);

  function toggleStatus(s: BillStatus) {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  useEffect(() => {
    if (statsError) toast.error("Couldn't load stats");
  }, [statsError]);

  const summary = stats?.summary;
  const overdueCount = summary?.overdueCount ?? 0;

  const outstandingBreakdown = useMemo(() => {
    const all = stats?.byStatus ?? [];
    const rows = all
      .filter((s) => selectedSet.has(s.status))
      .map((s) => ({
        status: s.status,
        amount: Number(s.totalAmount),
        color: statusColor(theme, s.status),
      }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((acc, r) => acc + r.amount, 0);
    return { rows, total };
  }, [stats, selectedSet, theme]);
  const outstanding = String(outstandingBreakdown.total);
  const totalBillsCount = (stats?.byStatus ?? [])
    .filter((s) => selectedSet.has(s.status))
    .reduce((acc, s) => acc + s.count, 0);
  const dateRange = windowToDateRange(window);
  const countByStatus = useMemo(() => {
    const m = new Map<BillStatus, number>();
    for (const s of stats?.byStatus ?? []) m.set(s.status, s.count);
    return m;
  }, [stats]);

  const billCountRows = useMemo(() => {
    const rows: {
      key: string;
      label: string;
      count: number;
      color: string;
      to: string;
      emphasize?: boolean;
    }[] = [];
    if (hasStatusFilter) {
      rows.push({
        key: "overdue",
        label: "Overdue",
        count: overdueCount,
        color: theme.palette.error.main,
        to: billsHref({ overdue: "true", ...dateRange }),
        emphasize: true,
      });
    }
    for (const s of billStatuses) {
      if (!selectedSet.has(s)) continue;
      rows.push({
        key: s,
        label: STATUS_LABELS[s],
        count: countByStatus.get(s) ?? 0,
        color: statusColor(theme, s),
        to: billsHref({ status: s, ...dateRange }),
        emphasize: s === "payment_failed",
      });
    }
    return rows;
  }, [overdueCount, countByStatus, theme, dateRange, hasStatusFilter, selectedSet]);

  const vendorBars = useMemo(() => {
    const items = [...(stats?.topVendors ?? [])].reverse();
    return {
      names: items.map((v) => truncate(v.vendorName, isSm ? 14 : 22)),
      values: items.map((v) => Number(v.totalAmount)),
      ids: items.map((v) => v.vendorId),
    };
  }, [stats, isSm]);

  const statusSlices = useMemo(() => {
    return (stats?.byStatus ?? []).map((s) => ({
      id: s.status,
      value: s.count,
      label: STATUS_LABELS[s.status],
      color: statusChartColor(theme, s.status),
    }));
  }, [stats, theme]);

  const monthly = stats?.monthly ?? [];
  const monthLabels = monthly.map((m) => formatMonthLabel(m.month));
  const monthValues = monthly.map((m) => Number(m.totalAmount));
  const monthCounts = monthly.map((m) => m.billCount);

  const vendorStatusAmount = useMemo(() => {
    const m = new Map<string, Map<BillStatus, number>>();
    for (const r of stats?.topVendorsByStatus ?? []) {
      let inner = m.get(r.vendorId);
      if (!inner) {
        inner = new Map();
        m.set(r.vendorId, inner);
      }
      inner.set(r.status, Number(r.totalAmount));
    }
    return m;
  }, [stats]);

  const monthStatusBreakdown = useMemo(() => {
    const m = new Map<string, Map<BillStatus, { amount: number; count: number }>>();
    for (const r of stats?.monthlyByStatus ?? []) {
      let inner = m.get(r.month);
      if (!inner) {
        inner = new Map();
        m.set(r.month, inner);
      }
      inner.set(r.status, {
        amount: Number(r.totalAmount),
        count: r.billCount,
      });
    }
    return m;
  }, [stats]);

  const vendorStatusBarSeries = useMemo(() => {
    if (!hasStatusFilter) return [];
    return selectedStatuses.map((s) => ({
      data: vendorBars.ids.map((id) => vendorStatusAmount.get(id)?.get(s) ?? 0),
      label: STATUS_LABELS[s],
      color: statusChartColor(theme, s),
      stack: "total",
      valueFormatter: (v: number | null) =>
        v == null || v === 0 ? "" : formatMoney(String(v)),
    }));
  }, [hasStatusFilter, selectedStatuses, vendorBars.ids, vendorStatusAmount, theme]);

  const monthlyAmountByStatusSeries = useMemo(() => {
    if (!hasStatusFilter) return [];
    return selectedStatuses.map((s) => ({
      data: monthly.map((m) => monthStatusBreakdown.get(m.month)?.get(s)?.amount ?? 0),
      label: STATUS_LABELS[s],
      color: statusChartColor(theme, s),
      area: true,
      stack: "total",
      curve: "monotoneX" as const,
      showMark: !isSm,
      valueFormatter: (v: number | null) =>
        v == null || v === 0 ? "" : formatMoney(String(v)),
    }));
  }, [hasStatusFilter, selectedStatuses, monthly, monthStatusBreakdown, theme, isSm]);

  const monthlyCountByStatusSeries = useMemo(() => {
    if (!hasStatusFilter) return [];
    return selectedStatuses.map((s) => ({
      data: monthly.map((m) => monthStatusBreakdown.get(m.month)?.get(s)?.count ?? 0),
      label: STATUS_LABELS[s],
      color: statusChartColor(theme, s),
      stack: "total",
      valueFormatter: (v: number | null) => (v == null || v === 0 ? "" : String(v)),
    }));
  }, [hasStatusFilter, selectedStatuses, monthly, monthStatusBreakdown, theme]);

  const vendorSeriesAll = useMemo(() => {
    const series = stats?.monthlyByVendor ?? [];
    return series.map((s, i) => ({
      vendorId: s.vendorId,
      vendorName: s.vendorName,
      color: VENDOR_PALETTE[i % VENDOR_PALETTE.length]!,
      data: s.points.map((p) => Number(p.totalAmount)),
    }));
  }, [stats]);

  const chartHeight = isSm ? 240 : 320;
  const monthlyChartHeight = isSm ? 260 : 360;
  const rangeSubtitle = windowLabel(window);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" component="h1">
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {rangeSubtitle}
          </Typography>
        </Box>
        <RangePicker value={window} onChange={setWindow} />
      </Box>

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: "wrap", mb: 3, alignItems: "center" }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Status:
        </Typography>
        {billStatuses.map((s) => {
          const active = selectedStatuses.includes(s);
          const color = statusColor(theme, s);
          return (
            <Chip
              key={s}
              label={STATUS_LABELS[s]}
              size="small"
              clickable
              variant={active ? "filled" : "outlined"}
              onClick={() => toggleStatus(s)}
              sx={{
                borderColor: color,
                backgroundColor: active ? color : "transparent",
                color: active ? "#fff" : color,
                "&:hover": {
                  backgroundColor: active ? color : `${color}22`,
                },
              }}
            />
          );
        })}
        <Chip
          label={hasStatusFilter ? "Clear" : "Select all"}
          size="small"
          variant="outlined"
          onClick={() =>
            setSelectedStatuses(hasStatusFilter ? [] : [...billStatuses])
          }
        />
      </Stack>

      {statsLoading && !stats ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading metrics" />
        </Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricCard label="Total outstanding" value={formatMoney(outstanding)}>
                <OutstandingBreakdown rows={outstandingBreakdown.rows} />
              </MetricCard>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricCard label="Bills" value={String(totalBillsCount)}>
                <CountBreakdown rows={billCountRows} />
              </MetricCard>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TopVendorsChart
                loading={statsLoading}
                isSm={isSm}
                height={chartHeight}
                subheader={rangeSubtitle}
                vendorBars={vendorBars}
                hasStatusFilter={hasStatusFilter}
                statusBarSeries={vendorStatusBarSeries}
                onVendorClick={(id) => navigate(billsHref({ vendorId: id, ...dateRange }))}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <BillsByStatusChart
                loading={statsLoading}
                isSm={isSm}
                height={chartHeight}
                subheader={rangeSubtitle}
                statusSlices={statusSlices}
                onStatusClick={(status) =>
                  navigate(billsHref({ status, ...dateRange }))
                }
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <MonthlyCostTrendChart
                loading={statsLoading}
                isSm={isSm}
                height={monthlyChartHeight}
                rangeSubtitle={rangeSubtitle}
                monthLabels={monthLabels}
                monthValues={monthValues}
                hasStatusFilter={hasStatusFilter}
                amountByStatusSeries={monthlyAmountByStatusSeries}
                vendorSeriesAll={vendorSeriesAll}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <BillVolumeChart
                loading={statsLoading}
                isSm={isSm}
                height={chartHeight}
                rangeSubtitle={rangeSubtitle}
                monthLabels={monthLabels}
                monthCounts={monthCounts}
                hasStatusFilter={hasStatusFilter}
                countByStatusSeries={monthlyCountByStatusSeries}
                onMonthClick={(idx) => {
                  const m = monthly[idx]?.month;
                  if (!m) return;
                  const [my, mm] = m.split("-").map(Number);
                  const lastDay = new Date(my!, mm!, 0).getDate();
                  navigate(
                    billsHref({
                      issueAfter: `${m}-01`,
                      issueBefore: `${m}-${String(lastDay).padStart(2, "0")}`,
                    }),
                  );
                }}
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button variant="contained" component={Link} to="/bills">
              View bills
            </Button>
            <Button variant="outlined" component={Link} to="/vendors">
              View vendors
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
