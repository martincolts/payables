import { useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useBills } from "../queries/useBills";
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

export function Dashboard() {
  // Pull a wide page to compute headline metrics client-side (MVP).
  const { data, isLoading, isError } = useBills({ page: 1, pageSize: 100 });

  useEffect(() => {
    if (isError) toast.error("Couldn't load metrics");
  }, [isError]);

  const bills = data?.items ?? [];
  const outstanding = bills
    .filter((b) => b.status !== "paid")
    .reduce((sum, b) => sum + Number(b.amount), 0);
  const overdueCount = bills.filter((b) => isOverdue(b.dueDate, b.status)).length;
  const pendingCount = bills.filter((b) => b.status === "pending_approval").length;

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Dashboard
      </Typography>

      {isLoading ? (
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
