/* ==========================================================================
   ACADEMIA DE BALONCESTO CARIPITO (ABC) - CLIENTE SUPABASE & DATA LAYER
   Manejo Asíncrono de Base de Datos en la Nube con Fallback Seguro
   ========================================================================== */

(function () {
  const LOCAL_STORAGE_KEY = 'ABC_CARIPITO_ATHLETES_DB_V1';
  let supabaseInstance = null;
  let isConnected = false;

  // Inicializar Cliente Supabase
  function initSupabase() {
    const config = window.ABC_CONFIG || {};
    const url = config.SUPABASE_URL;
    const key = config.SUPABASE_ANON_KEY;

    const isPlaceholder = !url || !key || 
      url.includes('TU_PROYECTO') || 
      key.includes('TU_SUPABASE_ANON_KEY') ||
      url === 'https://tu-proyecto.supabase.co';

    if (!isPlaceholder && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabaseInstance = window.supabase.createClient(url, key);
        isConnected = true;
        console.log('⚡ [ABC Supabase] Cliente inicializado correctamente.');
      } catch (err) {
        console.warn('⚠️ [ABC Supabase] Error al instanciar cliente Supabase:', err);
        supabaseInstance = null;
        isConnected = false;
      }
    } else {
      isConnected = false;
      if (isPlaceholder) {
        console.log('ℹ️ [ABC Supabase] Modo Local Activo (Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js para conectar la nube).');
      }
    }
  }

  // Mapear campos de objeto JavaScript (camelCase) a columnas PostgreSQL (snake_case)
  function toDbModel(athlete) {
    return {
      id: athlete.id,
      fecha_ingreso: athlete.fechaIngreso || new Date().toISOString().split('T')[0],
      nombres: athlete.nombres,
      apellidos: athlete.apellidos,
      cedula: athlete.cedula,
      genero: athlete.genero || 'Masculino',
      fecha_nac: athlete.fechaNac || null,
      edad: parseInt(athlete.edad, 10) || 0,
      peso: parseFloat(athlete.peso) || 0,
      estatura: parseFloat(athlete.estatura) || 0,
      imc: parseFloat(athlete.imc) || 0,
      salud: athlete.salud || 'Sin novedades médicas',
      tipo_sangre: athlete.tipoSangre || 'O+',
      posicion: athlete.posicion || 'Formativo',
      categoria: athlete.categoria || 'U18',
      dorsal: athlete.dorsal || 'S/N',
      representante: athlete.representante,
      parentesco: athlete.parentesco,
      telefono_rep: athlete.telefonoRep,
      telefono_emergencia: athlete.telefonoEmergencia || athlete.telefonoRep,
      direccion: athlete.direccion || 'Caripito, Edo. Monagas',
      foto: athlete.foto || null,
      estatus: athlete.estatus || 'Activo'
    };
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
      fechaNac: row.fecha_nac,
      edad: row.edad,
      peso: parseFloat(row.peso) || 0,
      estatura: parseFloat(row.estatura) || 0,
      imc: parseFloat(row.imc) || 0,
      salud: row.salud,
      tipoSangre: row.tipo_sangre,
      posicion: row.posicion,
      categoria: row.categoria,
      dorsal: row.dorsal,
      representante: row.representante,
      parentesco: row.parentesco,
      telefonoRep: row.telefono_rep,
      telefonoEmergencia: row.telefono_emergencia,
      direccion: row.direccion,
      foto: row.foto,
      estatus: row.estatus || 'Activo'
    };
  }

  // Obtener atletas desde LocalStorage
  function getLocalAthletes() {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error leyendo localStorage', e);
    }
    return window.INITIAL_ATHLETES ? [...window.INITIAL_ATHLETES] : [];
  }

  // Guardar atletas en LocalStorage como respaldo/caché
  function saveLocalAthletes(athletes) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(athletes));
    } catch (e) {
      console.error('Error guardando en localStorage', e);
    }
  }

  // API Asíncrona Unificada
  const dbApi = {
    // Verificar si está conectado a la nube
    isCloudActive: function () {
      return !!(supabaseInstance && isConnected);
    },

    // 1. Obtener todos los atletas (READ)
    fetchAthletes: async function () {
      if (dbApi.isCloudActive()) {
        try {
          const { data, error } = await supabaseInstance
            .from('atletas')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Error en Supabase SELECT:', error);
            return getLocalAthletes();
          }

          if (data && data.length > 0) {
            const mapped = data.map(fromDbModel);
            saveLocalAthletes(mapped); // Sincroniza caché local
            return mapped;
          } else if (data && data.length === 0) {
            // Si la base de datos en la nube está recién creada pero vacía, se siembran los iniciales
            const initialList = window.INITIAL_ATHLETES ? [...window.INITIAL_ATHLETES] : [];
            if (initialList.length > 0) {
              const rows = initialList.map(toDbModel);
              await supabaseInstance.from('atletas').insert(rows);
              return initialList;
            }
            return [];
          }
        } catch (err) {
          console.warn('Excepción al conectar con Supabase, usando respaldo local:', err);
          return getLocalAthletes();
        }
      }
      return getLocalAthletes();
    },

    // 2. Crear nuevo atleta (CREATE)
    insertAthlete: async function (athlete) {
      // Guardar primero en caché local para respuesta inmediata
      const local = getLocalAthletes();
      local.unshift(athlete);
      saveLocalAthletes(local);

      if (dbApi.isCloudActive()) {
        try {
          const row = toDbModel(athlete);
          const { data, error } = await supabaseInstance
            .from('atletas')
            .insert([row])
            .select();

          if (error) {
            console.error('Error en Supabase INSERT:', error);
            return { success: false, error, data: athlete };
          }
          return { success: true, data: data ? fromDbModel(data[0]) : athlete };
        } catch (err) {
          console.error('Excepción en Supabase INSERT:', err);
          return { success: false, error: err, data: athlete };
        }
      }
      return { success: true, data: athlete };
    },

    // 3. Actualizar atleta existente (UPDATE)
    updateAthlete: async function (id, updatedFields) {
      const local = getLocalAthletes();
      const index = local.findIndex(a => a.id === id);
      if (index !== -1) {
        local[index] = { ...local[index], ...updatedFields };
        saveLocalAthletes(local);
      }

      if (dbApi.isCloudActive()) {
        try {
          const row = toDbModel({ id, ...updatedFields });
          const { data, error } = await supabaseInstance
            .from('atletas')
            .update(row)
            .eq('id', id)
            .select();

          if (error) {
            console.error('Error en Supabase UPDATE:', error);
            return { success: false, error };
          }
          return { success: true, data };
        } catch (err) {
          console.error('Excepción en Supabase UPDATE:', err);
          return { success: false, error: err };
        }
      }
      return { success: true };
    },

    // 4. Eliminar atleta (DELETE)
    deleteAthlete: async function (id) {
      let local = getLocalAthletes();
      local = local.filter(a => a.id !== id);
      saveLocalAthletes(local);

      if (dbApi.isCloudActive()) {
        try {
          const { error } = await supabaseInstance
            .from('atletas')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Error en Supabase DELETE:', error);
            return { success: false, error };
          }
          return { success: true };
        } catch (err) {
          console.error('Excepción en Supabase DELETE:', err);
          return { success: false, error: err };
        }
      }
      return { success: true };
    },

    // 5. Suscripción en Tiempo Real (Realtime Listener)
    subscribeRealtime: function (onChangeCallback) {
      if (dbApi.isCloudActive() && typeof onChangeCallback === 'function') {
        try {
          const channel = supabaseInstance
            .channel('atletas_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'atletas' }, (payload) => {
              console.log('⚡ [Realtime Supabase] Cambio detectado en la nube:', payload);
              onChangeCallback(payload);
            })
            .subscribe();
          return channel;
        } catch (err) {
          console.warn('No se pudo establecer suscripción Realtime:', err);
        }
      }
      return null;
    }
  };

  // Inicializar al cargar
  initSupabase();

  // Exponer globalmente
  window.ABCSupabase = dbApi;
})();
