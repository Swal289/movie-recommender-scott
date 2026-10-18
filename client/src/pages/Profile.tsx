import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./Profile.css";

export default function Profile() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await logout();
      void navigate("/", { replace: true });
    } catch (error: unknown) {
      console.error("Failed to log out of profile:", error);
      setLogoutError("Unable to log out. Please try again.");
      setIsLoggingOut(false);
    }
  }

  if (isLoading) {
    return (
      <main className="profile-page">
        <output>Loading your profile…</output>
      </main>
    );
  }

  if (!user) {
    // logout() clears the user before handleLogout navigates.
    // Keeps logout navigation on the homepage instead of redirecting to login.
    return <Navigate to={isLoggingOut ? "/" : "/login"} replace />;
  }

  return (
    <main className="profile-page">
      <Link to="/">← Back to movies</Link>

      <h1>Your profile</h1>

      <section
        className="profile-card"
        aria-labelledby="account-details-heading"
      >
        <h2 id="account-details-heading">Account details</h2>

        <dl className="profile-details">
          <div>
            <dt>Username</dt>
            <dd>{user.username}</dd>
          </div>

          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>

      <section
        className="profile-card"
        aria-labelledby="viewing-history-heading"
      >
        <h2 id="viewing-history-heading">Viewing history</h2>
        <p>Viewing history is coming soon.</p>
      </section>
      {logoutError && (
        <p className="profile-error" role="alert">
          {logoutError}
        </p>
      )}

      <button
        type="button"
        className="profile-logout"
        onClick={() => void handleLogout()}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Logging out…" : "Log out"}
      </button>
    </main>
  );
}
