import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { toast } from "react-toastify";
import { billStatuses, type BillListItem, type BillStatus } from "@payables/shared";
import { useBills, useDeleteBill } from "../queries/useBills";
import { useAuth } from "../auth/AuthContext";
import { StatusChip } from "../components/StatusChip";
import { BillFormDialog } from "../components/BillFormDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(0); // TablePagination is 0-based
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<BillStatus | "">("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<BillListItem | null>(null);
  const deleteBill = useDeleteBill();

  const { data, isLoading, isError } = useBills({
    page: page + 1,
    pageSize,
    status: status || undefined,
    search: search || undefined,
  });

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await deleteBill.mutateAsync(toDelete.id);
      toast.success("Bill deleted");
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete bill");
    }
  }

  useEffect(() => {
    if (isError) toast.error("Couldn't load bills");
  }, [isError]);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h5" component="h1">
          Bills
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            New bill
          </Button>
        )}
      </Stack>

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
                {isAdmin && <TableCell align="right">Actions</TableCell>}
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
                    {isAdmin && (
                      <TableCell align="right">
                        {bill.status === "draft" && (
                          <Tooltip title="Delete draft bill">
                            <IconButton
                              aria-label={`Delete bill ${bill.invoiceNumber ?? bill.id}`}
                              size="small"
                              onClick={() => setToDelete(bill)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
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

      <BillFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete bill"
        message={
          toDelete
            ? `Permanently delete this draft bill for ${toDelete.vendorName} (${formatMoney(toDelete.amount)})? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        confirmColor="error"
        busy={deleteBill.isPending}
        onConfirm={handleDelete}
        onClose={() => !deleteBill.isPending && setToDelete(null)}
      />
    </Box>
  );
}
