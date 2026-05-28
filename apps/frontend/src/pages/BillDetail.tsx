import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SendIcon from "@mui/icons-material/Send";
import { toast } from "react-toastify";
import { useAuth } from "../auth/AuthContext";
import { useBill, useDeleteBill } from "../queries/useBills";
import { useApprovals, useSubmitApproval, useSubmitBill } from "../queries/useApprovals";
import { StatusChip } from "../components/StatusChip";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDate, formatMoney, formatTimestamp, isOverdue } from "../lib/format";

export function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canRecordDecision = user?.role === "approver" || user?.role === "admin";

  const bill = useBill(id);
  const approvals = useApprovals(id ?? null);
  const submitBill = useSubmitBill();
  const submitApproval = useSubmitApproval(id ?? "");
  const deleteBill = useDeleteBill();

  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (bill.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading bill" />
      </Box>
    );
  }

  if (bill.isError || !bill.data) {
    return (
      <Box>
        <Button
          component={RouterLink}
          to="/bills"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 2 }}
        >
          Back to bills
        </Button>
        <Alert severity="error">Couldn't load this bill.</Alert>
      </Box>
    );
  }

  const b = bill.data;
  const overdue = isOverdue(b.dueDate, b.status);
  const canVote = canRecordDecision && b.status === "pending_approval";
  const progress = approvals.data
    ? Math.min(100, (approvals.data.approved / approvals.data.required) * 100)
    : 0;

  async function handleSubmitForApproval() {
    try {
      await submitBill.mutateAsync(b.id);
      toast.success("Bill submitted for approval");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit bill");
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (decision === "reject" && comment.trim().length === 0) {
      toast.error("A comment is required when rejecting");
      return;
    }
    try {
      await submitApproval.mutateAsync({ decision, comment: comment.trim() || null });
      toast.success(decision === "approve" ? "Approval recorded" : "Bill rejected");
      setComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record decision");
    }
  }

  async function handleDelete() {
    try {
      await deleteBill.mutateAsync(b.id);
      toast.success("Bill deleted");
      setConfirmDelete(false);
      navigate("/bills");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete bill");
    }
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/bills" underline="hover">
          Bills
        </Link>
        <Typography color="text.primary">
          {b.invoiceNumber ?? b.id.slice(0, 8)}
        </Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 3, justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box>
          <Typography variant="h5" component="h1">
            {b.vendorName}
          </Typography>
          {b.invoiceNumber && (
            <Typography variant="body2" color="text.secondary">
              Invoice #{b.invoiceNumber}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <StatusChip status={b.status} />
          {isAdmin && b.status === "draft" && (
            <>
              <Button
                variant="contained"
                size="small"
                startIcon={<SendIcon />}
                disabled={submitBill.isPending}
                onClick={handleSubmitForApproval}
              >
                Submit for approval
              </Button>
              <Button
                color="error"
                size="small"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Bill
            </Typography>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="h6">{formatMoney(b.amount)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Currency
                </Typography>
                <Typography variant="body1">{b.currency}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Issue date
                </Typography>
                <Typography variant="body1">{formatDate(b.issueDate)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  Due date
                </Typography>
                <Typography
                  variant="body1"
                  color={overdue ? "error.main" : "text.primary"}
                  sx={{ fontWeight: overdue ? 600 : 400 }}
                >
                  {formatDate(b.dueDate)}
                  {overdue && " · Overdue"}
                </Typography>
              </Grid>
              {b.memo && (
                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Memo
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {b.memo}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Approvals
            </Typography>
            {approvals.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                <CircularProgress size={24} aria-label="Loading approvals" />
              </Box>
            ) : approvals.data ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {approvals.data.approved} of {approvals.data.required} approvals
                  </Typography>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>

                {approvals.data.decisions.length > 0 ? (
                  <List dense disablePadding>
                    {approvals.data.decisions.map((d) => (
                      <ListItem
                        key={d.id}
                        disableGutters
                        secondaryAction={
                          <Chip
                            size="small"
                            label={d.status}
                            color={d.status === "approved" ? "success" : "error"}
                            sx={{ textTransform: "capitalize" }}
                          />
                        }
                      >
                        <ListItemText
                          primary={d.approverName}
                          secondary={
                            d.comment
                              ? `${d.comment} · ${formatTimestamp(d.createdAt)}`
                              : formatTimestamp(d.createdAt)
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    No decisions yet.
                  </Typography>
                )}

                {canVote ? (
                  <>
                    <TextField
                      label="Comment (required to reject)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      multiline
                      minRows={2}
                      fullWidth
                    />
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      <Button
                        color="error"
                        onClick={() => decide("reject")}
                        disabled={submitApproval.isPending}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => decide("approve")}
                        disabled={submitApproval.isPending}
                      >
                        Approve
                      </Button>
                    </Stack>
                  </>
                ) : b.status !== "pending_approval" && b.status !== "draft" ? (
                  <Alert severity="info">This bill is no longer awaiting approval.</Alert>
                ) : b.status === "pending_approval" ? (
                  <Alert severity="info">You don't have permission to record a decision.</Alert>
                ) : null}
              </Stack>
            ) : (
              <Alert severity="error" sx={{ mt: 1 }}>
                Couldn't load approvals.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete bill"
        message={`Permanently delete this draft bill for ${b.vendorName} (${formatMoney(b.amount)})? This can't be undone.`}
        confirmLabel="Delete"
        confirmColor="error"
        busy={deleteBill.isPending}
        onConfirm={handleDelete}
        onClose={() => !deleteBill.isPending && setConfirmDelete(false)}
      />
    </Box>
  );
}
