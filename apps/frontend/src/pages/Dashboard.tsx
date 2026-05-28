import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
  type Theme,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import type { BillStatus, StatsRange } from "@payables/shared";
import { useBills } from "../queries/useBills";
import { useDashboardStats } from "../queries/useDashboardStats";
import { formatMoney, isOverdue } from "../lib/format";

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
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
}

const STATUS_LABELS: Record<BillStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  paid: "Paid",
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
  }
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function Dashboard() {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  const { data: billsData, isLoading: billsLoading, isError: billsError } = useBills({
    page: 1,
    pageSize: 100,
  });

  const [range, setRange] = useState<StatsRange>("12m");
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats(range);

  useEffect(() => {
    if (billsError) toast.error("Couldn't load metrics");
  }, [billsError]);
  useEffect(() => {
    if (statsError) toast.error("Couldn't load stats");
  }, [statsError]);

  const bills = billsData?.items ?? [];
  const outstanding = bills
    .filter((b) => b.status !== "paid")
    .reduce((sum, b) => sum + Number(b.amount), 0);
  const overdueCount = bills.filter((b) => isOverdue(b.dueDate, b.status)).length;
  const pendingCount = bills.filter((b) => b.status === "pending_approval").length;

  const vendorBars = useMemo(() => {
    const items = stats?.topVendors ?? [];
    return {
      names: items.map((v) => truncate(v.vendorName, isSm ? 8 : 14)),
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

  const chartHeight = isSm ? 240 : 320;

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Dashboard
      </Typography>

      {billsLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading metrics" />
        </Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Total outstanding" value={formatMoney(String(outstanding))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard
                label="Overdue"
                value={String(overdueCount)}
                color={overdueCount > 0 ? "error.main" : undefined}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <MetricCard label="Pending approval" value={String(pendingCount)} />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardHeader
                  title="Top vendors by amount"
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
                />
                <CardContent sx={{ pt: 0 }}>
                  {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress size={28} aria-label="Loading vendor stats" />
                    </Box>
                  ) : vendorBars.values.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                      No bills yet.
                    </Typography>
                  ) : (
                    <BarChart
                      height={chartHeight}
                      xAxis={[
                        {
                          data: vendorBars.names,
                          scaleType: "band",
                          tickLabelStyle: isSm
                            ? { fontSize: 10, angle: -35, textAnchor: "end" }
                            : { fontSize: 12 },
                        },
                      ]}
                      yAxis={[
                        {
                          valueFormatter: (v: number) =>
                            v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`,
                        },
                      ]}
                      series={[
                        {
                          data: vendorBars.values,
                          color: theme.palette.primary.main,
                          valueFormatter: (v) => (v == null ? "" : formatMoney(String(v))),
                          label: "Total billed",
                        },
                      ]}
                      margin={{ left: 60, right: 16, top: 16, bottom: isSm ? 56 : 32 }}
                      hideLegend
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardHeader
                  title="Bills by status"
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
                />
                <CardContent sx={{ pt: 0 }}>
                  {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress size={28} aria-label="Loading status stats" />
                    </Box>
                  ) : statusSlices.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                      No bills yet.
                    </Typography>
                  ) : (
                    <PieChart
                      height={chartHeight}
                      series={[
                        {
                          data: statusSlices,
                          innerRadius: isSm ? 40 : 56,
                          paddingAngle: 2,
                          cornerRadius: 4,
                          arcLabel: (item) => String(item.value),
                          arcLabelMinAngle: 20,
                        },
                      ]}
                      slotProps={{
                        legend: { direction: "horizontal", sx: { fontSize: 12 } },
                      }}
                      hideLegend={isSm}
                      margin={{ top: 8, bottom: 48, left: 8, right: 8 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Monthly cost trend"
                  titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
                  action={
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={range}
                      onChange={(_, v) => v && setRange(v as StatsRange)}
                      aria-label="Time range"
                    >
                      <ToggleButton value="6m">6m</ToggleButton>
                      <ToggleButton value="12m">12m</ToggleButton>
                      <ToggleButton value="24m">24m</ToggleButton>
                    </ToggleButtonGroup>
                  }
                  sx={{ flexWrap: "wrap", gap: 1, "& .MuiCardHeader-action": { m: 0 } }}
                />
                <CardContent sx={{ pt: 0 }}>
                  {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress size={28} aria-label="Loading monthly stats" />
                    </Box>
                  ) : (
                    <LineChart
                      height={chartHeight}
                      xAxis={[
                        {
                          data: monthLabels,
                          scaleType: "point",
                          tickLabelStyle: isSm ? { fontSize: 10 } : { fontSize: 12 },
                        },
                      ]}
                      yAxis={[
                        {
                          valueFormatter: (v: number) =>
                            v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`,
                        },
                      ]}
                      series={[
                        {
                          data: monthValues,
                          color: theme.palette.primary.main,
                          area: true,
                          showMark: !isSm,
                          curve: "monotoneX",
                          valueFormatter: (v) => (v == null ? "" : formatMoney(String(v))),
                          label: "Total billed",
                        },
                      ]}
                      margin={{ left: 60, right: 16, top: 16, bottom: 32 }}
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
