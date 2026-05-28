import { useMemo, useState } from "react";
import { Chip, Stack, Typography } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { formatMoney } from "../../lib/format";
import { CHART_PRIMARY, compactMoney, truncate } from "./chartHelpers";
import { ChartCard } from "./ChartCard";

type MonthlyView = "total" | "perVendor";

type StatusAreaSeries = {
  data: number[];
  label: string;
  color: string;
  area: boolean;
  stack: string;
  curve: "monotoneX";
  showMark: boolean;
  valueFormatter: (v: number | null) => string;
};

export type VendorSeries = {
  vendorId: string;
  vendorName: string;
  color: string;
  data: number[];
};

export function MonthlyCostTrendChart({
  loading,
  isSm,
  height,
  rangeSubtitle,
  monthLabels,
  monthValues,
  hasStatusFilter,
  amountByStatusSeries,
  vendorSeriesAll,
}: {
  loading: boolean;
  isSm: boolean;
  height: number;
  rangeSubtitle: string;
  monthLabels: string[];
  monthValues: number[];
  hasStatusFilter: boolean;
  amountByStatusSeries: StatusAreaSeries[];
  vendorSeriesAll: VendorSeries[];
}) {
  const [view, setView] = useState<MonthlyView>("total");
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

  const subheader =
    view === "total" ? `Total — ${rangeSubtitle}` : `Top vendors — ${rangeSubtitle}`;

  const noVendors = view === "perVendor" && vendorSeriesAll.length === 0;
  const noVendorSelected =
    view === "perVendor" && vendorSeriesAll.length > 0 && perVendorSeries.length === 0;

  return (
    <ChartCard
      title="Monthly cost trend"
      subheader={subheader}
      loading={loading}
      loadingLabel="Loading monthly stats"
      action={
        <Stack direction="row" spacing={1}>
          <Chip
            label="Total"
            size="small"
            color={view === "total" ? "primary" : "default"}
            variant={view === "total" ? "filled" : "outlined"}
            onClick={() => setView("total")}
            clickable
          />
          <Chip
            label="Per vendor"
            size="small"
            color={view === "perVendor" ? "primary" : "default"}
            variant={view === "perVendor" ? "filled" : "outlined"}
            onClick={() => setView("perVendor")}
            clickable
          />
        </Stack>
      }
    >
      {view === "perVendor" && vendorSeriesAll.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
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
      {noVendors ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          No vendor activity in this range.
        </Typography>
      ) : noVendorSelected ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Select at least one vendor to display.
        </Typography>
      ) : (
      <LineChart
        height={height}
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
          view === "total"
            ? hasStatusFilter
              ? amountByStatusSeries
              : [
                  {
                    data: monthValues,
                    color: CHART_PRIMARY,
                    area: true,
                    showMark: !isSm,
                    curve: "monotoneX",
                    valueFormatter: (v) => (v == null ? "" : formatMoney(String(v))),
                    label: "Total billed",
                  },
                ]
            : perVendorSeries
        }
        margin={{ left: 64, right: 24, top: 16, bottom: 32 }}
        grid={{ horizontal: true }}
        hideLegend={view === "total" && !hasStatusFilter}
        slotProps={{
          legend: {
            direction: "horizontal",
            position: { vertical: "bottom", horizontal: "center" },
            sx: { fontSize: 12 },
          },
        }}
      />
      )}
    </ChartCard>
  );
}
