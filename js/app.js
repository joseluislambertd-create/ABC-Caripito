/* ==========================================================================
   ACADEMIA DE BALONCESTO CARIPITO (ABC) - APP CONTROLLER
   ========================================================================== */

// Global State
const APP_STORAGE_KEY = 'ABC_CARIPITO_ATHLETES_DB_V1';

let state = {
  athletes: [],
  selectedAthleteId: null,
  currentView: 'registro', // 'registro', 'base-datos', 'fichas-pro', 'ficha-oficial', 'impresion'
  isRepresentativeMode: false,
  searchQuery: '',
  filterCategory: 'all',
  filterStatus: 'all',
  filterHealth: 'all',
  activeKpiFilter: null,
  activePhotoData: null
};

// Default Sample Photos for fallback
const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80'
];

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  initLogo();
  checkUrlParams();
  setupEventListeners();
  setupFormCalculations();
  setupEditCalculations();
  setupLivePreview();
  updateCloudStatusIndicator();
  await loadAthletes();
  setupRealtimeSync();
});

// Load Logo to all logo elements
function initLogo() {
  const logoUrl = window.APP_LOGO_B64 || 'assets/logo.jpg';
  document.querySelectorAll('.brand-logo-img, .card-banner-logo, .ficha-header-logo, .print-logo').forEach(img => {
    img.src = logoUrl;
  });
}

// Load athletes from Supabase (Cloud) or LocalStorage (Fallback)
async function loadAthletes() {
  if (window.ABCSupabase) {
    state.athletes = await window.ABCSupabase.fetchAthletes();
  } else {
    const saved = localStorage.getItem(APP_STORAGE_KEY);
    if (saved !== null) {
      try {
        state.athletes = JSON.parse(saved);
        if (!Array.isArray(state.athletes)) {
          state.athletes = [];
        }
      } catch (e) {
        console.error('Error parsing stored athletes', e);
        state.athletes = [];
      }
    } else {
      state.athletes = window.INITIAL_ATHLETES ? [...window.INITIAL_ATHLETES] : [];
    }
  }

  if (state.athletes.length > 0) {
    if (!state.selectedAthleteId || !state.athletes.some(a => a.id === state.selectedAthleteId)) {
      state.selectedAthleteId = state.athletes[0].id;
    }
  } else {
    state.selectedAthleteId = null;
  }

  renderAll();
  updateCloudStatusIndicator();
}

function saveAthletes() {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state.athletes));
  updateStats();
}

// Update Cloud Connection Status Indicator in Header
function updateCloudStatusIndicator() {
  const badge = document.getElementById('cloudStatusBadge');
  const label = document.getElementById('cloudStatusLabel');
  const isCloud = window.ABCSupabase && window.ABCSupabase.isCloudActive();

  if (badge && label) {
    if (isCloud) {
      badge.classList.add('connected');
      badge.title = 'Conectado a Base de Datos en la Nube (Supabase PostgreSQL)';
      label.innerText = 'Nube Supabase';
    } else {
      badge.classList.remove('connected');
      badge.title = 'Almacenamiento Local Activo (Configura js/config.js para conectar Supabase)';
      label.innerText = 'Modo Local';
    }
  }
}

// Setup Realtime Sync Listener from Supabase
function setupRealtimeSync() {
  if (window.ABCSupabase && window.ABCSupabase.isCloudActive()) {
    window.ABCSupabase.subscribeRealtime(async (payload) => {
      console.log('⚡ Recibiendo actualización en tiempo real...', payload);
      await loadAthletes();
      showToast('⚡ Datos sincronizados en tiempo real con la nube');
    });
  }
}

/**
 * Evalúa inteligentemente si una condición médica representa una ALERTA MÉDICA activa
 * o un Estado NORMAL / SANO.
 * @param {string} text - Texto ingresado en el campo condición médica o salud
 * @returns {boolean} true si es Alerta Médica real, false si es Normal/Sano/Sin Alerta
 */
function isMedicalAlert(text) {
  if (!text) return false;
  const s = text.toString().toLowerCase().trim();
  if (!s || s === '-' || s === '--' || s === 'n/a' || s === 'na' || s === 's/n') return false;

  // Frases o palabras que representan estado NORMAL / SANO
  const normalExpressions = [
    'sin novedad',
    'sin novedades',
    'sin novedades médicas',
    'sin novedades medicas',
    'sano',
    'sana',
    'completamente sano',
    'completamente sana',
    'ninguna',
    'ninguno',
    'no posee',
    'no tiene',
    'no refiere',
    'no aplica',
    'n/a',
    'normal',
    'excelente',
    'excelente estado',
    'perfecto',
    'perfecta',
    'saludable',
    'apto',
    'apta',
    'buena salud',
    'bueno',
    'buena',
    'negativo'
  ];

  // Si coincide exactamente con alguna expresión normal
  for (const expr of normalExpressions) {
    if (s === expr) return false;
  }

  // Si comienza con negación de condición ("sin ...", "no posee ...", "no tiene ...", "no refiere ...")
  if (
    s.startsWith('sin ') ||
    s.startsWith('no presenta') ||
    s.startsWith('no tiene') ||
    s.startsWith('no posee') ||
    s.startsWith('no refiere') ||
    s.startsWith('no padece')
  ) {
    return false;
  }

  // Términos clave de condiciones o alertas médicas reales
  const alertKeywords = [
    'alerg', 'asma', 'asmátic', 'asmatil', 'tratamiento', 'lesi', 'fractura',
    'operad', 'medicad', 'medicamento', 'enferm', 'cardio', 'corazon', 'presion',
    'hipertens', 'diabet', 'epilep', 'convuls', 'inhalador', 'esguince',
    'cirugia', 'penicilina', 'polvo', 'rodilla', 'tobillo', 'columna',
    'intoleran', 'cronica', 'aguda', 'cuidado', 'reposo', 'rehabilitacion',
    'disloca', 'tendin', 'menisco', 'ligamento'
  ];

  for (const kw of alertKeywords) {
    if (s.includes(kw)) return true;
  }

  // Si contiene una frase normal ("sin novedades", etc.) dentro del texto
  for (const expr of normalExpressions) {
    if (s.includes(expr)) return false;
  }

  // Cualquier otra especificación médica que no sea una declaración de salud normal
  return s.length >= 3;
}

// Check URL Params (e.g. ?view=registro or ?view=database)
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view') || params.get('mode');
  const roleParam = params.get('role');

  // Detect restricted Representative Mode (?view=registro o ?mode=registro o ?role=representante)
  if (viewParam === 'registro' || roleParam === 'representante' || roleParam === 'public') {
    state.isRepresentativeMode = true;
    switchView('registro');
  } else {
    state.isRepresentativeMode = false;
    if (viewParam && ['base-datos', 'fichas-pro', 'ficha-oficial'].includes(viewParam)) {
      switchView(viewParam);
    } else {
      switchView('registro');
    }
  }

  const athleteParam = params.get('id');
  if (athleteParam && !state.isRepresentativeMode) {
    const found = state.athletes.find(a => a.id.toLowerCase() === athleteParam.toLowerCase());
    if (found) {
      state.selectedAthleteId = found.id;
      switchView('ficha-oficial');
    }
  }

  applyRolePermissions();
}

// Apply Role Permissions & Restrict Modules in Representative Mode
function applyRolePermissions() {
  const isRep = !!state.isRepresentativeMode;
  document.body.classList.toggle('rep-mode-active', isRep);

  const shareBtn = document.getElementById('btnOpenShareModal');
  const repBadge = document.getElementById('repModeBadge');
  const btnSuccessFicha = document.getElementById('btnSuccessViewFicha');
  const btnSuccessDb = document.getElementById('btnSuccessViewDatabase');
  const btnSuccessNew = document.getElementById('btnSuccessNewRegister');

  if (isRep) {
    if (shareBtn) shareBtn.style.display = 'none';
    if (repBadge) repBadge.style.display = 'inline-flex';
    if (btnSuccessFicha) btnSuccessFicha.style.display = 'none';
    if (btnSuccessDb) btnSuccessDb.style.display = 'none';
    if (btnSuccessNew) btnSuccessNew.style.display = 'inline-flex';

    // Set KPI Cards to Read-Only mode
    const kpiCards = [
      { id: 'kpiCardTotal', hint: '📋 TOTAL REGISTRADOS' },
      { id: 'kpiCardActive', hint: '⚡ EN ENTRENAMIENTO' },
      { id: 'kpiCardHealth', hint: '🩺 CONTROL DE SALUD' },
      { id: 'kpiCardHeight', hint: '📏 PROMEDIO DEL PLANTEL' }
    ];

    kpiCards.forEach(k => {
      const card = document.getElementById(k.id);
      if (card) {
        card.classList.remove('stat-card-interactive');
        card.removeAttribute('role');
        card.removeAttribute('tabindex');
        card.removeAttribute('title');
        const hintEl = card.querySelector('.stat-hint');
        if (hintEl) hintEl.innerText = k.hint;
      }
    });
  } else {
    if (shareBtn) shareBtn.style.display = 'inline-flex';
    if (repBadge) repBadge.style.display = 'none';
    if (btnSuccessFicha) btnSuccessFicha.style.display = 'inline-flex';
    if (btnSuccessDb) btnSuccessDb.style.display = 'inline-flex';
    if (btnSuccessNew) btnSuccessNew.style.display = 'none';

    // Admin KPI Cards - interactive with tooltips and action hints
    const kpiCards = [
      { id: 'kpiCardTotal', hint: '👁️ MOSTRAR TODOS', title: 'Haz clic para ver todos los atletas y resetear filtros' },
      { id: 'kpiCardActive', hint: '⚡ FILTRAR ACTIVOS', title: 'Haz clic para filtrar solo atletas con estatus ACTIVO' },
      { id: 'kpiCardHealth', hint: '⚠️ FILTRAR ALERTAS', title: 'Haz clic para filtrar atletas con alertas médicas o alergias' },
      { id: 'kpiCardHeight', hint: '📐 VER DESGLOSE', title: 'Haz clic para ver el desglose estadístico de estatura' }
    ];

    kpiCards.forEach(k => {
      const card = document.getElementById(k.id);
      if (card) {
        card.classList.add('stat-card-interactive');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('title', k.title);
        const hintEl = card.querySelector('.stat-hint');
        if (hintEl) hintEl.innerText = k.hint;
      }
    });
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (targetView) switchView(targetView);
    });
  });

  // Share Link Button
  const btnShare = document.getElementById('btnOpenShareModal');
  if (btnShare) {
    btnShare.addEventListener('click', openShareModal);
  }

  // Search Input
  const searchInput = document.getElementById('tableSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      renderTable();
      renderCardsGrid();
    });
  }

  // Filter Selects
  const filterCat = document.getElementById('filterCategory');
  if (filterCat) {
    filterCat.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      renderTable();
      renderCardsGrid();
    });
  }

  const filterStat = document.getElementById('filterStatus');
  if (filterStat) {
    filterStat.addEventListener('change', (e) => {
      state.filterStatus = e.target.value;
      state.activeKpiFilter = null;
      updateKpiCardHighlight();
      updateResetButtonVisibility();
      renderTable();
      renderCardsGrid();
    });
  }

  const filterH = document.getElementById('filterHealth');
  if (filterH) {
    filterH.addEventListener('change', (e) => {
      state.filterHealth = e.target.value;
      state.activeKpiFilter = null;
      updateKpiCardHighlight();
      updateResetButtonVisibility();
      renderTable();
      renderCardsGrid();
    });
  }

  // Ficha Selector Select
  const fichaSelect = document.getElementById('fichaAthleteSelect');
  if (fichaSelect) {
    fichaSelect.addEventListener('change', (e) => {
      state.selectedAthleteId = e.target.value;
      renderFichaOficial();
    });
  }

  // Registration Form Submission
  const regForm = document.getElementById('athleteRegisterForm');
  if (regForm) {
    regForm.addEventListener('submit', handleRegisterSubmit);
  }

  // Edit Athlete Form Submission
  const editForm = document.getElementById('editAthleteForm');
  if (editForm) {
    editForm.addEventListener('submit', handleEditFormSubmit);
  }

  // Photo Uploader Drag & Drop + File Select
  setupPhotoUploader();

  // Modal Closes
  document.querySelectorAll('.btn-modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.classList.contains('btn-modal-close')) {
        closeAllModals();
      }
    });
  });

  // Copy Link Button & Real-time QR update
  const btnCopy = document.getElementById('btnCopyShareLink');
  const shareInput = document.getElementById('shareLinkInput');
  if (btnCopy && shareInput) {
    btnCopy.addEventListener('click', () => {
      shareInput.select();
      navigator.clipboard.writeText(shareInput.value);
      showToast('¡Enlace de registro copiado al portapapeles!');
    });

    shareInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        generateQrCode(val);
      }
    });
  }
}

// Switch Active View
function switchView(viewName) {
  if (state.isRepresentativeMode && viewName !== 'registro') {
    return; // Representative mode strictly stays on registration form
  }

  state.currentView = viewName;
  
  // Update Nav tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update View containers
  document.querySelectorAll('.view-container').forEach(view => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });

  if (viewName === 'base-datos') renderTable();
  if (viewName === 'fichas-pro') renderCardsGrid();
  if (viewName === 'ficha-oficial') renderFichaOficial();
}

// Stats Calculation
function updateStats() {
  const total = state.athletes.length;
  const activos = state.athletes.filter(a => (a.estatus || 'Activo').toLowerCase() === 'activo').length;
  const conAlertas = state.athletes.filter(a => isMedicalAlert(a.salud)).length;

  let avgHeightFormatted = "0,00 m";
  if (total > 0) {
    const heights = state.athletes.map(a => parseFloat(a.estatura) || 0).filter(h => h > 0);
    if (heights.length > 0) {
      const avg = (heights.reduce((a, b) => a + b, 0) / heights.length).toFixed(2);
      avgHeightFormatted = `${avg.replace('.', ',')} m`;
    }
  }

  const statTotal = document.getElementById('statTotalAthletes');
  if (statTotal) statTotal.innerText = total;

  const statActive = document.getElementById('statActiveAthletes');
  if (statActive) statActive.innerText = activos;

  const statHealth = document.getElementById('statHealthAlerts');
  if (statHealth) statHealth.innerText = conAlertas;

  const statAvg = document.getElementById('statAvgHeight');
  if (statAvg) statAvg.innerText = avgHeightFormatted;
}

// Setup Form Age & IMC calculations
function setupFormCalculations() {
  const fechaNacInput = document.getElementById('regFechaNac');
  const edadBadge = document.getElementById('regEdadCalculada');
  const pesoInput = document.getElementById('regPeso');
  const estaturaInput = document.getElementById('regEstatura');
  const imcBadge = document.getElementById('regImcCalculado');

  function updateAge() {
    if (!fechaNacInput || !fechaNacInput.value) return;
    const birthDate = new Date(fechaNacInput.value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (edadBadge) {
      edadBadge.innerText = `${age >= 0 ? age : 0} años`;
    }
  }

  function updateIMC() {
    const peso = parseFloat(pesoInput ? pesoInput.value : 0);
    const estatura = parseFloat(estaturaInput ? estaturaInput.value : 0);
    if (peso > 0 && estatura > 0.5) {
      const imc = (peso / (estatura * estatura)).toFixed(1);
      let cat = 'Normal';
      if (imc < 18.5) cat = 'Bajo peso';
      else if (imc >= 25 && imc < 30) cat = 'Sobrepeso';
      else if (imc >= 30) cat = 'Obesidad';

      if (imcBadge) {
        imcBadge.innerText = `IMC: ${imc} (${cat})`;
      }
    } else {
      if (imcBadge) imcBadge.innerText = 'IMC: --';
    }
  }

  if (fechaNacInput) fechaNacInput.addEventListener('input', updateAge);
  if (pesoInput) pesoInput.addEventListener('input', updateIMC);
  if (estaturaInput) estaturaInput.addEventListener('input', updateIMC);
}

// Setup Edit Form Age & IMC calculations
function setupEditCalculations() {
  const fechaNacInput = document.getElementById('editFechaNac');
  const edadBadge = document.getElementById('editEdadCalculada');
  const edadInput = document.getElementById('editEdad');
  const pesoInput = document.getElementById('editPeso');
  const estaturaInput = document.getElementById('editEstatura');
  const imcBadge = document.getElementById('editImcCalculado');

  function updateEditAge() {
    if (!fechaNacInput || !fechaNacInput.value) return;
    const birthDate = new Date(fechaNacInput.value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    const finalAge = age >= 0 ? age : 0;
    if (edadBadge) edadBadge.innerText = `${finalAge} años`;
    if (edadInput) edadInput.value = finalAge;
  }

  function updateEditIMC() {
    const peso = parseFloat(pesoInput ? pesoInput.value : 0);
    const estatura = parseFloat(estaturaInput ? estaturaInput.value : 0);
    if (peso > 0 && estatura > 0.5) {
      const imc = (peso / (estatura * estatura)).toFixed(1);
      let cat = 'Normal';
      if (imc < 18.5) cat = 'Bajo peso';
      else if (imc >= 25 && imc < 30) cat = 'Sobrepeso';
      else if (imc >= 30) cat = 'Obesidad';

      if (imcBadge) {
        imcBadge.innerText = `IMC: ${imc} (${cat})`;
      }
    } else {
      if (imcBadge) imcBadge.innerText = 'IMC: --';
    }
  }

  if (fechaNacInput) fechaNacInput.addEventListener('input', updateEditAge);
  if (pesoInput) pesoInput.addEventListener('input', updateEditIMC);
  if (estaturaInput) estaturaInput.addEventListener('input', updateEditIMC);
}

// Live Preview on Registration Form
function setupLivePreview() {
  const inputs = [
    'regNombres', 'regApellidos', 'regCedula', 'regFechaNac', 'regPeso',
    'regEstatura', 'regPosicion', 'regCategoria', 'regDorsal', 'regSalud',
    'regRepresentante', 'regParentesco', 'regTelefonoRep'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateCardPreview);
    }
  });
}

function updateCardPreview() {
  const nombres = document.getElementById('regNombres')?.value || 'Nombre';
  const apellidos = document.getElementById('regApellidos')?.value || 'Atleta';
  const dorsal = document.getElementById('regDorsal')?.value || '#';
  const posicion = document.getElementById('regPosicion')?.value || 'Posición / Categoría';
  const peso = document.getElementById('regPeso')?.value || '--';
  const estatura = document.getElementById('regEstatura')?.value || '--';
  const salud = document.getElementById('regSalud')?.value || 'Sin novedades médicas';
  const rep = document.getElementById('regRepresentante')?.value || 'Representante';
  const parentesco = document.getElementById('regParentesco')?.value || 'Tutor';
  const fechaNac = document.getElementById('regFechaNac')?.value;

  let edad = '--';
  if (fechaNac) {
    const birthDate = new Date(fechaNac);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) calculatedAge--;
    edad = `${calculatedAge >= 0 ? calculatedAge : '--'}a`;
  }

  let imc = '--';
  const p = parseFloat(peso);
  const e = parseFloat(estatura);
  if (p > 0 && e > 0.5) {
    imc = (p / (e * e)).toFixed(1);
  }

  // Update preview card elements
  const prevName = document.getElementById('previewAthleteName');
  if (prevName) prevName.innerText = `${nombres} ${apellidos}`;

  const prevDorsal = document.getElementById('previewAthleteDorsal');
  if (prevDorsal) prevDorsal.innerText = dorsal ? dorsal : '🏀';

  const prevPos = document.getElementById('previewAthletePos');
  if (prevPos) prevPos.innerText = posicion;

  const prevHeight = document.getElementById('previewAthleteHeight');
  if (prevHeight) prevHeight.innerText = estatura !== '--' ? `${estatura}m` : '--';

  const prevWeight = document.getElementById('previewAthleteWeight');
  if (prevWeight) prevWeight.innerText = peso !== '--' ? `${peso}kg` : '--';

  const prevIMC = document.getElementById('previewAthleteIMC');
  if (prevIMC) prevIMC.innerText = imc;

  const prevRepName = document.getElementById('previewRepName');
  if (prevRepName) prevRepName.innerText = rep;

  const prevRepRole = document.getElementById('previewRepRole');
  if (prevRepRole) prevRepRole.innerText = parentesco;

  // Medical Alert Box in Preview
  const medBox = document.getElementById('previewMedAlertBox');
  const medText = document.getElementById('previewMedText');
  const hasAlert = isMedicalAlert(salud);
  if (medBox && medText) {
    medText.innerText = salud || 'Sin novedades médicas';
    medBox.classList.toggle('safe', !hasAlert);
    const iconSpan = medBox.querySelector('.med-icon');
    if (iconSpan) iconSpan.innerText = hasAlert ? '⚠️' : '🩺';
    const titleH5 = medBox.querySelector('.med-info h5');
    if (titleH5) titleH5.innerText = hasAlert ? 'Alerta Médica' : 'Condición Médica';
  }
}

// Photo Uploader Setup
function setupPhotoUploader() {
  const dropBox = document.getElementById('photoDropBox');
  const fileInput = document.getElementById('regFotoInput');
  const previewImg = document.getElementById('regPhotoThumb');
  const livePreviewAvatar = document.getElementById('previewAthleteAvatar');

  if (!dropBox || !fileInput) return;

  function handleFile(file) {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        state.activePhotoData = e.target.result;
        if (previewImg) {
          previewImg.src = e.target.result;
          previewImg.style.display = 'block';
        }
        if (livePreviewAvatar) {
          livePreviewAvatar.src = e.target.result;
        }
        showToast('Foto cargada correctamente');
      };
      reader.readAsDataURL(file);
    }
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  dropBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropBox.classList.add('dragover');
  });

  dropBox.addEventListener('dragleave', () => {
    dropBox.classList.remove('dragover');
  });

  dropBox.addEventListener('drop', (e) => {
    e.preventDefault();
    dropBox.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
}

// Generate Next Athlete ID
function generateNextAthleteId() {
  let maxNum = 0;
  state.athletes.forEach(a => {
    const match = (a.id || '').match(/ATL-(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  const nextNum = maxNum + 1;
  return `ATL-${String(nextNum).padStart(3, '0')}`;
}

// Handle Form Submit
async function handleRegisterSubmit(e) {
  e.preventDefault();

  const nombres = document.getElementById('regNombres').value.trim();
  const apellidos = document.getElementById('regApellidos').value.trim();
  const cedula = document.getElementById('regCedula').value.trim();
  const fechaNac = document.getElementById('regFechaNac').value;
  const peso = parseFloat(document.getElementById('regPeso').value) || 0;
  const estatura = parseFloat(document.getElementById('regEstatura').value) || 0;
  const posicion = document.getElementById('regPosicion').value;
  const categoria = document.getElementById('regCategoria').value;
  const dorsal = document.getElementById('regDorsal').value.trim() || 'S/N';
  const tipoSangre = document.getElementById('regTipoSangre').value;
  const salud = document.getElementById('regSalud').value.trim() || 'Sin novedades médicas';
  const representante = document.getElementById('regRepresentante').value.trim();
  const parentesco = document.getElementById('regParentesco').value;
  const telefonoRep = document.getElementById('regTelefonoRep').value.trim();
  const telefonoEmergencia = document.getElementById('regTelefonoEmergencia').value.trim() || telefonoRep;
  const direccion = document.getElementById('regDireccion').value.trim() || 'Caripito, Edo. Monagas';

  // Calculate age
  let edad = 0;
  if (fechaNac) {
    const birthDate = new Date(fechaNac);
    const today = new Date();
    edad = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) edad--;
  }

  // Calculate IMC
  let imc = 0;
  if (peso > 0 && estatura > 0.5) {
    imc = parseFloat((peso / (estatura * estatura)).toFixed(1));
  }

  // Default Photo if none chosen
  let foto = state.activePhotoData;
  if (!foto) {
    const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
    foto = randomAvatar;
  }

  const newId = generateNextAthleteId();
  const todayStr = new Date().toISOString().split('T')[0];

  const newAthlete = {
    id: newId,
    fechaIngreso: todayStr,
    nombres,
    apellidos,
    cedula,
    fechaNac,
    edad,
    peso,
    estatura,
    imc,
    salud,
    tipoSangre,
    posicion,
    categoria,
    dorsal,
    representante,
    parentesco,
    telefonoRep,
    telefonoEmergencia,
    direccion,
    foto,
    estatus: 'Activo'
  };

  // Add to state and cloud database
  if (window.ABCSupabase) {
    await window.ABCSupabase.insertAthlete(newAthlete);
  }
  state.athletes.unshift(newAthlete);
  state.selectedAthleteId = newId;
  saveAthletes();

  // Reset form
  document.getElementById('athleteRegisterForm').reset();
  state.activePhotoData = null;
  const previewImg = document.getElementById('regPhotoThumb');
  if (previewImg) previewImg.style.display = 'none';

  // Update UI
  renderAll();

  // Open Success Modal
  openSuccessModal(newAthlete);
}

// Success Modal
function openSuccessModal(athlete) {
  const modal = document.getElementById('modalSuccess');
  if (!modal) return;

  document.getElementById('successAthleteName').innerText = `${athlete.nombres} ${athlete.apellidos}`;
  document.getElementById('successAthleteId').innerText = athlete.id;

  // WhatsApp confirmation message
  const waMsg = encodeURIComponent(
    `🏀 *ACADEMIA DE BALONCESTO CARIPITO (ABC)*\n` +
    `✅ *Registro Exitoso de Atleta*\n\n` +
    `👤 *Atleta:* ${athlete.nombres} ${athlete.apellidos}\n` +
    `🆔 *ID Asignado:* ${athlete.id}\n` +
    `📄 *Cédula / Doc:* ${athlete.cedula}\n` +
    `🎂 *Edad:* ${athlete.edad} años | *Cat:* ${athlete.categoria}\n` +
    `⚕️ *Salud:* ${athlete.salud}\n` +
    `👨‍👧 *Representante:* ${athlete.representante} (${athlete.parentesco})\n` +
    `📞 *Contacto:* ${athlete.telefonoRep}\n\n` +
    `¡Bienvenido a la familia ABC Caripito!`
  );

  const cleanPhone = (athlete.telefonoRep || '').replace(/\D/g, '');
  const waLink = document.getElementById('btnSuccessWhatsApp');
  if (waLink) {
    waLink.href = `https://wa.me/?text=${waMsg}`;
  }

  modal.classList.add('active');
}

// Open Share Link & QR Modal with Dynamic Host & Automatic LAN Wi-Fi Detection
function generateQrCode(url) {
  const qrContainer = document.getElementById('qrCodeContainer');
  if (qrContainer) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}&color=050811&bgcolor=ffffff&qzone=1`;
    qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR Registro Representante" style="width:200px;height:200px;border-radius:12px;display:block;margin:0 auto;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />`;
  }
}

async function openShareModal() {
  const modal = document.getElementById('modalShare');
  if (!modal) return;

  const input = document.getElementById('shareLinkInput');
  const wifiHint = document.getElementById('shareWifiHint');

  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const cleanPath = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '');
  let defaultUrl = `${window.location.origin}${cleanPath}/?view=registro`;
  
  if (input) input.value = defaultUrl;
  generateQrCode(defaultUrl);
  modal.classList.add('active');

  // Si está desplegado en la nube pública (GitHub Pages, Vercel, Netlify, Render, dominio real)
  if (!isLocalHost) {
    if (wifiHint) {
      wifiHint.style.display = 'block';
      wifiHint.innerHTML = `🌐 <strong>Enlace en Producción Online:</strong> Los representantes pueden acceder desde cualquier teléfono o lugar mediante este enlace o código QR.`;
    }
    return;
  }

  // Si está en entorno de desarrollo local, consultar IP Wi-Fi
  try {
    const res = await fetch('/api/ip');
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip && data.ip !== '127.0.0.1') {
        const portStr = data.port && data.port !== 80 ? `:${data.port}` : '';
        const lanUrl = `http://${data.ip}${portStr}/?view=registro`;

        if (input) {
          input.value = lanUrl;
        }
        generateQrCode(lanUrl);

        if (wifiHint) {
          wifiHint.style.display = 'block';
          wifiHint.innerHTML = `📡 <strong>IP Wi-Fi Detectada:</strong> <code>${data.ip}</code> (Puerto ${data.port || 3000})<br/><span style="font-size:0.75rem;color:#93c5fd;">✓ Código QR y enlace generados con la IP local de tu PC para conexión instantánea desde teléfonos móviles.</span>`;
        }
        return;
      }
    }
  } catch (err) {
    console.log('Local IP endpoint not available, using dynamic client host', err);
  }

  // Client-side fallback hint
  if (wifiHint) {
    wifiHint.style.display = 'block';
    wifiHint.innerHTML = `💡 <strong>Consejo para celulares en red Wi-Fi:</strong> Puedes escribir o pegar la IP local de tu PC en la casilla de arriba para actualizar el QR automáticamente.`;
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// Render Master Table
function renderTable() {
  const tbody = document.getElementById('athletesTableBody');
  if (!tbody) return;

  let filtered = state.athletes.filter(a => {
    const fullName = `${a.nombres} ${a.apellidos}`.toLowerCase();
    const doc = (a.cedula || '').toLowerCase();
    const id = (a.id || '').toLowerCase();
    const rep = (a.representante || '').toLowerCase();

    const matchesSearch = !state.searchQuery || 
      fullName.includes(state.searchQuery) ||
      doc.includes(state.searchQuery) ||
      id.includes(state.searchQuery) ||
      rep.includes(state.searchQuery);

    const matchesCat = state.filterCategory === 'all' || a.categoria === state.filterCategory;
    
    const matchesStatus = state.filterStatus === 'all' || 
      (a.estatus || 'Activo').toLowerCase() === state.filterStatus.toLowerCase();

    let matchesHealth = true;
    if (state.filterHealth === 'alert') {
      matchesHealth = isMedicalAlert(a.salud);
    } else if (state.filterHealth === 'clean') {
      matchesHealth = !isMedicalAlert(a.salud);
    }

    return matchesSearch && matchesCat && matchesStatus && matchesHealth;
  });

  updateResetButtonVisibility();
  updateKpiCardHighlight();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: 2.5rem; color: var(--abc-silver-muted);">
          🏀 No se encontraron atletas con los filtros seleccionados.
          <br>
          <button class="btn-action-outline" onclick="resetAllFilters()" style="margin-top:1rem;font-size:0.8rem;">
            🔄 Restablecer Todos los Filtros
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const hasAlert = isMedicalAlert(a.salud);
    const healthBadge = hasAlert 
      ? `<span style="color:#f87171;font-weight:700;font-size:0.85rem;">⚠️ ${a.salud}</span>`
      : `<span style="color:#34d399;font-weight:600;font-size:0.85rem;">✓ ${a.salud && a.salud.trim() ? a.salud : 'Normal'}</span>`;

    const statusVal = a.estatus || 'Activo';
    let statusClass = 'activo';
    if (statusVal.toLowerCase().includes('evaluación') || statusVal.toLowerCase().includes('evaluacion')) {
      statusClass = 'evaluacion';
    } else if (statusVal.toLowerCase().includes('inactivo') || statusVal.toLowerCase().includes('lesionado')) {
      statusClass = 'inactivo';
    }

    const cleanPhone = (a.telefonoRep || '').replace(/\D/g, '');
    const waUrl = cleanPhone ? `https://wa.me/58${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}` : '#';

    return `
      <tr>
        <td><strong style="color:var(--abc-cyan-bright);font-family:monospace;">${a.id}</strong></td>
        <td>
          <div class="athlete-cell-profile">
            <img src="${a.foto || DEFAULT_AVATARS[0]}" class="athlete-cell-thumb" alt="${a.nombres}" />
            <div>
              <div class="athlete-cell-name">${a.nombres} ${a.apellidos} ${a.dorsal ? `<span style="color:var(--abc-orange-bright);font-weight:800;">#${a.dorsal}</span>` : ''}</div>
              <div class="athlete-cell-doc">${a.cedula} • ${a.edad} años</div>
            </div>
          </div>
        </td>
        <td><span class="badge-status activo">${a.categoria || 'U-18'}</span></td>
        <td><strong>${a.estatura || '--'} m</strong> / ${a.peso || '--'} kg</td>
        <td><span class="badge-imc">${a.imc || '--'}</span></td>
        <td>${healthBadge}</td>
        <td>
          <div style="font-weight:700;color:#fff;">${a.representante}</div>
          <div style="font-size:0.75rem;color:var(--abc-silver-muted);">${a.parentesco} • ${a.telefonoRep}</div>
        </td>
        <td><span class="badge-status ${statusClass}">${statusVal}</span></td>
        <td>
          <div class="cell-actions">
            <button class="btn-icon-action" title="Ver Ficha Oficial" onclick="viewAthleteFicha('${a.id}')">
              📄
            </button>
            <button class="btn-icon-action edit" title="Editar Atleta" onclick="openEditAthleteModal('${a.id}')">
              ✏️
            </button>
            <a href="${waUrl}" target="_blank" class="btn-icon-action wa" style="color:#25d366;" title="Enviar WhatsApp">
              💬
            </a>
            <button class="btn-icon-action delete" title="Eliminar Atleta" onclick="deleteAthlete('${a.id}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Pro Athlete Cards Grid
function renderCardsGrid() {
  const container = document.getElementById('cardsGridLayout');
  if (!container) return;

  let filtered = state.athletes.filter(a => {
    const fullName = `${a.nombres} ${a.apellidos}`.toLowerCase();
    const matchesSearch = !state.searchQuery || fullName.includes(state.searchQuery) || a.id.toLowerCase().includes(state.searchQuery);
    const matchesCat = state.filterCategory === 'all' || a.categoria === state.filterCategory;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--abc-silver-muted);">No hay fichas que coincidan con la búsqueda.</div>`;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const hasAlert = isMedicalAlert(a.salud);
    const cleanPhone = (a.telefonoRep || '').replace(/\D/g, '');
    const waUrl = cleanPhone ? `https://wa.me/58${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}` : '#';

    return `
      <div class="athlete-pro-card">
        <div class="card-banner">
          <div class="card-banner-brand">
            <img src="${window.APP_LOGO_B64 || 'assets/logo.jpg'}" class="card-banner-logo" alt="Logo ABC" />
            <span class="card-banner-text">ABC CARIPITO</span>
          </div>
          <span class="card-id-badge">${a.id}</span>
        </div>
        
        <div class="card-main-body">
          <div class="athlete-avatar-wrapper">
            <img src="${a.foto || DEFAULT_AVATARS[0]}" class="athlete-avatar-img" alt="${a.nombres}" />
            <div class="athlete-dorsal-tag">${a.dorsal || '🏀'}</div>
          </div>
          
          <h3 class="athlete-name">${a.nombres} ${a.apellidos}</h3>
          <span class="athlete-position-tag">${a.posicion || 'Atleta ABC'} • ${a.categoria || 'U-18'}</span>
          
          <div class="stats-grid-compact">
            <div class="stat-box-mini">
              <span class="val">${a.edad}</span>
              <span class="lbl">Años</span>
            </div>
            <div class="stat-box-mini">
              <span class="val">${a.estatura}m</span>
              <span class="lbl">Estatura</span>
            </div>
            <div class="stat-box-mini">
              <span class="val">${a.peso}kg</span>
              <span class="lbl">Peso</span>
            </div>
          </div>
          
          <div class="medical-alert-box ${hasAlert ? '' : 'safe'}">
            <span class="med-icon">${hasAlert ? '⚠️' : '🩺'}</span>
            <div class="med-info">
              <h5>${hasAlert ? 'Alerta Médica' : 'Condición Médica'}</h5>
              <p>${a.salud || 'Sin novedades médicas'}</p>
            </div>
          </div>
          
          <div class="card-rep-footer">
            <div class="rep-summary">
              <div class="rep-role">${a.parentesco}:</div>
              <div class="rep-name">${a.representante}</div>
            </div>
            
            <div class="contact-quick-btns">
              <a href="tel:${a.telefonoRep}" class="btn-quick-call" title="Llamar">📞</a>
              <a href="${waUrl}" target="_blank" class="btn-quick-wa" title="WhatsApp">💬</a>
              <button onclick="viewAthleteFicha('${a.id}')" class="btn-icon-action" title="Ficha Completa">📄</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Ficha Oficial
function renderFichaOficial() {
  const container = document.getElementById('fichaOfficialContainer');
  const select = document.getElementById('fichaAthleteSelect');
  if (!container) return;

  // Populate Select if empty
  if (select) {
    select.innerHTML = state.athletes.map(a => `
      <option value="${a.id}" ${a.id === state.selectedAthleteId ? 'selected' : ''}>
        ${a.id} - ${a.nombres} ${a.apellidos} (${a.categoria || 'U-18'})
      </option>
    `).join('');
  }

  const athlete = state.athletes.find(a => a.id === state.selectedAthleteId) || state.athletes[0];
  if (!athlete) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;">No hay atletas registrados.</div>`;
    return;
  }

  const hasAlert = isMedicalAlert(athlete.salud);

  container.innerHTML = `
    <div class="ficha-official-card" id="printableFicha">
      <div class="ficha-doc-header">
        <div class="ficha-header-logo-group">
          <img src="${window.APP_LOGO_B64 || 'assets/logo.jpg'}" class="ficha-header-logo" alt="Logo ABC" />
          <div class="ficha-header-text">
            <h2>ACADEMIA DE BALONCESTO CARIPITO (ABC)</h2>
            <p>FICHA TÉCNICA E INDIVIDUAL DEL ATLETA • TEMPORADA 2025-2026</p>
          </div>
        </div>
        <div class="ficha-code-badge">
          <span class="code">${athlete.id}</span>
          <div class="status">● ESTATUS: ${athlete.estatus || 'ACTIVO'}</div>
        </div>
      </div>

      <div class="ficha-doc-body">
        <div class="ficha-portrait-col">
          <img src="${athlete.foto || DEFAULT_AVATARS[0]}" class="ficha-portrait-img" alt="${athlete.nombres}" />
          <span class="ficha-dorsal-tag">DORSAL #${athlete.dorsal || '00'}</span>
          <div style="font-size:0.8rem;color:#64748b;font-weight:700;text-align:center;">
            Categoría: <strong>${athlete.categoria || 'U-18'}</strong><br/>
            Posición: <strong>${athlete.posicion || 'Formativo'}</strong>
          </div>
        </div>

        <div class="ficha-data-col">
          <div>
            <div class="ficha-section-title">👤 Datos de Identificación Personal</div>
            <div class="ficha-fields-row">
              <div class="ficha-field-item">
                <div class="label">Nombres Completos</div>
                <div class="value">${athlete.nombres}</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Apellidos</div>
                <div class="value">${athlete.apellidos}</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Cédula / Documento</div>
                <div class="value">${athlete.cedula}</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Fecha Nacimiento</div>
                <div class="value">${athlete.fechaNac || '--'} (${athlete.edad} años)</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Fecha de Ingreso</div>
                <div class="value">${athlete.fechaIngreso || '2025-01-15'}</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Tipo de Sangre</div>
                <div class="value">${athlete.tipoSangre || 'O+'}</div>
              </div>
            </div>
          </div>

          <div>
            <div class="ficha-section-title">📊 Perfil Físico & Antropométrico</div>
            <div class="ficha-fields-row">
              <div class="ficha-field-item">
                <div class="label">Estatura</div>
                <div class="value">${athlete.estatura} metros</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Peso Corporal</div>
                <div class="value">${athlete.peso} kg</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Índice Masa Corporal (IMC)</div>
                <div class="value">${athlete.imc}</div>
              </div>
            </div>

            <div class="ficha-health-highlight ${hasAlert ? '' : 'clean'}">
              <h4>${hasAlert ? '⚠️ Alerta Médica / Alergias' : '✓ Condición Médica y Salud'}</h4>
              <p>${athlete.salud || 'Sin novedades médicas registradas'}</p>
            </div>
          </div>

          <div>
            <div class="ficha-section-title">👨‍👩‍👧 Representante Legal y Contacto de Emergencia</div>
            <div class="ficha-fields-row">
              <div class="ficha-field-item">
                <div class="label">Nombre Representante</div>
                <div class="value">${athlete.representante}</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Parentesco</div>
                <div class="value">${athlete.parentesco}</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Teléfono Representante</div>
                <div class="value">${athlete.telefonoRep}</div>
              </div>
              <div class="ficha-field-item">
                <div class="label">Contacto de Emergencia</div>
                <div class="value">${athlete.telefonoEmergencia || athlete.telefonoRep}</div>
              </div>
              <div class="ficha-field-item" style="grid-column: 1 / -1;">
                <div class="label">Dirección / Residencia</div>
                <div class="value">${athlete.direccion || 'Caripito, Estado Monagas'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="ficha-signatures-footer">
        <div class="signature-line">
          Firma del Representante Legal
        </div>
        <div class="signature-line">
          Dirección Técnica / Entrenador ABC
        </div>
      </div>
    </div>
  `;
}

// Actions & Modals
window.handleKpiClick = function(type) {
  if (state.isRepresentativeMode) return; // Read-only mode for representatives

  if (type === 'total') {
    // Tarjeta "Atletas Registrados": elimina todos los filtros y muestra el total
    resetAllFilters(false);
    state.activeKpiFilter = 'total';
    updateKpiCardHighlight();
    switchView('base-datos');
    showToast('📊 Mostrando todos los atletas (filtros restablecidos)');
  } else if (type === 'active') {
    // Tarjeta "Atletas Activos": filtra únicamente atletas con estatus ACTIVO
    state.filterStatus = 'Activo';
    state.activeKpiFilter = 'active';
    const statusSelect = document.getElementById('filterStatus');
    if (statusSelect) statusSelect.value = 'Activo';
    updateKpiCardHighlight();
    updateResetButtonVisibility();
    switchView('base-datos');
    renderTable();
    showToast('⚡ Filtrando atletas con estatus ACTIVO');
  } else if (type === 'health') {
    // Tarjeta "Alertas Médicas": filtra únicamente atletas con condición médica diferente a sin novedades
    state.filterHealth = 'alert';
    state.activeKpiFilter = 'health';
    const healthSelect = document.getElementById('filterHealth');
    if (healthSelect) healthSelect.value = 'alert';
    updateKpiCardHighlight();
    updateResetButtonVisibility();
    switchView('base-datos');
    renderTable();
    showToast('⚠️ Filtrando atletas con Alertas Médicas o Alergias');
  } else if (type === 'height') {
    // Tarjeta "Estatura Promedio": modal con desglose completo
    openHeightBreakdownModal();
  }
};

window.openHeightBreakdownModal = function() {
  if (state.isRepresentativeMode) return; // Prohibido en modo representante
  const modal = document.getElementById('modalHeightBreakdown');
  if (!modal) return;

  const validAthletes = state.athletes.filter(a => parseFloat(a.estatura) > 0);
  const totalCount = validAthletes.length;

  if (totalCount === 0) {
    showToast('No hay datos suficientes de estatura para generar el desglose');
    return;
  }

  // Calculate Avg, Min, Max
  const heights = validAthletes.map(a => ({
    height: parseFloat(a.estatura),
    name: `${a.nombres} ${a.apellidos}`,
    categoria: a.categoria || 'U-18',
    dorsal: a.dorsal || ''
  }));

  const sum = heights.reduce((acc, h) => acc + h.height, 0);
  const avg = (sum / totalCount).toFixed(2);

  // Min and Max
  let minObj = heights[0];
  let maxObj = heights[0];
  heights.forEach(h => {
    if (h.height < minObj.height) minObj = h;
    if (h.height > maxObj.height) maxObj = h;
  });

  // Populate elements
  const elAvg = document.getElementById('hbAvgHeight');
  if (elAvg) elAvg.innerText = `${avg.replace('.', ',')} m`;

  const elMax = document.getElementById('hbMaxHeight');
  if (elMax) elMax.innerText = `${maxObj ? maxObj.height.toFixed(2).replace('.', ',') : '--'} m`;

  const elMaxAthlete = document.getElementById('hbMaxAthlete');
  if (elMaxAthlete) elMaxAthlete.innerText = `${maxObj.name} (${maxObj.categoria})`;

  const elMin = document.getElementById('hbMinHeight');
  if (elMin) elMin.innerText = `${minObj ? minObj.height.toFixed(2).replace('.', ',') : '--'} m`;

  const elMinAthlete = document.getElementById('hbMinAthlete');
  if (elMinAthlete) elMinAthlete.innerText = `${minObj.name} (${minObj.categoria})`;

  const elTotal = document.getElementById('hbTotalAthletes');
  if (elTotal) elTotal.innerText = totalCount;

  // Breakdown by Category
  const catMap = {};
  validAthletes.forEach(a => {
    const cat = a.categoria || 'U-18';
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(parseFloat(a.estatura));
  });

  const catContainer = document.getElementById('hbCategoryList');
  if (catContainer) {
    const categories = Object.keys(catMap).sort();
    catContainer.innerHTML = categories.map(cat => {
      const arr = catMap[cat];
      const catAvg = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
      const minCat = Math.min(...arr).toFixed(2);
      const maxCat = Math.max(...arr).toFixed(2);
      return `
        <div class="height-cat-row">
          <div class="height-cat-name-badge">
            <span class="badge-status activo">${cat}</span>
            <span style="font-size:0.85rem;color:var(--abc-silver-muted);">${arr.length} atleta(s)</span>
          </div>
          <div class="height-cat-stats">
            <div class="height-cat-stat-item">
              <span class="lbl">Promedio</span>
              <strong class="val">${catAvg.replace('.', ',')} m</strong>
            </div>
            <div class="height-cat-stat-item">
              <span class="lbl">Rango (Mín / Máx)</span>
              <span class="val-sub">${minCat.replace('.', ',')} m - ${maxCat.replace('.', ',')} m</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('active');
};

window.openEditAthleteModal = function(id) {
  if (state.isRepresentativeMode) return; // Prohibido editar en modo representante
  const athlete = state.athletes.find(a => a.id === id);
  if (!athlete) return;

  const modal = document.getElementById('modalEditAthlete');
  if (!modal) return;

  document.getElementById('editAthleteId').value = athlete.id;
  document.getElementById('editModalTitle').innerText = `Editar Atleta - ${athlete.id}`;
  document.getElementById('editModalSubtitle').innerText = `${athlete.nombres} ${athlete.apellidos} • ${athlete.categoria || 'U-18'}`;

  document.getElementById('editNombres').value = athlete.nombres || '';
  document.getElementById('editApellidos').value = athlete.apellidos || '';
  document.getElementById('editCedula').value = athlete.cedula || '';
  document.getElementById('editFechaNac').value = athlete.fechaNac || '';
  document.getElementById('editEdad').value = athlete.edad || '';
  document.getElementById('editDorsal').value = athlete.dorsal || '';
  document.getElementById('editEstatura').value = athlete.estatura || '';
  document.getElementById('editPeso').value = athlete.peso || '';
  document.getElementById('editCategoria').value = athlete.categoria || 'U-18';
  document.getElementById('editPosicion').value = athlete.posicion || 'Base / Armador';
  document.getElementById('editTipoSangre').value = athlete.tipoSangre || 'O+';
  document.getElementById('editEstatus').value = athlete.estatus || 'Activo';
  document.getElementById('editSalud').value = athlete.salud || 'Sin novedades médicas';
  document.getElementById('editRepresentante').value = athlete.representante || '';
  document.getElementById('editParentesco').value = athlete.parentesco || 'Padre';
  document.getElementById('editTelefonoRep').value = athlete.telefonoRep || '';
  document.getElementById('editTelefonoEmergencia').value = athlete.telefonoEmergencia || '';
  document.getElementById('editDireccion').value = athlete.direccion || '';

  // Trigger recalculations for IMC and Age badges
  const peso = parseFloat(athlete.peso || 0);
  const estatura = parseFloat(athlete.estatura || 0);
  const imcBadge = document.getElementById('editImcCalculado');
  if (imcBadge) {
    if (peso > 0 && estatura > 0.5) {
      const imc = (peso / (estatura * estatura)).toFixed(1);
      imcBadge.innerText = `IMC: ${imc}`;
    } else {
      imcBadge.innerText = 'IMC: --';
    }
  }

  const edadBadge = document.getElementById('editEdadCalculada');
  if (edadBadge) {
    edadBadge.innerText = athlete.edad ? `${athlete.edad} años` : '--';
  }

  modal.classList.add('active');
};

async function handleEditFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editAthleteId').value;
  const index = state.athletes.findIndex(a => a.id === id);
  if (index === -1) return;

  const estatura = parseFloat(document.getElementById('editEstatura').value) || 0;
  const peso = parseFloat(document.getElementById('editPeso').value) || 0;
  let imc = '--';
  if (peso > 0 && estatura > 0.5) {
    imc = (peso / (estatura * estatura)).toFixed(1);
  }

  const updatedAthlete = {
    ...state.athletes[index],
    nombres: document.getElementById('editNombres').value.trim(),
    apellidos: document.getElementById('editApellidos').value.trim(),
    cedula: document.getElementById('editCedula').value.trim(),
    fechaNac: document.getElementById('editFechaNac').value,
    edad: parseInt(document.getElementById('editEdad').value) || state.athletes[index].edad,
    dorsal: document.getElementById('editDorsal').value.trim(),
    estatura: estatura,
    peso: peso,
    imc: imc,
    categoria: document.getElementById('editCategoria').value,
    posicion: document.getElementById('editPosicion').value,
    tipoSangre: document.getElementById('editTipoSangre').value,
    estatus: document.getElementById('editEstatus').value,
    salud: document.getElementById('editSalud').value.trim(),
    representante: document.getElementById('editRepresentante').value.trim(),
    parentesco: document.getElementById('editParentesco').value,
    telefonoRep: document.getElementById('editTelefonoRep').value.trim(),
    telefonoEmergencia: document.getElementById('editTelefonoEmergencia').value.trim(),
    direccion: document.getElementById('editDireccion').value.trim()
  };

  if (window.ABCSupabase) {
    await window.ABCSupabase.updateAthlete(id, updatedAthlete);
  }
  state.athletes[index] = updatedAthlete;
  saveAthletes();
  renderAll();
  closeAllModals();
  showToast(`✅ Atleta ${updatedAthlete.id} (${updatedAthlete.nombres}) actualizado con éxito`);
}

window.resetAllFilters = function(notify = true) {
  state.searchQuery = '';
  state.filterCategory = 'all';
  state.filterStatus = 'all';
  state.filterHealth = 'all';
  state.activeKpiFilter = null;

  const searchInput = document.getElementById('tableSearchInput');
  if (searchInput) searchInput.value = '';

  const catSelect = document.getElementById('filterCategory');
  if (catSelect) catSelect.value = 'all';

  const statSelect = document.getElementById('filterStatus');
  if (statSelect) statSelect.value = 'all';

  const healthSelect = document.getElementById('filterHealth');
  if (healthSelect) healthSelect.value = 'all';

  updateKpiCardHighlight();
  updateResetButtonVisibility();
  renderTable();
  renderCardsGrid();

  if (notify) {
    showToast('🔄 Todos los filtros han sido restablecidos');
  }
};

function updateResetButtonVisibility() {
  const btn = document.getElementById('btnResetFilters');
  if (!btn) return;
  const isFiltered = state.searchQuery || state.filterCategory !== 'all' || state.filterStatus !== 'all' || state.filterHealth !== 'all';
  btn.style.display = isFiltered ? 'inline-flex' : 'none';
}

function updateKpiCardHighlight() {
  document.querySelectorAll('.stat-card-interactive').forEach(card => {
    card.classList.remove('active-kpi-filter');
  });

  if (state.activeKpiFilter === 'total') {
    document.getElementById('kpiCardTotal')?.classList.add('active-kpi-filter');
  } else if (state.activeKpiFilter === 'active' || state.filterStatus === 'Activo') {
    document.getElementById('kpiCardActive')?.classList.add('active-kpi-filter');
  } else if (state.activeKpiFilter === 'health' || state.filterHealth === 'alert') {
    document.getElementById('kpiCardHealth')?.classList.add('active-kpi-filter');
  }
}

window.viewAthleteFicha = function(id) {
  if (state.isRepresentativeMode) return; // Prohibido consultar ficha de otros en modo representante
  state.selectedAthleteId = id;
  switchView('ficha-oficial');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteAthlete = async function(id) {
  if (state.isRepresentativeMode) return; // Prohibido eliminar en modo representante
  if (confirm(`¿Estás seguro de eliminar el registro del atleta ${id}?`)) {
    if (window.ABCSupabase) {
      await window.ABCSupabase.deleteAthlete(id);
    }
    state.athletes = state.athletes.filter(a => a.id !== id);
    saveAthletes();
    renderAll();
    showToast(`Atleta ${id} eliminado correctamente`);
  }
};

window.resetRegisterForm = function() {
  const form = document.getElementById('athleteRegisterForm');
  if (form) form.reset();
  state.activePhotoData = null;
  const previewImg = document.getElementById('regPhotoThumb');
  if (previewImg) previewImg.style.display = 'none';
  const ageBadge = document.getElementById('regEdadCalculada');
  if (ageBadge) ageBadge.innerText = '-- años';
  const imcBadge = document.getElementById('regImcCalculado');
  if (imcBadge) imcBadge.innerText = 'IMC: --';
  updateCardPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.printCurrentFicha = function() {
  window.print();
};

window.exportDatabaseToExcel = function() {
  if (state.isRepresentativeMode) return; // Prohibido exportar en modo representante
  // Generate CSV with exact original Excel headers
  const headers = [
    'ID Atleta', 'Fecha Ingreso', 'Nombres', 'Apellidos', 'Cédula / Doc',
    'Fecha Nac.', 'Edad', 'Peso (kg)', 'Estatura (m)', 'IMC',
    'Situación de Salud / Alergias', 'Nombre Representante', 'Parentesco',
    'Teléfono Rep.', 'Teléfono Emergencia', 'Ruta / Nombre Foto', 'Estatus'
  ];

  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += headers.join(';') + '\r\n';

  state.athletes.forEach(a => {
    const row = [
      `"${a.id}"`,
      `"${a.fechaIngreso || ''}"`,
      `"${a.nombres}"`,
      `"${a.apellidos}"`,
      `"${a.cedula}"`,
      `"${a.fechaNac || ''}"`,
      `"${a.edad}"`,
      `"${a.peso}"`,
      `"${a.estatura}"`,
      `"${a.imc}"`,
      `"${a.salud || 'Sin novedades'}"`,
      `"${a.representante}"`,
      `"${a.parentesco}"`,
      `"${a.telefonoRep}"`,
      `"${a.telefonoEmergencia || a.telefonoRep}"`,
      `"${a.id.toLowerCase()}.jpg"`,
      `"${a.estatus || 'Activo'}"`
    ];
    csvContent += row.join(';') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ABC_Caripito_Control_Atletas_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Base de datos exportada en formato compatible con Excel');
};

function renderAll() {
  updateStats();
  renderTable();
  renderCardsGrid();
  renderFichaOficial();
  updateCardPreview();
}

function showToast(msg) {
  const toast = document.getElementById('appToast');
  if (toast) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}
