import { PieChart } from "@mui/x-charts/PieChart";
import type { BillStatus } from "@payables/shared";
import { ChartCard } from "./ChartCard";

export type StatusSlice = {
  id: BillStatus;
  value: number;
  label: string;
  color: string;
};

export function BillsByStatusChart({
  loading,
  isSm,
  height,
  subheader,
  statusSlices,
  onStatusClick,
}: {
  loading: boolean;
  isSm: boolean;
  height: number;
  subheader: string;
  statusSlices: StatusSlice[];
  onStatusClick: (status: BillStatus) => void;
}) {
  return (
    <ChartCard
      title="Bills by status"
      subheader={subheader}
      loading={loading}
      loadingLabel="Loading status stats"
      empty={statusSlices.length === 0}
      emptyMessage="No bills in this range."
    >
      <PieChart
        height={height}
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
          onStatusClick(slice.id);
        }}
        sx={{ cursor: "pointer" }}
      />
    </ChartCard>
  );
}
