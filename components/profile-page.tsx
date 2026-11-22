"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthButton from "./auth-button";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type Profile = {
  email: string;
  nombre: string;
  apellido: string;
  phone: string;
  address: string;
};

function getErrorMessage(result: unknown, fallback: string) {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    return result.error;
  }
  return fallback;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile(session: Session | null) {
      if (!session) {
        setSignedIn(false);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSignedIn(true);
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result, "No se pudo cargar tu perfil."));
        if (
          typeof result !== "object" ||
          result === null ||
          !("profile" in result) ||
          typeof result.profile !== "object" ||
          result.profile === null
        ) {
          throw new Error("No se pudieron verificar los datos de tu perfil.");
        }

        const data = result.profile;
        if (
          !("email" in data) ||
          !("nombre" in data) ||
          !("apellido" in data) ||
          !("phone" in data) ||
          !("address" in data) ||
          typeof data.email !== "string" ||
          (typeof data.nombre !== "string" && data.nombre !== null) ||
          (typeof data.apellido !== "string" && data.apellido !== null) ||
          (typeof data.phone !== "string" && data.phone !== null) ||
          (typeof data.address !== "string" && data.address !== null)
        ) {
          throw new Error("No se pudieron verificar los datos de tu perfil.");
        }

        if (!active) return;
        const nextProfile = {
          email: data.email,
          nombre: typeof data.nombre === "string" ? data.nombre : "",
          apellido: typeof data.apellido === "string" ? data.apellido : "",
          phone: typeof data.phone === "string" ? data.phone : "",
          address: typeof data.address === "string" ? data.address : "",
        };
        setProfile(nextProfile);
        setEmail(nextProfile.email);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar tu perfil.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      void loadProfile(data.session);
    }).catch((sessionError: unknown) => {
      if (!active) return;
      setError(sessionError instanceof Error ? sessionError.message : "No se pudo validar tu sesión.");
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void loadProfile(session);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Iniciá sesión para actualizar tu perfil.");

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: profile?.nombre,
          apellido: profile?.apellido,
          phone: profile?.phone,
          address: profile?.address,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "No se pudo guardar tu perfil."));
      setMessage("Los datos de tu perfil se guardaron correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar tu perfil.");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const nextEmail = email.trim();
      if (!nextEmail) throw new Error("Ingresá un correo electrónico válido.");
      if (nextEmail.toLowerCase() === profile?.email.toLowerCase()) {
        throw new Error("Ingresá un correo distinto al actual.");
      }

      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({
        email: nextEmail,
      });
      if (updateError) throw updateError;
      setMessage("Te enviamos un correo para confirmar el cambio. Tu email se actualizará al confirmar la nueva dirección.");
    } catch (emailError) {
      setError(emailError instanceof Error ? emailError.message : "No se pudo solicitar el cambio de email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (newPassword !== confirmPassword) {
        throw new Error("La nueva contraseña y su confirmación no coinciden.");
      }
      if (newPassword.length < 6) {
        throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
      }
      if (!profile?.email) throw new Error("No encontramos el email de tu cuenta para validar tu identidad.");

      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (signInError) throw new Error("La contraseña actual no es correcta.");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Tu contraseña se cambió correctamente.");
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "No se pudo cambiar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pedivos, inicio">
          <span className="brand-mark">P</span>
          <span>pedivos<span className="brand-period">.</span></span>
        </a>
        <AuthButton onSignedOut={() => window.location.assign("/")} />
      </header>

      <section className="profile-main">
        <div className="profile-heading">
          <span className="eyebrow">TU CUENTA</span>
          <h1>Mi perfil</h1>
          <p>Actualizá tus datos de contacto y mantené tu cuenta al día.</p>
        </div>

        {loading ? (
          <p className="profile-access-message">Cargando tu perfil...</p>
        ) : !signedIn ? (
          <p className="profile-access-message">
            Iniciá sesión para consultar y modificar tu perfil. <a href="/">Volver a la tienda</a>
          </p>
        ) : profile ? (
          <>
            <form className="profile-card" onSubmit={saveProfile}>
              <h2>Datos personales</h2>
              <div className="profile-form-grid">
                <label className="field-label">
                  Nombre
                  <input
                    autoComplete="given-name"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) => setProfile({ ...profile, nombre: event.target.value })}
                    required
                    value={profile.nombre}
                  />
                </label>
                <label className="field-label">
                  Apellido
                  <input
                    autoComplete="family-name"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) => setProfile({ ...profile, apellido: event.target.value })}
                    required
                    value={profile.apellido}
                  />
                </label>
                <label className="field-label">
                  Teléfono
                  <input
                    autoComplete="tel"
                    maxLength={24}
                    minLength={6}
                    onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                    required
                    type="tel"
                    value={profile.phone}
                  />
                </label>
                <label className="field-label">
                  Dirección
                  <input
                    autoComplete="street-address"
                    maxLength={200}
                    minLength={5}
                    onChange={(event) => setProfile({ ...profile, address: event.target.value })}
                    required
                    value={profile.address}
                  />
                </label>
              </div>
              <div className="profile-form-actions">
                <button className="submit-order" disabled={submitting} type="submit">
                  {submitting ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>

            <form className="profile-card" onSubmit={changeEmail}>
              <h2>Correo electrónico</h2>
              <p className="profile-card-description">
                Para proteger tu cuenta, vas a tener que confirmar la nueva dirección desde el correo que te enviemos.
              </p>
              <label className="field-label">
                Email actual
                <input autoComplete="email" disabled value={profile.email} />
              </label>
              <label className="field-label">
                Nuevo email
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button className="submit-order" disabled={submitting} type="submit">
                {submitting ? "Enviando..." : "Solicitar cambio de email"}
              </button>
            </form>

            <form className="profile-card" onSubmit={changePassword}>
              <h2>Seguridad</h2>
              <p className="profile-card-description">
                Para cambiar la contraseña, primero verificamos la contraseña actual.
              </p>
              <label className="field-label">
                Contraseña actual
                <input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </label>
              <div className="profile-form-grid">
                <label className="field-label">
                  Nueva contraseña
                  <input
                    autoComplete="new-password"
                    minLength={6}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    type="password"
                    value={newPassword}
                  />
                </label>
                <label className="field-label">
                  Confirmar nueva contraseña
                  <input
                    autoComplete="new-password"
                    minLength={6}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </label>
              </div>
              <button className="submit-order" disabled={submitting} type="submit">
                {submitting ? "Cambiando..." : "Cambiar contraseña"}
              </button>
            </form>
          </>
        ) : (
          <p className="profile-access-message profile-message-error" role="alert">
            {error || "No se pudo cargar tu perfil."}
          </p>
        )}

        {error && signedIn && profile && (
          <p className="profile-message profile-message-error" role="alert">{error}</p>
        )}
        {message && <p className="profile-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
