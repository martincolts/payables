import { useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { activityActions, type ActivityAction } from "@payables/shared";
import { useActivityLog } from "../queries/useActivityLog";
import { useMembers } from "../queries/useOrganization";

const ACTION_LABELS: Record<ActivityAction, string> = {
  bill_created: "Bill created",
  bill_submitted: "Bill submitted",
  bill_approved: "Bill approved",
  bill_rejected: "Bill rejected",
  bill_deleted: "Bill deleted",
  vendor_created: "Vendor created",
  vendor_deactivated: "Vendor deactivated",
};

const ACTION_COLORS: Record<ActivityAction, "default" | "info" | "success" | "warning" | "error"> = {
  bill_created: "info",
  bill_submitted: "info",
  bill_approved: "success",
  bill_rejected: "error",
  bill_deleted: "warning",
  vendor_created: "info",
  vendor_deactivated: "warning",
};

function formatTimestamp(iso: string): string {
  // The list is already newest-first; show a concise local-time stamp.
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metadataSummary(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  // Pick the fields users actually care about; fall back to a compact JSON.
  const parts: string[] = [];
  if (typeof metadata.name === "string") parts.push(metadata.name);
  if (typeof metadata.vendorName === "string") parts.push(metadata.vendorName);
  if (typeof metadata.amount === "string" && typeof metadata.currency === "string") {
    parts.push(`${metadata.amount} ${metadata.currency}`);
  }
  if (typeof metadata.comment === "string") parts.push(`“${metadata.comment}”`);
  return parts.join(" · ");
}

export function ActivityLog() {
  const [page, setPage] = useState(0); // TablePagination is 0-based
  const [pageSize, setPageSize] = useState(20);
  const [userId, setUserId] = useState<string>("");
  const [action, setAction] = useState<ActivityAction | "">("");

  const { data: members } = useMembers({ pageSize: 100 });
  const { data, isLoading, isError } = useActivityLog({
    page: page + 1,
    pageSize,
    userId: userId || undefined,
    action: action || undefined,
  });

  useEffect(() => {
    if (isError) toast.error("Couldn't load activity log");
  }, [isError]);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h5" component="h1">
          Activity log
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="user-filter-label">User</InputLabel>
          <Select
            labelId="user-filter-label"
            label="User"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">All users</MenuItem>
            {members?.items.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="action-filter-label">Action</InputLabel>
          <Select
            labelId="action-filter-label"
            label="Action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value as ActivityAction | "");
              setPage(0);
            }}
          >
            <MenuItem value="">All actions</MenuItem>
            {activityActions.map((a) => (
              <MenuItem key={a} value={a}>
                {ACTION_LABELS[a]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading activity log" />
        </Box>
      ) : data && data.items.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {formatTimestamp(entry.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>{entry.userName}</TableCell>
                  <TableCell>
                    <Chip
                      label={ACTION_LABELS[entry.action]}
                      size="small"
                      color={ACTION_COLORS[entry.action]}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {metadataSummary(entry.metadata)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={data.total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Rows per page"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
          />
        </TableContainer>
      ) : (
        <Typography color="text.secondary">No activity to show.</Typography>
      )}
    </Box>
  );
}
