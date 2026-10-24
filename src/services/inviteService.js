import { supabase } from '../lib/supabase';

// =====================================================================
// SERVICIO DE INVITACIONES (EDGE FUNCTION + FALLBACK)
// =====================================================================

/**
 * Invitar a un dueño o empleado
 * Invoca la Edge Function 'invitar-usuario' si está desplegada.
 * Si no está desplegada aún, usa el fallback seguro con las políticas RLS.
 */
export async function inviteUser({ email, nombre, tiendaId, rol }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanNombre = nombre ? nombre.trim() : cleanEmail.split('@')[0];

  try {
    // 1. Intentar llamar a la Edge Function de Supabase
    const { data, error } = await supabase.functions.invoke('invitar-usuario', {
      body: {
        email: cleanEmail,
        nombre: cleanNombre,
        tienda_id: tiendaId,
        rol: rol // 'dueno' | 'empleado'
      }
    });

    if (!error && data?.success) {
      return {
        success: true,
        message: data.message || 'Invitación enviada exitosamente',
        via: 'edge-function'
      };
    }

    // Si la función arrojó error pero respondió
    if (error && error.message && !error.message.includes('Failed to send a request') && !error.message.includes('404')) {
      throw error;
    }
  } catch (edgeError) {
    console.warn('Edge Function no disponible o no desplegada aún, aplicando fallback:', edgeError.message);
  }

  // 2. Fallback de desarrollo / directo:
  // Verificar si el usuario ya está registrado en `perfiles`
  const { data: userProfile } = await supabase
    .from('perfiles')
    .select('id, nombre, correo')
    .ilike('correo', cleanEmail)
    .maybeSingle();

  if (userProfile) {
    // Si ya existe, insertamos o actualizamos su membresía en `miembros`
    const { error: miembroErr } = await supabase
      .from('miembros')
      .upsert(
        {
          tienda_id: tiendaId,
          usuario_id: userProfile.id,
          rol: rol,
          activo: true
        },
        { onConflict: 'tienda_id, usuario_id' }
      );

    if (miembroErr) throw miembroErr;

    return {
      success: true,
      message: `El usuario (${cleanEmail}) ya estaba registrado y fue vinculado como ${rol} exitosamente.`,
      via: 'direct-member-link'
    };
  }

  return {
    success: false,
    message: `El correo ${cleanEmail} aún no tiene cuenta. Para enviar el correo de activación con enlace para crear contraseña, despliega la Edge Function 'invitar-usuario' en tu proyecto de Supabase. Mientras tanto, el usuario puede registrarse en la pantalla de inicio de sesión con ese correo.`,
    via: 'pending-registration'
  };
}
