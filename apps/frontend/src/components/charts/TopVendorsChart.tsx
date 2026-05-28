import { BarChart } from "@mui/x-charts/BarChart";
import { formatMoney } from "../../lib/format";
import { CHART_PRIMARY, compactMoney } from "./chartHelpers";
import { ChartCard } from "./ChartCard";

type StatusBarSeries = {
  data: number[];
  label: string;
  color: string;
  stack: string;
  valueFormatter: (v: number | null) => string;
};

export function TopVendorsChart({
  loading,
  isSm,
  height,
  subheader,
  vendorBars,
  hasStatusFilter,
  statusBarSeries,
  onVendorClick,
}: {
  loading: boolean;
  isSm: boolean;
  height: number;
  subheader: string;
  vendorBars: { names: string[]; values: number[]; ids: string[] };
  hasStatusFilter: boolean;
  statusBarSeries: StatusBarSeries[];
  onVendorClick: (vendorId: string) => void;
}) {
  return (
    <ChartCard
      title="Top vendors by amount"
      subheader={subheader}
      loading={loading}
      loadingLabel="Loading vendor stats"
      empty={vendorBars.values.length === 0}
      emptyMessage="No bills in this range."
    >
      <BarChart
        height={height}
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
        series={
          hasStatusFilter
            ? statusBarSeries
            : [
                {
                  data: vendorBars.values,
                  color: CHART_PRIMARY,
                  valueFormatter: (v) => (v == null ? "" : formatMoney(String(v))),
                  label: "Total billed",
                },
              ]
        }
        borderRadius={4}
        margin={{
          left: isSm ? 90 : 130,
          right: 24,
          top: 16,
          bottom: hasStatusFilter ? 56 : 32,
        }}
        hideLegend={!hasStatusFilter}
        slotProps={{
          legend: {
            direction: "horizontal",
            position: { vertical: "bottom", horizontal: "center" },
            sx: { fontSize: 11 },
          },
        }}
        grid={{ vertical: true }}
        onItemClick={(_, item) => {
          const id = vendorBars.ids[item.dataIndex];
          if (!id) return;
          onVendorClick(id);
        }}
        sx={{ cursor: "pointer" }}
      />
    </ChartCard>
  );
}
