import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Chip,
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
import SendIcon from "@mui/icons-material/Send";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { toast } from "react-toastify";
import { billStatuses, type BillListItem, type BillStatus } from "@payables/shared";
import {
  useBills,
  useDeleteBill,
  useSimulatePayment,
  useSimulatePaymentFailure,
} from "../queries/useBills";
import { useVendors } from "../queries/useVendors";
import { useSubmitBill } from "../queries/useApprovals";
import { useAuth } from "../auth/AuthContext";
import { StatusChip } from "../components/StatusChip";
import { BillFormDialog } from "../components/BillFormDialog";
import { BillApprovalsDialog } from "../components/BillApprovalsDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DateRangeField } from "../components/DateRangeField";
import { formatDate, formatMoney, isOverdue } from "../lib/format";

const STATUS_LABELS: Record<BillStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  paid: "Paid",
  payment_failed: "Payment failed",
};

type ParamKey =
  | "page"
  | "pageSize"
  | "status"
  | "search"
  | "vendorId"
  | "dueAfter"
  | "dueBefore"
  | "issueAfter"
  | "issueBefore"
  | "overdue";

function isBillStatus(v: string): v is BillStatus {
  return (billStatuses as readonly string[]).includes(v);
}

export function Bills() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
  const pageSizeParam = Number(searchParams.get("pageSize") ?? "10");
  const pageSize = [10, 20, 50].includes(pageSizeParam) ? pageSizeParam : 10;
  const statusParam = searchParams.get("status") ?? "";
  const status: BillStatus | "" = isBillStatus(statusParam) ? statusParam : "";
  const search = searchParams.get("search") ?? "";
  const vendorId = searchParams.get("vendorId") ?? "";
  const dueAfter = searchParams.get("dueAfter") ?? "";
  const dueBefore = searchParams.get("dueBefore") ?? "";
  const issueAfter = searchParams.get("issueAfter") ?? "";
  const issueBefore = searchParams.get("issueBefore") ?? "";
  const overdue = searchParams.get("overdue") === "true";

  function updateParams(patch: Partial<Record<ParamKey, string>>, opts: { resetPage?: boolean } = {}) {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (opts.resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  const { data: vendorsData } = useVendors(1, 100);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<BillListItem | null>(null);
  const [reviewing, setReviewing] = useState<BillListItem | null>(null);
  const deleteBill = useDeleteBill();
  const submitBill = useSubmitBill();
  const simulatePayment = useSimulatePayment();
  const simulateFailure = useSimulatePaymentFailure();

  async function handleSubmit(bill: BillListItem) {
    try {
      await submitBill.mutateAsync(bill.id);
      toast.success("Bill submitted for approval");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit bill");
    }
  }

  async function handleSimulatePay(bill: BillListItem) {
    try {
      await simulatePayment.mutateAsync(bill.id);
      toast.success("Payment simulated — bill marked as paid (demo)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't simulate payment");
    }
  }

  async function handleSimulateFail(bill: BillListItem) {
    try {
      await simulateFailure.mutateAsync(bill.id);
      toast.success("Payment failure simulated (demo)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't simulate failure");
    }
  }

  const canSimulatePayment = (s: BillStatus) =>
    s === "approved" || s === "scheduled" || s === "payment_failed";

  const { data, isLoading, isError } = useBills({
    page: page + 1,
    pageSize,
    status: status || undefined,
    search: search || undefined,
    vendorId: vendorId || undefined,
    dueAfter: dueAfter || undefined,
    dueBefore: dueBefore || undefined,
    issueAfter: issueAfter || undefined,
    issueBefore: issueBefore || undefined,
    overdue: overdue || undefined,
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
        spacing={1}
        sx={{ mb: 2, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography variant="h5" component="h1">
          Bills
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
            size="small"
          >
            New bill
          </Button>
        )}
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        useFlexGap
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        <TextField
          label="Search by vendor or invoice number"
          value={search}
          onChange={(e) => updateParams({ search: e.target.value }, { resetPage: true })}
          size="small"
          sx={{ flexGrow: 1, minWidth: { xs: "100%", sm: 220 } }}
        />
        <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }} disabled={overdue}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            label="Status"
            value={status}
            onChange={(e) => updateParams({ status: e.target.value }, { resetPage: true })}
          >
            <MenuItem value="">All</MenuItem>
            {billStatuses.map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }}>
          <InputLabel id="vendor-filter-label">Vendor</InputLabel>
          <Select
            labelId="vendor-filter-label"
            label="Vendor"
            value={vendorId}
            onChange={(e) => updateParams({ vendorId: e.target.value }, { resetPage: true })}
          >
            <MenuItem value="">All</MenuItem>
            {vendorsData?.items.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <DateRangeField
          label="Due date"
          from={dueAfter}
          to={dueBefore}
          onChange={({ from, to }) =>
            updateParams({ dueAfter: from, dueBefore: to }, { resetPage: true })
          }
        />
        <DateRangeField
          label="Issue date"
          from={issueAfter}
          to={issueBefore}
          onChange={({ from, to }) =>
            updateParams({ issueAfter: from, issueBefore: to }, { resetPage: true })
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={overdue}
              onChange={(e) =>
                updateParams(
                  { overdue: e.target.checked ? "true" : "", status: e.target.checked ? "" : status },
                  { resetPage: true },
                )
              }
            />
          }
          label="Overdue only"
        />
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
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Due date</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Approvals</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((bill) => {
                const overdue = isOverdue(bill.dueDate, bill.status);
                return (
                  <TableRow
                    key={bill.id}
                    hover
                    onClick={() => navigate(`/bills/${bill.id}`)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {bill.vendorName}
                      </Typography>
                      {bill.invoiceNumber && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {bill.invoiceNumber}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        color={overdue ? "error.main" : "text.secondary"}
                        sx={{ display: { xs: "block", sm: "none" }, fontWeight: overdue ? 600 : 400 }}
                      >
                        Due {formatDate(bill.dueDate)}
                        {overdue && " · Overdue"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={bill.status} />
                    </TableCell>
                    <TableCell align="right">{formatMoney(bill.amount)}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      <Typography
                        variant="body2"
                        color={overdue ? "error.main" : "text.primary"}
                        sx={{ fontWeight: overdue ? 600 : 400 }}
                      >
                        {formatDate(bill.dueDate)}
                        {overdue && " · Overdue"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      {bill.approvers.length > 0 ? (
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                          {bill.approvers.map((a, i) => (
                            <Chip
                              key={`${a.name}-${i}`}
                              size="small"
                              label={a.name}
                              color={a.status === "approved" ? "success" : "error"}
                              variant={a.status === "approved" ? "filled" : "outlined"}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        {isAdmin && bill.status === "draft" && (
                          <Tooltip title="Submit for approval">
                            <IconButton
                              aria-label={`Submit bill ${bill.invoiceNumber ?? bill.id} for approval`}
                              size="small"
                              disabled={submitBill.isPending}
                              onClick={() => handleSubmit(bill)}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {bill.status !== "draft" && (
                          <Tooltip title="View approvals">
                            <IconButton
                              aria-label={`View approvals for bill ${bill.invoiceNumber ?? bill.id}`}
                              size="small"
                              onClick={() => setReviewing(bill)}
                            >
                              <FactCheckOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {isAdmin && canSimulatePayment(bill.status) && (
                          <>
                            <Tooltip title="Simulate successful payment (demo only)">
                              <IconButton
                                aria-label={`Simulate payment for bill ${bill.invoiceNumber ?? bill.id} (demo)`}
                                size="small"
                                color="success"
                                disabled={simulatePayment.isPending}
                                onClick={() => handleSimulatePay(bill)}
                              >
                                <PaymentsOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Simulate failed payment (demo only)">
                              <IconButton
                                aria-label={`Simulate payment failure for bill ${bill.invoiceNumber ?? bill.id} (demo)`}
                                size="small"
                                color="error"
                                disabled={simulateFailure.isPending}
                                onClick={() => handleSimulateFail(bill)}
                              >
                                <ErrorOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {isAdmin && bill.status === "draft" && (
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
                      </Stack>
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
            onPageChange={(_, p) => updateParams({ page: p > 0 ? String(p + 1) : "" })}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) =>
              updateParams(
                { pageSize: e.target.value === "10" ? "" : e.target.value },
                { resetPage: true },
              )
            }
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Rows per page"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
            sx={{
              "& .MuiTablePagination-toolbar": { flexWrap: "wrap", rowGap: 1 },
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-input": {
                display: { xs: "none", sm: "inline-flex" },
              },
            }}
          />
        </TableContainer>
      ) : (
        <Typography color="text.secondary">No bills to show.</Typography>
      )}

      <BillFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <BillApprovalsDialog bill={reviewing} onClose={() => setReviewing(null)} />
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
