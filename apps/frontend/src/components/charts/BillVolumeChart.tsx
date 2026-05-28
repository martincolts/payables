import { BarChart } from "@mui/x-charts/BarChart";
import { CHART_PRIMARY } from "./chartHelpers";
import { ChartCard } from "./ChartCard";

type StatusCountSeries = {
  data: number[];
  label: string;
  color: string;
  stack: string;
  valueFormatter: (v: number | null) => string;
};

export function BillVolumeChart({
  loading,
  isSm,
  height,
  rangeSubtitle,
  monthLabels,
  monthCounts,
  hasStatusFilter,
  countByStatusSeries,
  onMonthClick,
}: {
  loading: boolean;
  isSm: boolean;
  height: number;
  rangeSubtitle: string;
  monthLabels: string[];
  monthCounts: number[];
  hasStatusFilter: boolean;
  countByStatusSeries: StatusCountSeries[];
  onMonthClick: (monthIndex: number) => void;
}) {
  return (
    <ChartCard
      title="Bill volume per month"
      subheader={`Number of bills issued — ${rangeSubtitle}`}
      loading={loading}
      loadingLabel="Loading volume stats"
    >
      <BarChart
        height={height}
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
        series={
          hasStatusFilter
            ? countByStatusSeries
            : [
                {
                  data: monthCounts,
                  color: CHART_PRIMARY,
                  label: "Bills",
                  valueFormatter: (v) => (v == null ? "" : String(v)),
                },
              ]
        }
        borderRadius={4}
        margin={{ left: 48, right: 24, top: 16, bottom: hasStatusFilter ? 56 : 32 }}
        grid={{ horizontal: true }}
        hideLegend={!hasStatusFilter}
        slotProps={{
          legend: {
            direction: "horizontal",
            position: { vertical: "bottom", horizontal: "center" },
            sx: { fontSize: 11 },
          },
        }}
        onItemClick={(_, item) => onMonthClick(item.dataIndex)}
        sx={{ cursor: "pointer" }}
      />
    </ChartCard>
  );
}
