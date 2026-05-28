import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { toast } from "react-toastify";
import { userRoles, type UserRole } from "@payables/shared";
import { useCreateInvitation } from "../queries/useInvitations";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  approver: "Approver",
};

/** Builds the absolute accept-invite URL the invitee opens. */
function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

/**
 * Invites a teammate. Since this MVP doesn't send email, on success we surface
 * the invitation link for the admin to share manually (see README).
 */
export function InviteMemberDialog({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("approver");
  const [link, setLink] = useState<string | null>(null);
  const createInvitation = useCreateInvitation();

  function reset() {
    setName("");
    setEmail("");
    setRole("approver");
    setLink(null);
  }

  function handleClose() {
    if (createInvitation.isPending) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const invitation = await createInvitation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        role,
      });
      setLink(inviteUrl(invitation.token));
      toast.success("Invitation created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send invitation");
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.info("Invite link copied");
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      {link ? (
        <>
          <DialogTitle>Invitation ready</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Share this link with your teammate so they can set a password and join.
              In a production app this would be emailed automatically.
            </DialogContentText>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField value={link} fullWidth size="small" slotProps={{ input: { readOnly: true } }} />
              <Tooltip title="Copy link">
                <IconButton onClick={copyLink} aria-label="Copy invite link">
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Done</Button>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <DialogTitle>Invite teammate</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="invite-role-label">Role</InputLabel>
                <Select
                  labelId="invite-role-label"
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  {userRoles.map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Alert severity="info" variant="outlined">
                Approvers can review and approve bills. Admins can do everything.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={createInvitation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={createInvitation.isPending}>
              Create invitation
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
