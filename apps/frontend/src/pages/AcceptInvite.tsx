import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../auth/AuthContext";
import { useAcceptInvitation, useInvitationPreview } from "../queries/useAuth";

export function AcceptInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const [password, setPassword] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    accept.mutate(
      { token, password },
      {
        onSuccess: (res) => {
          setSession(res);
          toast.success(`Welcome, ${res.user.name}!`);
          navigate("/", { replace: true });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent>
          {preview.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress aria-label="Loading invitation" />
            </Box>
          ) : preview.isError || !preview.data ? (
            <Alert severity="error">
              {preview.error instanceof Error
                ? preview.error.message
                : "This invitation link is invalid or expired."}
            </Alert>
          ) : preview.data.status === "accepted" ? (
            <Alert severity="info">
              This invitation has already been accepted. Please sign in instead.
            </Alert>
          ) : (
            <>
              <Typography variant="h5" component="h1" gutterBottom>
                Join {preview.data.organizationName}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                You've been invited as {preview.data.name} ({preview.data.email}) with the{" "}
                <strong>{preview.data.role}</strong> role. Set a password to activate
                your account.
              </Typography>
              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    fullWidth
                    helperText="At least 8 characters"
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={accept.isPending}
                  >
                    {accept.isPending ? "Joining…" : "Accept invitation"}
                  </Button>
                </Stack>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
