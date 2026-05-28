import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { toast } from "react-toastify";
import { useMembers } from "../queries/useOrganization";
import { useInvitations } from "../queries/useInvitations";
import { InviteMemberDialog } from "../components/InviteMemberDialog";
import { formatTimestamp } from "../lib/format";

export function Team() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const members = useMembers();
  const invitations = useInvitations();

  useEffect(() => {
    if (members.isError) toast.error("Couldn't load team members");
  }, [members.isError]);

  const pendingInvites = invitations.data?.items.filter((i) => i.status === "pending") ?? [];

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h5" component="h1">
          Team
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setInviteOpen(true)}
        >
          Invite teammate
        </Button>
      </Stack>

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        Members
      </Typography>
      {members.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading members" />
        </Box>
      ) : members.data && members.data.items.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.data.items.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>
                    {m.name}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: { xs: "block", sm: "none" } }}
                    >
                      {m.email}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{m.email}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{m.role}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={m.status === "active" ? "Active" : "Pending"}
                      color={m.status === "active" ? "success" : "default"}
                      variant={m.status === "active" ? "filled" : "outlined"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="text.secondary">No members yet.</Typography>
      )}

      {pendingInvites.length > 0 && (
        <>
          <Typography variant="subtitle1" sx={{ mt: 4, mb: 1, fontWeight: 600 }}>
            Pending invitations
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Invited</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingInvites.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell sx={{ textTransform: "capitalize" }}>{inv.role}</TableCell>
                    <TableCell>{formatTimestamp(inv.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <InviteMemberDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Box>
  );
}
