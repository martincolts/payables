import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../auth/AuthContext";
import { useSignup } from "../queries/useAuth";

export function Signup() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const signup = useSignup();
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    signup.mutate(
      { name, organizationName, email, password },
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
          <Typography variant="h5" component="h1" gutterBottom>
            Create account
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Sign up to create your organization and start managing payments.
          </Typography>
          <Box component="form" onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                fullWidth
              />
              <TextField
                label="Organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                autoComplete="organization"
                required
                fullWidth
                helperText="You'll be the admin and can invite teammates"
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                fullWidth
              />
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
                disabled={signup.isPending}
              >
                {signup.isPending ? "Creating…" : "Create account"}
              </Button>
            </Stack>
          </Box>
          <Typography variant="body2" sx={{ mt: 3 }}>
            Already have an account?{" "}
            <MuiLink component={RouterLink} to="/login">
              Sign in
            </MuiLink>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
