import { useEffect, useState } from "react";
import {
  Box,
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
  TextField,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import { billStatuses, type BillStatus } from "@payables/shared";
import { useBills } from "../queries/useBills";
import { StatusChip } from "../components/StatusChip";
import { formatDate, formatMoney, isOverdue } from "../lib/format";

const STATUS_LABELS: Record<BillStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  paid: "Paid",
};

export function Bills() {
  const [page, setPage] = useState(0); // TablePagination is 0-based
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<BillStatus | "">("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useBills({
    page: page + 1,
    pageSize,
    status: status || undefined,
    search: search || undefined,
  });

  useEffect(() => {
    if (isError) toast.error("Couldn't load bills");
  }, [isError]);

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Bills
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Search by vendor or invoice number"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ flexGrow: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as BillStatus | "");
              setPage(0);
            }}
          >
            <MenuItem value="">All</MenuItem>
            {billStatuses.map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading bills" />
        </Box>
      ) : data && data.items.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Due date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((bill) => {
                const overdue = isOverdue(bill.dueDate, bill.status);
                return (
                  <TableRow key={bill.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {bill.vendorName}
                      </Typography>
                      {bill.invoiceNumber && (
                        <Typography variant="caption" color="text.secondary">
                          {bill.invoiceNumber}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={bill.status} />
                    </TableCell>
                    <TableCell align="right">{formatMoney(bill.amount)}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={overdue ? "error.main" : "text.primary"}
                        sx={{ fontWeight: overdue ? 600 : 400 }}
                      >
                        {formatDate(bill.dueDate)}
                        {overdue && " · Overdue"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        <Typography color="text.secondary">No bills to show.</Typography>
      )}
    </Box>
  );
}
