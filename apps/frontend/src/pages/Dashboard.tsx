import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
  Popover,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  type Theme,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  addMonths,
  currentMonthKey,
  defaultStatsWindow,
  monthsBetween,
  type BillStatus,
  type MonthKey,
} from "@payables/shared";
import { useDashboardStats, type StatsWindow } from "../queries/useDashboardStats";
import { formatMoney } from "../lib/format";

function MetricCard({
  label,
  value,
  color,
  to,
}: {
  label: string;
  value: string;
  color?: string;
  to?: string;
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

function windowToDateRange(w: StatsWindow): { dueAfter: string; dueBefore: string } {
  const [ty, tm] = w.to.split("-").map(Number);
  const dueAfter = `${w.from}-01`;
  const lastDay = new Date(ty!, tm!, 0).getDate();
  const dueBefore = `${w.to}-${String(lastDay).padStart(2, "0")}`;
  return { dueAfter, dueBefore };
}

function billsHref(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return `/bills?${sp.toString()}`;
}

const STATUS_LABELS: Record<BillStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  paid: "Paid",
  payment_failed: "Payment failed",
};

function statusColor(theme: Theme, status: BillStatus): string {
  switch (status) {
    case "draft":
      return theme.palette.grey[500];
    case "pending_approval":
      return theme.palette.warning.main;
    case "approved":
      return theme.palette.info.main;
    case "rejected":
      return theme.palette.error.main;
    case "scheduled":
      return theme.palette.secondary.main;
    case "paid":
      return theme.palette.success.main;
    case "payment_failed":
      return theme.palette.error.main;
  }
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function formatMonthLong(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function compactMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

const CHART_PRIMARY = "#3b82f6";

const VENDOR_PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
];

type MonthlyView = "total" | "perVendor";

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

  const [window, setWindow] = useState<StatsWindow>(() => {
    const d = defaultStatsWindow();
    return { from: d.from, to: d.to };
  });
  const [monthlyView, setMonthlyView] = useState<MonthlyView>("total");
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats(window);

  useEffect(() => {
    if (statsError) toast.error("Couldn't load stats");
  }, [statsError]);

  const summary = stats?.summary;
  const outstanding = summary?.totalOutstanding ?? "0";
  const overdueCount = summary?.overdueCount ?? 0;
  const pendingCount = summary?.pendingApprovalCount ?? 0;
  const paidCount = stats?.byStatus.find((s) => s.status === "paid")?.count ?? 0;
  const failedCount = stats?.byStatus.find((s) => s.status === "payment_failed")?.count ?? 0;
  const dateRange = windowToDateRange(window);
  const navigate = useNavigate();

  const vendorBars = useMemo(() => {
    const items = [...(stats?.topVendors ?? [])].reverse();
    return {
      names: items.map((v) => truncate(v.vendorName, isSm ? 14 : 22)),
      values: items.map((v) => Number(v.totalAmount)),
    };
  }, [stats, isSm]);

  const statusSlices = useMemo(() => {
    return (stats?.byStatus ?? []).map((s) => ({
      id: s.status,
      value: s.count,
      label: STATUS_LABELS[s.status],
      color: statusColor(theme, s.status),
    }));
  }, [stats, theme]);

  const monthly = stats?.monthly ?? [];
  const monthLabels = monthly.map((m) => formatMonthLabel(m.month));
  const monthValues = monthly.map((m) => Number(m.totalAmount));
  const monthCounts = monthly.map((m) => m.billCount);

  const vendorSeriesAll = useMemo(() => {
    const series = stats?.monthlyByVendor ?? [];
    return series.map((s, i) => ({
      vendorId: s.vendorId,
      vendorName: s.vendorName,
      color: VENDOR_PALETTE[i % VENDOR_PALETTE.length]!,
      data: s.points.map((p) => Number(p.totalAmount)),
    }));
  }, [stats]);

  const [excludedVendorIds, setExcludedVendorIds] = useState<Set<string>>(new Set());

  function toggleVendor(id: string) {
    setExcludedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const perVendorSeries = useMemo(
    () =>
      vendorSeriesAll
        .filter((v) => !excludedVendorIds.has(v.vendorId))
        .map((v) => ({
          data: v.data,
          label: v.vendorName,
          color: v.color,
          curve: "monotoneX" as const,
          showMark: !isSm,
          valueFormatter: (val: number | null) => (val == null ? "" : formatMoney(String(val))),
        })),
    [vendorSeriesAll, excludedVendorIds, isSm],
  );

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

      {statsLoading && !stats ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading metrics" />
        </Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <MetricCard label="Total outstanding" value={formatMoney(outstanding)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <MetricCard
                label="Overdue"
                value={String(overdueCount)}
                color={overdueCount > 0 ? "error.main" : undefined}
                to={billsHref({ overdue: "true", ...dateRange })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <MetricCard
                label="Pending approval"
                value={String(pendingCount)}
                to={billsHref({ status: "pending_approval", ...dateRange })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <MetricCard
                label="Paid"
                value={String(paidCount)}
                to={billsHref({ status: "paid", ...dateRange })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <MetricCard
                label="Payment failed"
                value={String(failedCount)}
                color={failedCount > 0 ? "error.main" : undefined}
                to={billsHref({ status: "payment_failed", ...dateRange })}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardHeader
                  title="Top vendors by amount"
                  subheader={rangeSubtitle}
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
                  subheaderTypographyProps={{ variant: "caption" }}
                />
                <CardContent sx={{ pt: 0 }}>
                  {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress size={28} aria-label="Loading vendor stats" />
                    </Box>
                  ) : vendorBars.values.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                      No bills in this range.
                    </Typography>
                  ) : (
                    <BarChart
                      height={chartHeight}
                      layout="horizontal"
                      yAxis={[
                        {
                          data: vendorBars.names,
                          scaleType: "band",
                          tickLabelStyle: { fontSize: isSm ? 10 : 12 },
                        },
                      ]}
                      xAxis={[
                        {
                          valueFormatter: compactMoney,
                          tickLabelStyle: { fontSize: 11 },
                        },
                      ]}
                      series={[
                        {
                          data: vendorBars.values,
                          color: CHART_PRIMARY,
                          valueFormatter: (v) => (v == null ? "" : formatMoney(String(v))),
                          label: "Total billed",
                        },
                      ]}
                      borderRadius={4}
                      margin={{ left: isSm ? 90 : 130, right: 24, top: 16, bottom: 32 }}
                      hideLegend
                      grid={{ vertical: true }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardHeader
                  title="Bills by status"
                  subheader={rangeSubtitle}
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
                  subheaderTypographyProps={{ variant: "caption" }}
                />
                <CardContent sx={{ pt: 0 }}>
                  {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress size={28} aria-label="Loading status stats" />
                    </Box>
                  ) : statusSlices.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                      No bills in this range.
                    </Typography>
                  ) : (
                    <PieChart
                      height={chartHeight}
                      series={[
                        {
                          data: statusSlices,
                          innerRadius: isSm ? 48 : 64,
                          outerRadius: isSm ? 96 : 120,
                          paddingAngle: 2,
                          cornerRadius: 6,
                          arcLabel: (item) => String(item.value),
                          arcLabelMinAngle: 18,
                          highlightScope: { fade: "global", highlight: "item" },
                        },
                      ]}
                      slotProps={{
                        legend: { direction: "horizontal", sx: { fontSize: 12 } },
                      }}
                      hideLegend={isSm}
                      margin={{ top: 8, bottom: 48, left: 8, right: 8 }}
                      onItemClick={(_, item) => {
                        const slice = statusSlices[item.dataIndex];
                        if (!slice) return;
                        navigate(billsHref({ status: slice.id, ...dateRange }));
                      }}
                      sx={{ cursor: "pointer" }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Monthly cost trend"
                  subheader={
                    monthlyView === "total"
                      ? `Total — ${rangeSubtitle}`
                      : `Top vendors — ${rangeSubtitle}`
                  }
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
                  subheaderTypographyProps={{ variant: "caption" }}
                  action={
                    <Stack direction="row" spacing={1}>
                      <Chip
                        label="Total"
                        size="small"
                        color={monthlyView === "total" ? "primary" : "default"}
                        variant={monthlyView === "total" ? "filled" : "outlined"}
                        onClick={() => setMonthlyView("total")}
                        clickable
                      />
                      <Chip
                        label="Per vendor"
                        size="small"
                        color={monthlyView === "perVendor" ? "primary" : "default"}
                        variant={monthlyView === "perVendor" ? "filled" : "outlined"}
                        onClick={() => setMonthlyView("perVendor")}
                        clickable
                      />
                    </Stack>
                  }
                  sx={{ flexWrap: "wrap", gap: 1, "& .MuiCardHeader-action": { m: 0 } }}
                />
                <CardContent sx={{ pt: 0 }}>
                  {monthlyView === "perVendor" && vendorSeriesAll.length > 0 && (
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{ flexWrap: "wrap", mb: 2 }}
                    >
                      {vendorSeriesAll.map((v) => {
                        const active = !excludedVendorIds.has(v.vendorId);
                        return (
                          <Chip
                            key={v.vendorId}
                            label={truncate(v.vendorName, 22)}
                            size="small"
                            clickable
                            variant={active ? "filled" : "outlined"}
                            onClick={() => toggleVendor(v.vendorId)}
                            sx={{
                              borderColor: v.color,
                              backgroundColor: active ? v.color : "transparent",
                              color: active ? "#fff" : v.color,
                              "&:hover": {
                                backgroundColor: active ? v.color : `${v.color}22`,
                              },
                            }}
                          />
                        );
                      })}
                    </Stack>
                  )}
                  {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress size={28} aria-label="Loading monthly stats" />
                    </Box>
                  ) : monthlyView === "perVendor" && vendorSeriesAll.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                      No vendor activity in this range.
                    </Typography>
                  ) : monthlyView === "perVendor" && perVendorSeries.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                      Select at least one vendor to display.
                    </Typography>
                  ) : (
                    <LineChart
                      height={monthlyChartHeight}
                      xAxis={[
                        {
                          data: monthLabels,
                          scaleType: "point",
                          tickLabelStyle: isSm ? { fontSize: 10 } : { fontSize: 12 },
                        },
                      ]}
                      yAxis={[
                        {
                          valueFormatter: compactMoney,
                          tickLabelStyle: { fontSize: 11 },
                        },
                      ]}
                      series={
                        monthlyView === "total"
                          ? [
                              {
                                data: monthValues,
                                color: CHART_PRIMARY,
                                area: true,
                                showMark: !isSm,
                                curve: "monotoneX",
                                valueFormatter: (v) =>
                                  v == null ? "" : formatMoney(String(v)),
                                label: "Total billed",
                              },
                            ]
                          : perVendorSeries
                      }
                      margin={{ left: 64, right: 24, top: 16, bottom: 32 }}
                      grid={{ horizontal: true }}
                      hideLegend={monthlyView === "total"}
                      slotProps={{
                        legend: {
                          direction: "horizontal",
                          position: { vertical: "bottom", horizontal: "center" },
                          sx: { fontSize: 12 },
                        },
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Bill volume per month"
                  subheader={`Number of bills issued — ${rangeSubtitle}`}
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
                  subheaderTypographyProps={{ variant: "caption" }}
                />
                <CardContent sx={{ pt: 0 }}>
                  {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress size={28} aria-label="Loading volume stats" />
                    </Box>
                  ) : (
                    <BarChart
                      height={chartHeight}
                      xAxis={[
                        {
                          data: monthLabels,
                          scaleType: "band",
                          tickLabelStyle: isSm ? { fontSize: 10 } : { fontSize: 12 },
                        },
                      ]}
                      yAxis={[
                        {
                          tickLabelStyle: { fontSize: 11 },
                          valueFormatter: (v: number) => String(Math.round(v)),
                        },
                      ]}
                      series={[
                        {
                          data: monthCounts,
                          color: CHART_PRIMARY,
                          label: "Bills",
                          valueFormatter: (v) => (v == null ? "" : String(v)),
                        },
                      ]}
                      borderRadius={4}
                      margin={{ left: 48, right: 24, top: 16, bottom: 32 }}
                      grid={{ horizontal: true }}
                      hideLegend
                    />
                  )}
                </CardContent>
              </Card>
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
