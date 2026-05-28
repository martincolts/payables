import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { toast } from "react-toastify";
import type { BillListItem } from "@payables/shared";
import { useApprovals, useSubmitApproval } from "../queries/useApprovals";
import { useAuth } from "../auth/AuthContext";
import { formatMoney, formatTimestamp } from "../lib/format";

interface Props {
  bill: BillListItem | null;
  onClose: () => void;
}

/**
 * Shows a bill's approval progress and decisions. Approvers can record an
 * approve/reject decision here while the bill is pending approval.
 */
export function BillApprovalsDialog({ bill, onClose }: Props) {
  const { user } = useAuth();
  const isApprover = user?.role === "approver";
  const summary = useApprovals(bill?.id ?? null);
  const submit = useSubmitApproval(bill?.id ?? "");
  const [comment, setComment] = useState("");

  const canVote = isApprover && bill?.status === "pending_approval";

  async function decide(decision: "approve" | "reject") {
    if (decision === "reject" && comment.trim().length === 0) {
      toast.error("A comment is required when rejecting");
      return;
    }
    try {
      await submit.mutateAsync({ decision, comment: comment.trim() || null });
      toast.success(decision === "approve" ? "Approval recorded" : "Bill rejected");
      setComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record decision");
    }
  }

  const progress = summary.data
    ? Math.min(100, (summary.data.approved / summary.data.required) * 100)
    : 0;

  return (
    <Dialog open={bill !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Approvals
        {bill && (
          <Typography variant="body2" color="text.secondary">
            {bill.vendorName} · {formatMoney(bill.amount)}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {summary.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress aria-label="Loading approvals" />
          </Box>
        ) : summary.data ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {summary.data.approved} of {summary.data.required} approvals
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>

            {summary.data.decisions.length > 0 ? (
              <List dense disablePadding>
                {summary.data.decisions.map((d) => (
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
              <TextField
                label="Comment (required to reject)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
            ) : bill?.status !== "pending_approval" ? (
              <Alert severity="info">This bill is no longer awaiting approval.</Alert>
            ) : (
              <Alert severity="info">Only approvers can record a decision.</Alert>
            )}
          </Stack>
        ) : (
          <Alert severity="error">Couldn't load approvals.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {canVote && (
          <>
            <Button
              color="error"
              onClick={() => decide("reject")}
              disabled={submit.isPending}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              onClick={() => decide("approve")}
              disabled={submit.isPending}
            >
              Approve
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
