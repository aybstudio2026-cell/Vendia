// =====================================================================
// EDGE FUNCTION: invitar-usuario
// Invita a dueños y empleados usando supabase.auth.admin.inviteUserByEmail
// y crea/vincula automáticamente su fila en la tabla `miembros`.
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // 1. Verificar autenticación del usuario que hace la petición
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado: falta encabezado de autorización' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await clientUser.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Sesión no válida o expirada' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Extraer parámetros del body
    const { email, nombre, tienda_id, rol } = await req.json();

    if (!email || !tienda_id || !rol) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros obligatorios (email, tienda_id, rol)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanNombre = nombre ? String(nombre).trim() : cleanEmail.split('@')[0];

    // 3. Cliente con privilegios administrativos (service_role)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 4. Verificar permisos del usuario solicitante
    const { data: callerProfile } = await adminClient
      .from('perfiles')
      .select('es_superadmin')
      .eq('id', caller.id)
      .single();

    const isSuperadmin = Boolean(callerProfile?.es_superadmin);

    if (rol === 'dueno') {
      if (!isSuperadmin) {
        return new Response(
          JSON.stringify({ error: 'Solo el Superadmin puede invitar o asignar dueños de tienda' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (rol === 'empleado') {
      // Si no es superadmin, verificar que sea dueño de la tienda
      if (!isSuperadmin) {
        const { data: ownerMembership } = await adminClient
          .from('miembros')
          .select('id')
          .eq('tienda_id', tienda_id)
          .eq('usuario_id', caller.id)
          .eq('rol', 'dueno')
          .eq('activo', true)
          .maybeSingle();

        if (!ownerMembership) {
          return new Response(
            JSON.stringify({ error: 'Solo el dueño de la tienda puede invitar empleados' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 5. Verificar si el usuario ya existe en perfiles / auth.users
    const { data: existingProfile } = await adminClient
      .from('perfiles')
      .select('id')
      .ilike('correo', cleanEmail)
      .maybeSingle();

    let targetUserId = existingProfile?.id;

    if (!targetUserId) {
      // Invitar usuario por correo usando Admin Auth API
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        cleanEmail,
        {
          data: { nombre: cleanNombre }
        }
      );

      if (inviteError) {
        return new Response(
          JSON.stringify({ error: `Error al enviar invitación: ${inviteError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetUserId = inviteData.user.id;
    }

    // 6. Insertar / Actualizar fila en la tabla `miembros`
    const { error: miembroError } = await adminClient
      .from('miembros')
      .upsert(
        {
          tienda_id,
          usuario_id: targetUserId,
          rol,
          activo: true
        },
        { onConflict: 'tienda_id, usuario_id' }
      );

    if (miembroError) {
      return new Response(
        JSON.stringify({ error: `Error al vincular membresía: ${miembroError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: existingProfile
          ? 'El usuario ya existía y fue vinculado como miembro de la tienda'
          : 'Invitación enviada por correo electrónico exitosamente',
        userId: targetUserId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
