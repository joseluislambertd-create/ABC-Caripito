/* ==========================================================================
   ACADEMIA DE BALONCESTO CARIPITO (ABC) - CLIENTE SUPABASE & DATA LAYER
   Manejo Asíncrono de Base de Datos en la Nube con Sincronización Realtime
   ========================================================================== */

(function () {
  const LOCAL_STORAGE_KEY = 'ABC_CARIPITO_ATHLETES_DB_V1';
  const STAFF_STORAGE_KEY = 'ABC_CARIPITO_STAFF_DB_V1';
  let supabaseInstance = null;
  let isConnected = false;
  let activeRealtimeChannel = null;

  // Obtener o instanciar cliente de Supabase
  function getSupabaseClient() {
    if (supabaseInstance) return supabaseInstance;

    const config = window.ABC_CONFIG || {};
    const url = config.SUPABASE_URL;
    const key = config.SUPABASE_ANON_KEY;

    const isPlaceholder = !url || !key || 
      url.includes('TU_PROYECTO') || 
      key.includes('TU_SUPABASE_ANON_KEY') ||
      url === 'https://tu-proyecto.supabase.co';

    if (!isPlaceholder && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabaseInstance = window.supabase.createClient(url, key, {
          auth: { persistSession: false },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
        isConnected = true;
        console.log('⚡ [ABC Supabase] Cliente inicializado y conectado a la nube:', url);
      } catch (err) {
        console.warn('⚠️ [ABC Supabase] Error al instanciar cliente Supabase:', err);
        supabaseInstance = null;
        isConnected = false;
      }
    } else {
      isConnected = false;
      if (isPlaceholder) {
        console.log('ℹ️ [ABC Supabase] Modo Local Activo (Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js).');
      }
    }
    return supabaseInstance;
  }

  // Sanitizador numérico (manejo de comas y strings)
  function sanitizeNumber(val, isFloat = true) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
    const parsed = isFloat ? parseFloat(str) : parseInt(str, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Mapear campos de objeto JavaScript (camelCase) a columnas PostgreSQL (snake_case)
  function toDbModel(athlete, includeGenero = true) {
    const model = {
      id: athlete.id,
      fecha_ingreso: athlete.fechaIngreso || new Date().toISOString().split('T')[0],
      nombres: (athlete.nombres || '').trim(),
      apellidos: (athlete.apellidos || '').trim(),
      cedula: (athlete.cedula || '').trim(),
      fecha_nac: athlete.fechaNac && athlete.fechaNac.trim() !== '' ? athlete.fechaNac.trim() : null,
      edad: sanitizeNumber(athlete.edad, false),
      peso: sanitizeNumber(athlete.peso, true),
      estatura: sanitizeNumber(athlete.estatura, true),
      imc: sanitizeNumber(athlete.imc, true),
      salud: (athlete.salud || 'Sin novedades médicas').trim(),
      tipo_sangre: athlete.tipoSangre || 'O+',
      posicion: athlete.posicion || 'Formativo',
      categoria: athlete.categoria || 'U18',
      dorsal: athlete.dorsal || 'S/N',
      representante: (athlete.representante || '').trim(),
      parentesco: athlete.parentesco || 'Padre',
      telefono_rep: (athlete.telefonoRep || '').trim(),
      telefono_emergencia: (athlete.telefonoEmergencia || athlete.telefonoRep || '').trim(),
      direccion: (athlete.direccion || 'Caripito, Edo. Monagas').trim(),
      foto: athlete.foto || null,
      estatus: athlete.estatus || 'Activo'
    };

    if (includeGenero) {
      model.genero = athlete.genero || 'Masculino';
    }

    return model;
  }

  // Mapear columnas PostgreSQL (snake_case) a objeto JavaScript (camelCase)
  function fromDbModel(row) {
    return {
      id: row.id,
      fechaIngreso: row.fecha_ingreso,
      nombres: row.nombres,
      apellidos: row.apellidos,
      cedula: row.cedula,
      genero: row.genero || 'Masculino',
      fechaNac: row.fecha_nac || '',
      edad: parseInt(row.edad, 10) || 0,
      peso: sanitizeNumber(row.peso, true),
      estatura: sanitizeNumber(row.estatura, true),
      imc: sanitizeNumber(row.imc, true),
      salud: row.salud || 'Sin novedades médicas',
      tipoSangre: row.tipo_sangre || 'O+',
      posicion: row.posicion || 'Formativo',
      categoria: row.categoria || 'U18',
      dorsal: row.dorsal || 'S/N',
      representante: row.representante || '',
      parentesco: row.parentesco || 'Padre',
      telefonoRep: row.telefono_rep || '',
      telefonoEmergencia: row.telefono_emergencia || row.telefono_rep || '',
      direccion: row.direccion || 'Caripito, Edo. Monagas',
      foto: row.foto || null,
      estatus: row.estatus || 'Activo'
    };
  }

  // Obtener atletas desde LocalStorage (caché de respaldo)
  function getLocalAthletes() {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error leyendo LocalStorage', e);
    }
    return window.INITIAL_ATHLETES ? [...window.INITIAL_ATHLETES] : [];
  }

  // Guardar atletas en LocalStorage como respaldo/caché
  function saveLocalAthletes(athletes) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(athletes));
    } catch (e) {
      console.error('Error guardando en LocalStorage', e);
    }
  }

  // Mapear campos de objeto JavaScript de cuerpo técnico a columnas PostgreSQL
  function toStaffDbModel(staff) {
    return {
      id: staff.id,
      fecha_ingreso: staff.fechaIngreso || new Date().toISOString().split('T')[0],
      nombres: (staff.nombres || '').trim(),
      apellidos: (staff.apellidos || '').trim(),
      cedula: (staff.cedula || '').trim(),
      telefono: (staff.telefono || '').trim(),
      email: (staff.email || '').trim() || null,
      rol: staff.rol || 'Entrenador Asistente',
      categorias: staff.categorias || 'Todas las Categorías',
      experiencia: (staff.experiencia || '').trim() || null,
      foto: staff.foto || null,
      estatus: staff.estatus || 'Activo'
    };
  }

  // Mapear columnas PostgreSQL de cuerpo técnico a objeto JavaScript
  function fromStaffDbModel(row) {
    return {
      id: row.id,
      fechaIngreso: row.fecha_ingreso,
      nombres: row.nombres,
      apellidos: row.apellidos,
      cedula: row.cedula,
      telefono: row.telefono,
      email: row.email || '',
      rol: row.rol,
      categorias: row.categorias,
      experiencia: row.experiencia || '',
      foto: row.foto || null,
      estatus: row.estatus || 'Activo'
    };
  }

  // Obtener cuerpo técnico desde LocalStorage
  function getLocalStaff() {
    try {
      const saved = localStorage.getItem(STAFF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error leyendo LocalStorage para staff', e);
    }
    return window.INITIAL_CUERPO_TECNICO ? [...window.INITIAL_CUERPO_TECNICO] : [];
  }

  // Guardar cuerpo técnico en LocalStorage
  function saveLocalStaff(staffList) {
    try {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staffList));
    } catch (e) {
      console.error('Error guardando staff en LocalStorage', e);
    }
  }

  // API Asíncrona Unificada
  const dbApi = {
    // Verificar si el cliente de Supabase está activo
    isCloudActive: function () {
      const client = getSupabaseClient();
      return !!(client && isConnected);
    },

    // 1. Obtener todos los atletas (READ)
    fetchAthletes: async function () {
      const client = getSupabaseClient();
      if (client && isConnected) {
        try {
          const { data, error } = await client
            .from('atletas')
            .select('*')
            .order('id', { ascending: true });

          if (error) {
            console.error('⚠️ [Supabase SELECT Error]:', error);
            return getLocalAthletes();
          }

          if (data && data.length > 0) {
            const mapped = data.map(fromDbModel);
            // Ordenar de forma natural por ID o created_at
            mapped.sort((a, b) => {
              const numA = parseInt((a.id || '').replace(/[^0-9]/g, ''), 10) || 0;
              const numB = parseInt((b.id || '').replace(/[^0-9]/g, ''), 10) || 0;
              return numA - numB;
            });
            saveLocalAthletes(mapped); // Sincroniza respaldo local
            console.log(`☁️ [Supabase] ${mapped.length} atletas cargados desde la nube.`);
            return mapped;
          } else if (data && data.length === 0) {
            // Si la base de datos está vacía, sembrar iniciales
            const initialList = window.INITIAL_ATHLETES ? [...window.INITIAL_ATHLETES] : [];
            if (initialList.length > 0) {
              const rows = initialList.map(a => toDbModel(a, true));
              try {
                await client.from('atletas').insert(rows);
              } catch (seedErr) {
                console.warn('Error al sembrar iniciales con genero, reintentando sin genero...', seedErr);
                const rowsNoGenero = initialList.map(a => toDbModel(a, false));
                await client.from('atletas').insert(rowsNoGenero);
              }
              return initialList;
            }
            return [];
          }
        } catch (err) {
          console.warn('⚠️ [Supabase Exception] Usando respaldo local:', err);
          return getLocalAthletes();
        }
      }
      return getLocalAthletes();
    },

    // 2. Crear nuevo atleta (CREATE)
    insertAthlete: async function (athlete) {
      const client = getSupabaseClient();

      if (client && isConnected) {
        try {
          // Intentar inserción completa con genero
          let row = toDbModel(athlete, true);
          let response = await client
            .from('atletas')
            .insert([row])
            .select();

          // Si falla por columna 'genero' faltante en la tabla Supabase, reintentar automáticamente sin genero
          if (response.error && (response.error.message.includes('genero') || response.error.code === 'PGRST204')) {
            console.warn('⚠️ Columna genero ausente en Supabase, reintentando inserción sin genero...');
            row = toDbModel(athlete, false);
            response = await client
              .from('atletas')
              .insert([row])
              .select();
          }

          if (response.error) {
            console.error('❌ [Supabase INSERT Error]:', response.error);
            // Si la nube falló por error de BD, sincronizar local como fallback
            const local = getLocalAthletes();
            local.push(athlete);
            saveLocalAthletes(local);
            return { success: false, error: response.error, data: athlete };
          }

          const savedItem = response.data && response.data[0] ? fromDbModel(response.data[0]) : athlete;
          console.log('✅ [Supabase INSERT Exitoso]:', savedItem.id);

          // Actualizar caché local con el atleta confirmado en la nube
          const local = getLocalAthletes().filter(a => a.id !== savedItem.id);
          local.push(savedItem);
          saveLocalAthletes(local);

          return { success: true, data: savedItem };
        } catch (err) {
          console.error('❌ [Supabase INSERT Excepción]:', err);
          const local = getLocalAthletes();
          local.push(athlete);
          saveLocalAthletes(local);
          return { success: false, error: err, data: athlete };
        }
      }

      // Modo Local puro
      const local = getLocalAthletes();
      local.push(athlete);
      saveLocalAthletes(local);
      return { success: true, data: athlete, isLocalOnly: true };
    },

    // 3. Actualizar atleta existente (UPDATE)
    updateAthlete: async function (id, updatedFields) {
      const client = getSupabaseClient();

      if (client && isConnected) {
        try {
          let row = toDbModel({ id, ...updatedFields }, true);
          let response = await client
            .from('atletas')
            .update(row)
            .eq('id', id)
            .select();

          // Si falla por columna genero, reintentar sin genero
          if (response.error && (response.error.message.includes('genero') || response.error.code === 'PGRST204')) {
            row = toDbModel({ id, ...updatedFields }, false);
            response = await client
              .from('atletas')
              .update(row)
              .eq('id', id)
              .select();
          }

          if (response.error) {
            console.error('❌ [Supabase UPDATE Error]:', response.error);
            return { success: false, error: response.error };
          }

          // Actualizar caché local
          const local = getLocalAthletes();
          const idx = local.findIndex(a => a.id === id);
          if (idx !== -1) {
            local[idx] = { ...local[idx], ...updatedFields };
            saveLocalAthletes(local);
          }

          console.log('✅ [Supabase UPDATE Exitoso]:', id);
          return { success: true, data: response.data };
        } catch (err) {
          console.error('❌ [Supabase UPDATE Excepción]:', err);
          return { success: false, error: err };
        }
      }

      // Modo Local puro
      const local = getLocalAthletes();
      const idx = local.findIndex(a => a.id === id);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updatedFields };
        saveLocalAthletes(local);
      }
      return { success: true, isLocalOnly: true };
    },

    // 4. Eliminar atleta (DELETE)
    deleteAthlete: async function (id) {
      const client = getSupabaseClient();

      if (client && isConnected) {
        try {
          const { error } = await client
            .from('atletas')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('❌ [Supabase DELETE Error]:', error);
            return { success: false, error };
          }

          // Actualizar caché local
          let local = getLocalAthletes();
          local = local.filter(a => a.id !== id);
          saveLocalAthletes(local);

          console.log('✅ [Supabase DELETE Exitoso]:', id);
          return { success: true };
        } catch (err) {
          console.error('❌ [Supabase DELETE Excepción]:', err);
          return { success: false, error: err };
        }
      }

      // Modo Local puro
      let local = getLocalAthletes();
      local = local.filter(a => a.id !== id);
      saveLocalAthletes(local);
      return { success: true, isLocalOnly: true };
    },

    // 5. Suscripción en Tiempo Real (Realtime Listener - Atletas y Cuerpo Técnico)
    subscribeRealtime: function (onChangeCallback) {
      const client = getSupabaseClient();
      if (!client || !isConnected || typeof onChangeCallback !== 'function') {
        return null;
      }

      try {
        if (activeRealtimeChannel) {
          client.removeChannel(activeRealtimeChannel);
        }

        activeRealtimeChannel = client
          .channel('public:abc-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'atletas' },
            (payload) => {
              console.log('⚡ [Realtime Supabase] Evento en atletas:', payload.eventType, payload);
              onChangeCallback({ table: 'atletas', ...payload });
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'cuerpo_tecnico' },
            (payload) => {
              console.log('⚡ [Realtime Supabase] Evento en cuerpo_tecnico:', payload.eventType, payload);
              onChangeCallback({ table: 'cuerpo_tecnico', ...payload });
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log('🟢 [Realtime Supabase] Canal conectado en tiempo real (atletas + cuerpo_tecnico).');
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('⚠️ [Realtime Supabase] Error en canal Realtime:', err);
            }
          });

        return activeRealtimeChannel;
      } catch (err) {
        console.warn('⚠️ Error al establecer suscripción Realtime en Supabase:', err);
        return null;
      }
    },

    // 6. Obtener todo el cuerpo técnico (READ)
    fetchStaff: async function () {
      const client = getSupabaseClient();
      if (client && isConnected) {
        try {
          const { data, error } = await client
            .from('cuerpo_tecnico')
            .select('*')
            .order('id', { ascending: true });

          if (error) {
            console.error('⚠️ [Supabase SELECT cuerpo_tecnico Error]:', error);
            return getLocalStaff();
          }

          if (data && Array.isArray(data)) {
            const mapped = data.map(fromStaffDbModel);
            saveLocalStaff(mapped);
            console.log(`✅ [Supabase] ${mapped.length} miembros del cuerpo técnico sincronizados.`);
            return mapped;
          }
        } catch (err) {
          console.error('⚠️ [Supabase SELECT cuerpo_tecnico Excepción]:', err);
          return getLocalStaff();
        }
      }
      return getLocalStaff();
    },

    // 7. Guardar nuevo miembro del cuerpo técnico (INSERT / UPSERT)
    saveStaffMember: async function (staffData) {
      const client = getSupabaseClient();

      if (!staffData.id) {
        const local = getLocalStaff();
        const maxNum = local.reduce((max, s) => {
          const num = parseInt((s.id || '').replace(/\D/g, ''), 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        staffData.id = `CT-${String(maxNum + 1).padStart(3, '0')}`;
      }

      if (client && isConnected) {
        try {
          const dbRow = toStaffDbModel(staffData);
          const { data, error } = await client
            .from('cuerpo_tecnico')
            .upsert(dbRow, { onConflict: 'id' })
            .select();

          if (error) {
            console.error('❌ [Supabase UPSERT cuerpo_tecnico Error]:', error);
            const local = getLocalStaff();
            const existingIdx = local.findIndex(s => s.id === staffData.id);
            if (existingIdx !== -1) local[existingIdx] = staffData;
            else local.push(staffData);
            saveLocalStaff(local);
            return { success: true, isLocalOnly: true, data: staffData };
          }

          const savedItem = data && data[0] ? fromStaffDbModel(data[0]) : staffData;
          const local = getLocalStaff();
          const existingIdx = local.findIndex(s => s.id === savedItem.id);
          if (existingIdx !== -1) local[existingIdx] = savedItem;
          else local.push(savedItem);
          saveLocalStaff(local);

          console.log('✅ [Supabase UPSERT cuerpo_tecnico Exitoso]:', savedItem.id);
          return { success: true, data: savedItem };
        } catch (err) {
          console.error('❌ [Supabase UPSERT cuerpo_tecnico Excepción]:', err);
          const local = getLocalStaff();
          local.push(staffData);
          saveLocalStaff(local);
          return { success: true, isLocalOnly: true, data: staffData };
        }
      }

      const local = getLocalStaff();
      const existingIdx = local.findIndex(s => s.id === staffData.id);
      if (existingIdx !== -1) local[existingIdx] = staffData;
      else local.push(staffData);
      saveLocalStaff(local);
      return { success: true, isLocalOnly: true, data: staffData };
    },

    // 8. Actualizar miembro técnico (UPDATE)
    updateStaffMember: async function (id, updatedFields) {
      const client = getSupabaseClient();
      if (client && isConnected) {
        try {
          const updatePayload = {};
          if (updatedFields.nombres !== undefined) updatePayload.nombres = updatedFields.nombres;
          if (updatedFields.apellidos !== undefined) updatePayload.apellidos = updatedFields.apellidos;
          if (updatedFields.cedula !== undefined) updatePayload.cedula = updatedFields.cedula;
          if (updatedFields.telefono !== undefined) updatePayload.telefono = updatedFields.telefono;
          if (updatedFields.email !== undefined) updatePayload.email = updatedFields.email;
          if (updatedFields.rol !== undefined) updatePayload.rol = updatedFields.rol;
          if (updatedFields.categorias !== undefined) updatePayload.categorias = updatedFields.categorias;
          if (updatedFields.experiencia !== undefined) updatePayload.experiencia = updatedFields.experiencia;
          if (updatedFields.foto !== undefined) updatePayload.foto = updatedFields.foto;
          if (updatedFields.estatus !== undefined) updatePayload.estatus = updatedFields.estatus;

          const { error } = await client
            .from('cuerpo_tecnico')
            .update(updatePayload)
            .eq('id', id);

          if (error) {
            console.error('❌ [Supabase UPDATE cuerpo_tecnico Error]:', error);
          } else {
            console.log('✅ [Supabase UPDATE cuerpo_tecnico Exitoso]:', id);
          }
        } catch (err) {
          console.error('❌ [Supabase UPDATE cuerpo_tecnico Excepción]:', err);
        }
      }

      const local = getLocalStaff();
      const idx = local.findIndex(s => s.id === id);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updatedFields };
        saveLocalStaff(local);
      }
      return { success: true };
    },

    // 9. Eliminar miembro técnico (DELETE)
    deleteStaffMember: async function (id) {
      const client = getSupabaseClient();
      if (client && isConnected) {
        try {
          const { error } = await client
            .from('cuerpo_tecnico')
            .delete()
            .eq('id', id);

          if (error) console.error('❌ [Supabase DELETE cuerpo_tecnico Error]:', error);
          else console.log('✅ [Supabase DELETE cuerpo_tecnico Exitoso]:', id);
        } catch (err) {
          console.error('❌ [Supabase DELETE cuerpo_tecnico Excepción]:', err);
        }
      }

      let local = getLocalStaff();
      local = local.filter(s => s.id !== id);
      saveLocalStaff(local);
      return { success: true };
    }
  };

  // Inicializar al cargar
  getSupabaseClient();

  // Exponer globalmente
  window.ABCSupabase = dbApi;
})();
