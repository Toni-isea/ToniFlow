// ToniFlow - Sincronización en Tiempo Real con Firebase Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get, goOffline, goOnline } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

// Configuración de Firebase Realtime Database
const firebaseConfig = {
  apiKey: "AIzaSyDReGWCIiXY26FzXCWr8OGxsrckoI1yEfI",
  authDomain: "toniflow-4fd07.firebaseapp.com",
  databaseURL: "https://toniflow-4fd07-default-rtdb.firebaseio.com",
  projectId: "toniflow-4fd07",
  storageBucket: "toniflow-4fd07.firebasestorage.app",
  messagingSenderId: "1057807867591",
  appId: "1:1057807867591:web:a8a6b11fd53b5e644f68e2"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

const KEY = 'toniflow_v2';
const RTDB_NODE = 'fitflow';

// Definición de las 4 categorías obligatorias
const CATEGORIES = {
  Push: {
    label: 'Push',
    desc: 'Ejercicios de empuje: pectoral, hombros y tríceps.'
  },
  Pull: {
    label: 'Pull',
    desc: 'Ejercicios de tracción: espalda, bíceps y deltoides posterior.'
  },
  Legs: {
    label: 'Legs',
    desc: 'Ejercicios de piernas: cuádriceps, isquiotibiales, glúteos y gemelos.'
  },
  Core: {
    label: 'Core',
    desc: 'Ejercicios de zona media: abdomen superior, inferior y lumbares.'
  }
};

// Inferencia automática para datos existentes sin categoría
function inferCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('sentadilla') || n.includes('squat') || n.includes('zancada') || n.includes('lunge') || n.includes('pierna') || n.includes('gemelo') || n.includes('glúteo')) {
    return 'Legs';
  }
  if (n.includes('plancha') || n.includes('plank') || n.includes('abdom') || n.includes('core') || n.includes('crunch') || n.includes('lumbar')) {
    return 'Core';
  }
  if (n.includes('dominada') || n.includes('remo') || n.includes('pull') || n.includes('biceps') || n.includes('bíceps') || n.includes('espalda') || n.includes('jalón')) {
    return 'Pull';
  }
  return 'Push';
}

// Datos predeterminados con categorías obligatorias
const defaults = {
  exercises: [
    {
      id: 1,
      name: 'Flexiones de pecho (Push-ups)',
      category: 'Push',
      duration: 45,
      image: 'https://images.unsplash.com/photo-1598971639058-a7f5c5f5c4e4?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 2,
      name: 'Sentadillas (Squats)',
      category: 'Legs',
      duration: 60,
      image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 3,
      name: 'Plancha abdominal (Plank)',
      category: 'Core',
      duration: 45,
      image: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 4,
      name: 'Zancadas alternas (Lunges)',
      category: 'Legs',
      duration: 50,
      image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80'
    },
    {
      id: 5,
      name: 'Fondos de tríceps',
      category: 'Push',
      duration: 40,
      image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&auto=format&fit=crop&q=80'
    }
  ],
  routines: [
    {
      id: 1,
      name: 'Rutina Completa Full-Body',
      items: [
        { exerciseId: 1, sets: 3, reps: '12' },
        { exerciseId: 2, sets: 3, reps: '15' },
        { exerciseId: 3, sets: 3, reps: '45s' }
      ]
    },
    {
      id: 2,
      name: 'Tren Superior Express',
      items: [
        { exerciseId: 1, sets: 4, reps: '10' },
        { exerciseId: 5, sets: 3, reps: '12' }
      ]
    }
  ],
  settings: {
    prepImageUrl: '',
    restBetweenSetsImageUrl: '',
    restBetweenExercisesImageUrl: ''
  }
};

// Normalizar datos de Firebase Realtime Database
function normalizeData(val) {
  if (!val) {
    return {
      exercises: [],
      routines: [],
      settings: { prepImageUrl: '', restBetweenSetsImageUrl: '', restBetweenExercisesImageUrl: '' }
    };
  }
  
  let exercises = [];
  if (Array.isArray(val.exercises)) {
    exercises = val.exercises.filter(Boolean);
  } else if (val.exercises && typeof val.exercises === 'object') {
    exercises = Object.values(val.exercises).filter(Boolean);
  }

  // Garantizar que todo ejercicio tenga una categoría válida asignada
  exercises.forEach(e => {
    if (!e.category || !CATEGORIES[e.category]) {
      e.category = inferCategory(e.name);
    }
  });

  let routines = [];
  if (Array.isArray(val.routines)) {
    routines = val.routines.filter(Boolean);
  } else if (val.routines && typeof val.routines === 'object') {
    routines = Object.values(val.routines).filter(Boolean);
  }

  routines.forEach(r => {
    if (!r.items) {
      r.items = [];
    } else if (!Array.isArray(r.items)) {
      r.items = Object.values(r.items).filter(Boolean);
    } else {
      r.items = r.items.filter(Boolean);
    }

    // Los ítems de superserie guardan exerciseIds/reps como arrays; Firebase Realtime Database
    // puede convertir arrays dispersos en objetos, así que se normalizan defensivamente acá.
    // Los ítems sin "type" (rutinas creadas antes de esta función) se siguen tratando como 'single'.
    r.items.forEach(item => {
      if (item.type === 'superset') {
        if (!Array.isArray(item.exerciseIds)) {
          item.exerciseIds = item.exerciseIds ? Object.values(item.exerciseIds).filter(Boolean) : [];
        }
        if (!Array.isArray(item.reps)) {
          item.reps = item.reps ? Object.values(item.reps) : [];
        }
      }
    });
  });

  // Configuración general de la app: imágenes globales de preparación y descanso
  // (se migra automáticamente el antiguo campo único "restImageUrl" si existía)
  const settings = {
    prepImageUrl: (val.settings && val.settings.prepImageUrl) || '',
    restBetweenSetsImageUrl: (val.settings && val.settings.restBetweenSetsImageUrl) || '',
    restBetweenExercisesImageUrl: (val.settings && (val.settings.restBetweenExercisesImageUrl || val.settings.restImageUrl)) || ''
  };

  return { exercises, routines, settings };
}

// Carga inicial desde caché local mientras se conecta con Firebase
let localCache = null;
try {
  localCache = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('fitflow_v2') || 'null');
} catch (e) {
  console.warn('Error leyendo caché local', e);
}

let db = normalizeData(localCache || defaults);

// Indicador visual de estado de sincronización en tiempo real
const syncBadge = document.getElementById('syncBadge');
const syncText = document.getElementById('syncText');
function setSyncStatus(status, text) {
  if (syncBadge && syncText) {
    syncBadge.className = `sync-badge ${status}`;
    syncText.textContent = text;
  }
}

// Escuchar estado de conexión de Firebase
const connectedRef = ref(rtdb, '.info/connected');
onValue(connectedRef, (snap) => {
  if (snap.val() === true) {
    setSyncStatus('online', 'En tiempo real');
  } else {
    setSyncStatus('offline', 'Sin conexión');
  }
});

// ==========================================
// RECONEXIÓN FORZADA DEL WEBSOCKET (Android PWA/APK)
// ==========================================
// Nota técnica: Firebase Realtime Database NO tiene una función equivalente a
// enableIndexedDbPersistence() (esa API es exclusiva de Firestore). En RTDB, el problema
// real en Android es que el sistema operativo suele pausar/congelar el WebSocket cuando la
// PWA queda en segundo plano (pestaña oculta, app minimizada, o restaurada desde la caché
// de retroceso del navegador). El propio SDK reconecta solo, pero puede tardar varios
// segundos en notarlo. Forzamos un ciclo goOffline()/goOnline() apenas la app vuelve a
// primer plano para que el WebSocket se reestablezca de inmediato.
function forceFirebaseReconnect() {
  goOffline(rtdb);
  goOnline(rtdb);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    forceFirebaseReconnect();
  }
});

window.addEventListener('online', forceFirebaseReconnect);

// Cuando el navegador restaura la página desde la bfcache (común al volver de otra app en Android)
window.addEventListener('pageshow', (e) => {
  if (e.persisted) forceFirebaseReconnect();
});

// Guarda una copia local de todos los datos (rutinas, ejercicios y configuración).
// Es la base del comportamiento "offline first": si Firebase falla, esta copia
// es la que se usa para no perder nunca la información ingresada por el usuario.
//
// Si localStorage se queda sin espacio (QuotaExceededError, típico cuando se acumulan
// muchas imágenes en Base64), se reintenta guardando una versión liviana SIN las imágenes
// de los ejercicios, para que el respaldo local nunca deje de funcionar. Ese recorte se
// hace sobre una COPIA de los datos, nunca sobre el objeto "db" en memoria: las imágenes
// jamás se pierden ni se borran de Firebase, solo se omiten puntualmente de este respaldo.
function persistLocalCache() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      console.warn('localStorage sin espacio: se reintenta el respaldo local sin las imágenes de los ejercicios.');
      try {
        const lightweightDb = {
          ...db,
          exercises: (db.exercises || []).map(exercise => ({ ...exercise, image: '' }))
        };
        localStorage.setItem(KEY, JSON.stringify(lightweightDb));
        showToast('⚠️ Poco espacio local: se respaldaron tus rutinas y ejercicios sin las imágenes');
        return true;
      } catch (retryErr) {
        console.error('No se pudo guardar ni siquiera la copia local reducida:', retryErr);
        return false;
      }
    }
    console.error('Error guardando copia local en localStorage:', err);
    return false;
  }
}

// Guardar en Firebase Realtime Database (se sincroniza inmediatamente en todos los dispositivos).
// El envío a Firebase se dispara de inmediato y NO espera al guardado local: persistLocalCache()
// corre en paralelo, así el respaldo en disco nunca demora ni bloquea la sincronización en tiempo real.
async function save() {
  setSyncStatus('saving', 'Sincronizando...');

  const firebaseSave = set(ref(rtdb, RTDB_NODE), db)
    .then(() => {
      setSyncStatus('online', 'En tiempo real');
    })
    .catch((err) => {
      console.error('Error guardando en Firebase:', err);
      setSyncStatus('offline', 'Guardado localmente (sin conexión)');
      showToast('⚠️ Sin conexión: tus cambios se guardaron en este dispositivo y se sincronizarán al reconectar');
    });

  // Respaldo local en paralelo (no se espera antes de disparar el guardado en Firebase)
  persistLocalCache();

  await firebaseSave;
}

// Referencias a pantallas
const screens = {
  home: document.getElementById('home'),
  exerciseManager: document.getElementById('exerciseManager'),
  exerciseEditor: document.getElementById('exerciseEditor'),
  routineEditor: document.getElementById('routineEditor'),
  workout: document.getElementById('workout')
};

function show(name) {
  Object.values(screens).forEach(s => s && s.classList.remove('active'));
  if (screens[name]) {
    screens[name].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Botones de navegación genéricos "Volver"
document.querySelectorAll('.back').forEach(btn => {
  btn.onclick = () => {
    const target = btn.dataset.target || 'home';
    show(target);
  };
});

// Toast de notificación
const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2500);
}

// Helper para buscar ejercicio por ID
const ex = id => db.exercises.find(e => e.id === Number(id));

// ==========================================
// HELPERS DE ÍTEMS DE RUTINA (ejercicio individual o bloque de superserie)
// ==========================================
// Un ítem sin "type" (rutinas creadas antes de esta función) se trata como 'single'.

function isValidRoutineItem(item) {
  if (!item) return false;
  if (item.type === 'superset') {
    return (item.exerciseIds || []).some(id => ex(id));
  }
  return !!ex(item.exerciseId);
}

// Nombre a mostrar para un ítem (usado en la pantalla de descanso entre ejercicios/bloques)
function routineItemLabel(item) {
  if (item.type === 'superset') {
    const names = (item.exerciseIds || []).map(id => (ex(id) || {}).name).filter(Boolean);
    return names.length ? `Superserie: ${names.join(' + ')}` : 'Superserie';
  }
  const exercise = ex(item.exerciseId);
  return exercise ? exercise.name : 'Siguiente ejercicio';
}

// Duración de UNA vuelta completa de superserie: suma de cada ejercicio + descansos cortos
// entre ellos (no incluye el descanso largo entre vueltas, que se cuenta aparte)
function supersetRoundSeconds(item) {
  const exerciseIds = item.exerciseIds || [];
  const n = exerciseIds.length;
  const restShort = item.restBetweenExercises != null ? item.restBetweenExercises : 15;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const exercise = ex(exerciseIds[i]);
    total += exercise ? (exercise.duration || 45) : 0;
    if (i < n - 1) total += restShort;
  }
  return total;
}

// Duración total estimada de un bloque de superserie completo (todas sus vueltas)
function supersetFullDurationSeconds(item) {
  const rounds = item.rounds || 1;
  const restLong = item.restBetweenRounds != null ? item.restBetweenRounds : 90;
  const perRound = supersetRoundSeconds(item);
  return perRound * rounds + restLong * Math.max(rounds - 1, 0);
}

// Duración total estimada de un ítem de rutina (ejercicio individual o bloque de superserie)
function itemDurationSeconds(item) {
  if (item.type === 'superset') {
    return supersetFullDurationSeconds(item);
  }
  const exercise = ex(item.exerciseId);
  if (!exercise) return 0;
  const sets = item.sets || 1;
  return (exercise.duration || 45) * sets + (exercise.restBetweenSetsSeconds || 45) * Math.max(sets - 1, 0);
}

// ========================================================
// ESCUCHA EN TIEMPO REAL (Firebase Realtime Database)
// ========================================================
const fitflowRef = ref(rtdb, RTDB_NODE);
let isFirstLoad = true;

onValue(fitflowRef, (snapshot) => {
  setSyncStatus('online', 'En tiempo real');
  if (snapshot.exists()) {
    db = normalizeData(snapshot.val());
    persistLocalCache();
  } else {
    console.log('Sembrando datos iniciales en Firebase Realtime Database...');
    db = JSON.parse(JSON.stringify(defaults));
    save();
  }

  // El refresco de la interfaz se difiere al próximo frame para que el callback de Firebase
  // retorne de inmediato y no bloquee el hilo principal (ni la propia conexión WebSocket).
  requestAnimationFrame(() => {
    refreshActiveScreen();
  });

  if (isFirstLoad) {
    isFirstLoad = false;
  } else {
    showToast('🔄 Datos sincronizados');
  }
}, (error) => {
  console.error('Error de lectura en Firebase:', error);
  setSyncStatus('offline', 'Error de conexión');
});

function refreshActiveScreen() {
  renderHome();
  if (screens.exerciseManager && screens.exerciseManager.classList.contains('active')) {
    renderExercises();
  }
  if (screens.routineEditor && screens.routineEditor.classList.contains('active')) {
    if (db.routines[currentRoutineIndex]) {
      drawRoutine();
    } else {
      show('home');
    }
  }
}

// ==========================================
// PANTALLA 1: RUTINAS (HOME)
// ==========================================
const routineList = document.getElementById('routineList');
const newRoutineBtn = document.getElementById('newRoutine');
const manageExercisesBtn = document.getElementById('manageExercises');
const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');

function renderHome() {
  if (!routineList) return;
  routineList.innerHTML = '';

  if (db.routines.length === 0) {
    routineList.innerHTML = `
      <div class="empty-state">
        <p>No tienes rutinas creadas todavía.</p>
        <p>Haz clic en <b>"+ Nueva rutina"</b> para comenzar.</p>
      </div>
    `;
    return;
  }

  db.routines.forEach((routine, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    
    // Miniaturas de los ejercicios de la rutina
    const previewThumbs = (routine.items || [])
      .slice(0, 4)
      .map(item => {
        // Para una superserie se muestra la miniatura de su primer ejercicio válido
        const previewId = item.type === 'superset'
          ? (item.exerciseIds || []).find(id => ex(id))
          : item.exerciseId;
        const exercise = ex(previewId);
        if (!exercise) return '';
        if (exercise.image) {
          return `<img src="${exercise.image}" alt="${exercise.name}" style="width:28px; height:28px; border-radius:6px; object-fit:cover; border:1px solid #1a3158;" onerror="this.style.display='none'">`;
        }
        return `<span style="display:inline-flex; width:28px; height:28px; border-radius:6px; background:#10234a; align-items:center; justify-content:center; font-size:12px;">🏋</span>`;
      })
      .filter(Boolean)
      .join('');

    card.innerHTML = `
      <div class="card-row">
        <div>
          <h3 style="font-size: 18px; margin-bottom: 4px;">${routine.name}</h3>
          <p style="font-size: 13px; color: var(--soft);">${(routine.items || []).length} ejercicios</p>
        </div>
        <div style="display:flex; gap:4px; align-items:center;">
          ${previewThumbs}
        </div>
      </div>
      <div class="actions-group">
        <button class="primary" style="margin-top:0;" onclick="startWorkout(${index})">▶ Comenzar</button>
        <button class="btn-outline" onclick="editRoutine(${index})">✏ Editar</button>
        <button class="btn-danger btn-small" title="Eliminar rutina" onclick="deleteRoutine(${index})">🗑</button>
      </div>
    `;
    routineList.appendChild(card);
  });
}

newRoutineBtn.onclick = () => {
  const newR = {
    id: Date.now(),
    name: 'Nueva rutina personalizada',
    items: [],
    prepSeconds: 10,
    exerciseRestSeconds: 90
  };
  db.routines.push(newR);
  save();
  editRoutine(db.routines.length - 1);
};

manageExercisesBtn.onclick = () => {
  renderExercises();
  show('exerciseManager');
};

// Botón de recarga: SOLO vuelve a consultar Firebase para refrescar la interfaz.
// Nunca escribe ni reemplaza datos (no borra rutinas ni ejercicios del usuario).
if (resetDefaultsBtn) {
  resetDefaultsBtn.onclick = async () => {
    setSyncStatus('saving', 'Actualizando...');
    try {
      const snapshot = await get(fitflowRef);
      if (snapshot.exists()) {
        db = normalizeData(snapshot.val());
        persistLocalCache();
      }
      refreshActiveScreen();
      setSyncStatus('online', 'En tiempo real');
      showToast('🔄 Datos actualizados');
    } catch (err) {
      console.error('Error al actualizar datos desde Firebase:', err);
      setSyncStatus('offline', 'Sin conexión (usando datos locales)');
      showToast('⚠️ Sin conexión: mostrando tus datos guardados localmente');
    }
  };
}

function deleteRoutine(index) {
  const routine = db.routines[index];
  if (!routine) return;
  if (confirm(`¿Eliminar la rutina "${routine.name}"? Se actualizará en todos tus dispositivos.`)) {
    db.routines.splice(index, 1);
    save();
    renderHome();
    showToast('Rutina eliminada');
  }
}

// ==========================================
// CONFIGURACIÓN GENERAL (imágenes globales de preparación y descanso)
// ==========================================
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Cada entrada conecta un campo del modal con su clave correspondiente en db.settings
const SETTINGS_IMAGE_FIELDS = [
  {
    key: 'prepImageUrl',
    input: document.getElementById('prepImageInput'),
    preview: document.getElementById('prepImagePreview'),
    placeholder: document.getElementById('prepImagePlaceholder'),
    fileInput: document.getElementById('prepImageFileInput'),
    clearBtn: document.getElementById('prepImageClearBtn'),
    data: ''
  },
  {
    key: 'restBetweenSetsImageUrl',
    input: document.getElementById('restBetweenSetsImageInput'),
    preview: document.getElementById('restBetweenSetsImagePreview'),
    placeholder: document.getElementById('restBetweenSetsImagePlaceholder'),
    fileInput: document.getElementById('restBetweenSetsImageFileInput'),
    clearBtn: document.getElementById('restBetweenSetsImageClearBtn'),
    data: ''
  },
  {
    key: 'restBetweenExercisesImageUrl',
    input: document.getElementById('restBetweenExercisesImageInput'),
    preview: document.getElementById('restBetweenExercisesImagePreview'),
    placeholder: document.getElementById('restBetweenExercisesImagePlaceholder'),
    fileInput: document.getElementById('restBetweenExercisesImageFileInput'),
    clearBtn: document.getElementById('restBetweenExercisesImageClearBtn'),
    data: ''
  }
];

function updateSettingsImagePreview(url, previewEl, placeholderEl) {
  if (!previewEl || !placeholderEl) return;
  if (url) {
    previewEl.src = url;
    previewEl.style.display = 'block';
    placeholderEl.style.display = 'none';
  } else {
    previewEl.src = '';
    previewEl.style.display = 'none';
    placeholderEl.style.display = 'block';
  }
}

// Refleja el valor actual del campo (URL escrita o imagen subida) en su vista previa y botón "Quitar"
function setSettingsFieldData(field, value) {
  field.data = value || '';
  updateSettingsImagePreview(field.data, field.preview, field.placeholder);
  if (field.clearBtn) field.clearBtn.style.display = field.data ? 'inline-flex' : 'none';
}

function openSettings() {
  if (!settingsModal) return;
  SETTINGS_IMAGE_FIELDS.forEach(field => {
    const url = db.settings[field.key] || '';
    if (field.input) field.input.value = !url.startsWith('data:') ? url : '';
    if (field.fileInput) field.fileInput.value = '';
    setSettingsFieldData(field, url);
  });
  settingsModal.classList.add('active');
}

function closeSettings() {
  if (settingsModal) settingsModal.classList.remove('active');
}

if (openSettingsBtn) openSettingsBtn.onclick = openSettings;
if (closeSettingsBtn) closeSettingsBtn.onclick = closeSettings;
if (settingsModal) {
  settingsModal.onclick = (e) => {
    if (e.target === settingsModal) closeSettings();
  };
}

SETTINGS_IMAGE_FIELDS.forEach(field => {
  if (field.input) {
    field.input.oninput = () => setSettingsFieldData(field, field.input.value.trim());
  }

  if (field.fileInput) {
    field.fileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (file.size > 8 * 1024 * 1024) {
        alert('El archivo supera los 8MB. Selecciona uno más pequeño o usa una URL directa.');
        field.fileInput.value = '';
        return;
      }

      showToast('Cargando y optimizando imagen...');
      try {
        const dataUrl = await processImageFile(file);
        if (!dataUrl) {
          showToast('⚠️ La imagen sigue pesando demasiado incluso comprimida. Probá con otra o usá una URL directa.');
          field.fileInput.value = '';
          return;
        }
        if (field.input) field.input.value = '';
        setSettingsFieldData(field, dataUrl);
        showToast('Imagen lista para guardar');
      } catch (err) {
        console.error('Error procesando imagen', err);
        showToast('Error al procesar archivo');
      }
    };
  }

  if (field.clearBtn) {
    field.clearBtn.onclick = () => {
      if (field.input) field.input.value = '';
      if (field.fileInput) field.fileInput.value = '';
      setSettingsFieldData(field, '');
    };
  }
});

if (saveSettingsBtn) {
  saveSettingsBtn.onclick = async () => {
    SETTINGS_IMAGE_FIELDS.forEach(field => {
      db.settings[field.key] = field.data || '';
    });
    await save();
    showToast('Configuración guardada');
    closeSettings();
  };
}

// ==========================================
// PANTALLA 2 & 3: CATÁLOGO Y FILTROS POR CATEGORÍA
// ==========================================
const exerciseList = document.getElementById('exerciseList');
const newExerciseBtn = document.getElementById('newExercise');
const cancelExerciseBtn = document.getElementById('cancelExerciseBtn');
const cancelExerciseBtn2 = document.getElementById('cancelExerciseBtn2');
const saveExerciseBtn = document.getElementById('saveExerciseBtn');
const exerciseEditorTitle = document.getElementById('exerciseEditorTitle');

const exNameInput = document.getElementById('exNameInput');
const exCategorySelect = document.getElementById('exCategorySelect');
const categoryHint = document.getElementById('categoryHint');
const exDurationInput = document.getElementById('exDurationInput');
const exRestBetweenSetsInput = document.getElementById('exRestBetweenSetsInput');
const exImageInput = document.getElementById('exImageInput');
const exFileInput = document.getElementById('exFileInput');
const exImagePreview = document.getElementById('exImagePreview');
const exImagePlaceholder = document.getElementById('exImagePlaceholder');
const clearImageBtn = document.getElementById('clearImageBtn');

const categoryFilterBar = document.getElementById('categoryFilterBar');
let currentCatalogFilter = 'all';

// Configurar botones de filtro rápido
if (categoryFilterBar) {
  categoryFilterBar.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
      categoryFilterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCatalogFilter = chip.dataset.cat || 'all';
      renderExercises();
    };
  });
}

function updateCatalogFilterCounts() {
  const total = db.exercises.length;
  const pushCount = db.exercises.filter(e => e.category === 'Push').length;
  const pullCount = db.exercises.filter(e => e.category === 'Pull').length;
  const legsCount = db.exercises.filter(e => e.category === 'Legs').length;
  const coreCount = db.exercises.filter(e => e.category === 'Core').length;

  const cAll = document.getElementById('count-all');
  const cPush = document.getElementById('count-Push');
  const cPull = document.getElementById('count-Pull');
  const cLegs = document.getElementById('count-Legs');
  const cCore = document.getElementById('count-Core');

  if (cAll) cAll.textContent = total;
  if (cPush) cPush.textContent = pushCount;
  if (cPull) cPull.textContent = pullCount;
  if (cLegs) cLegs.textContent = legsCount;
  if (cCore) cCore.textContent = coreCount;
}

let currentExerciseIndex = -1;
let currentExerciseImageData = '';

function renderExercises() {
  if (!exerciseList) return;
  updateCatalogFilterCounts();
  exerciseList.innerHTML = '';

  const filteredExercises = db.exercises.filter(e => {
    if (currentCatalogFilter === 'all') return true;
    return e.category === currentCatalogFilter;
  });

  if (filteredExercises.length === 0) {
    exerciseList.innerHTML = `
      <div class="empty-state">
        <p>No hay ejercicios en la categoría <b>${currentCatalogFilter === 'all' ? 'general' : currentCatalogFilter}</b>.</p>
        <p>Haz clic en <b>"+ Nuevo ejercicio"</b> para añadir uno.</p>
      </div>
    `;
    return;
  }

  filteredExercises.forEach((item) => {
    const originalIndex = db.exercises.findIndex(e => e.id === item.id);
    const card = document.createElement('div');
    card.className = 'card';

    const thumbHtml = item.image
      ? `<div class="exercise-thumb"><img src="${item.image}" alt="${item.name}" onerror="this.parentElement.innerHTML='🏋'"></div>`
      : `<div class="exercise-thumb">🏋</div>`;

    const catBadge = `<span class="cat-badge ${item.category || 'Push'}">${item.category || 'Push'}</span>`;

    card.innerHTML = `
      <div class="exercise-item">
        ${thumbHtml}
        <div class="exercise-info">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            ${catBadge}
          </div>
          <b>${item.name}</b>
          <p>⏱ ${item.duration}s por serie</p>
        </div>
      </div>
      <div class="actions-group">
        <button class="btn-outline" onclick="openExerciseEditor(${originalIndex})">✏ Editar</button>
        <button class="btn-danger btn-small" onclick="deleteExercise(${originalIndex})">🗑 Borrar</button>
      </div>
    `;
    exerciseList.appendChild(card);
  });
}

function updateImagePreview(src) {
  currentExerciseImageData = src || '';
  if (currentExerciseImageData) {
    exImagePreview.src = currentExerciseImageData;
    exImagePreview.style.display = 'block';
    exImagePlaceholder.style.display = 'none';
    clearImageBtn.style.display = 'inline-flex';
  } else {
    exImagePreview.src = '';
    exImagePreview.style.display = 'none';
    exImagePlaceholder.style.display = 'block';
    clearImageBtn.style.display = 'none';
  }
}

exImageInput.oninput = () => {
  updateImagePreview(exImageInput.value.trim());
};

// Optimización de imágenes subidas: se redimensionan a un máximo de 250x250px y se comprimen
// a calidad 0.3 en JPEG. Si aun así el resultado supera 20KB, se descarta (string vacío) en
// vez de guardarla, para no volver a saturar localStorage ni el nodo de Firebase.
const MAX_IMAGE_DATA_URL_BYTES = 20 * 1024; // 20KB

function processImageFile(file, maxDimension = 250, quality = 0.3) {
  return new Promise((resolve, reject) => {
    // Los GIF no se pueden recomprimir en canvas sin perder la animación: se leen tal cual,
    // pero igual quedan sujetos al mismo límite de 20KB una vez codificados en Base64.
    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        if (dataUrl.length > MAX_IMAGE_DATA_URL_BYTES) {
          console.warn(`GIF descartado: pesa ${(dataUrl.length / 1024).toFixed(1)}KB, supera el límite de 20KB.`);
          resolve('');
        } else {
          resolve(dataUrl);
        }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        if (dataUrl.length > MAX_IMAGE_DATA_URL_BYTES) {
          console.warn(`Imagen descartada: pesa ${(dataUrl.length / 1024).toFixed(1)}KB tras comprimir, supera el límite de 20KB.`);
          resolve('');
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(''); // Si falla el canvas, se descarta en vez de arriesgar un archivo pesado
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

exFileInput.onchange = async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    alert('El archivo supera los 8MB. Selecciona uno más pequeño o usa una URL directa.');
    exFileInput.value = '';
    return;
  }

  showToast('Cargando y optimizando imagen...');
  try {
    const dataUrl = await processImageFile(file);
    if (!dataUrl) {
      showToast('⚠️ La imagen sigue pesando demasiado incluso comprimida. Probá con otra o usá una URL directa.');
      exFileInput.value = '';
      return;
    }
    exImageInput.value = '';
    updateImagePreview(dataUrl);
    showToast('Imagen lista para guardar');
  } catch (err) {
    console.error('Error procesando imagen', err);
    showToast('Error al procesar archivo');
  }
};

clearImageBtn.onclick = () => {
  exImageInput.value = '';
  exFileInput.value = '';
  updateImagePreview('');
};

function updateCategoryHint(cat) {
  if (categoryHint && CATEGORIES[cat]) {
    categoryHint.textContent = CATEGORIES[cat].desc;
  }
}

if (exCategorySelect) {
  exCategorySelect.onchange = () => {
    updateCategoryHint(exCategorySelect.value);
  };
}

newExerciseBtn.onclick = () => {
  openExerciseEditor(-1);
};

function openExerciseEditor(index) {
  currentExerciseIndex = index;
  exFileInput.value = '';

  if (index >= 0) {
    const e = db.exercises[index];
    exerciseEditorTitle.textContent = 'Editar ejercicio';
    exNameInput.value = e.name || '';
    exCategorySelect.value = e.category || 'Push';
    updateCategoryHint(exCategorySelect.value);
    exDurationInput.value = e.duration || 45;
    exRestBetweenSetsInput.value = e.restBetweenSetsSeconds || 45;
    exImageInput.value = e.image && !e.image.startsWith('data:') ? e.image : '';
    updateImagePreview(e.image || '');
  } else {
    exerciseEditorTitle.textContent = 'Nuevo ejercicio';
    exNameInput.value = '';
    // Preseleccionar según el filtro activo si no es 'all'
    const defaultCat = currentCatalogFilter !== 'all' ? currentCatalogFilter : 'Push';
    exCategorySelect.value = defaultCat;
    updateCategoryHint(defaultCat);
    exDurationInput.value = 45;
    exRestBetweenSetsInput.value = 45;
    exImageInput.value = '';
    updateImagePreview('');
  }

  show('exerciseEditor');
}

function cancelExerciseEdit() {
  renderExercises();
  show('exerciseManager');
}
cancelExerciseBtn.onclick = cancelExerciseEdit;
cancelExerciseBtn2.onclick = cancelExerciseEdit;

// Guardar ejercicio con validación de categoría obligatoria
saveExerciseBtn.onclick = async () => {
  const name = exNameInput.value.trim();
  const category = exCategorySelect.value;
  const duration = parseInt(exDurationInput.value, 10);
  const restBetweenSets = parseInt(exRestBetweenSetsInput.value, 10) || 45;

  if (!name) {
    alert('Por favor ingresa un nombre para el ejercicio.');
    exNameInput.focus();
    return;
  }

  if (!category || !CATEGORIES[category]) {
    alert('Por favor selecciona una categoría válida (Push, Pull, Legs o Core).');
    exCategorySelect.focus();
    return;
  }

  if (isNaN(duration) || duration <= 0) {
    alert('Por favor ingresa una duración válida en segundos (mayor a 0).');
    exDurationInput.focus();
    return;
  }

  let finalImage = currentExerciseImageData;
  if (exImageInput.value.trim() && !finalImage.startsWith('data:')) {
    finalImage = exImageInput.value.trim();
  }

  if (currentExerciseIndex >= 0) {
    const e = db.exercises[currentExerciseIndex];
    e.name = name;
    e.category = category;
    e.duration = duration;
    e.restBetweenSetsSeconds = restBetweenSets;
    e.image = finalImage;
    showToast('Actualizando ejercicio en Firebase...');
  } else {
    const newEx = {
      id: Date.now(),
      name: name,
      category: category,
      duration: duration,
      restBetweenSetsSeconds: restBetweenSets,
      image: finalImage
    };
    db.exercises.push(newEx);
    showToast('Guardando ejercicio en Firebase...');
  }

  await save();
  renderExercises();
  renderHome();
  show('exerciseManager');
};

// Eliminar ejercicio del catálogo
function deleteExercise(index) {
  const item = db.exercises[index];
  if (!item) return;

  const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar "${item.name}" del catálogo? Se borrará de todos tus dispositivos.`);
  if (!confirmDelete) return;

  // Eliminar de las rutinas existentes
  db.routines.forEach(r => {
    r.items = (r.items || []).filter(it => {
      if (it.type === 'superset') {
        // Se quita el ejercicio del bloque (y sus reps); si el bloque queda vacío, se elimina
        const idx = (it.exerciseIds || []).indexOf(item.id);
        if (idx !== -1) {
          it.exerciseIds.splice(idx, 1);
          if (Array.isArray(it.reps)) it.reps.splice(idx, 1);
        }
        return it.exerciseIds.length > 0;
      }
      return it.exerciseId !== item.id;
    });
  });

  db.exercises.splice(index, 1);
  save();
  renderExercises();
  renderHome();
  showToast('Ejercicio eliminado');
}

// ==========================================
// PANTALLA 4: EDITOR DE RUTINA
// ==========================================
let currentRoutineIndex = 0;
const routineNameInput = document.getElementById('routineName');
const routinePrepSecondsInput = document.getElementById('routinePrepSeconds');
const routineExerciseRestSecondsInput = document.getElementById('routineExerciseRestSeconds');
const routineExercisesList = document.getElementById('routineExercises');
const routineExerciseCount = document.getElementById('routineExerciseCount');
const addToRoutineBtn = document.getElementById('addToRoutine');

// Lee/escribe el tiempo de preparación inicial y el descanso entre ejercicios de la rutina
function saveRoutineExtras(routine) {
  const prep = parseInt(routinePrepSecondsInput.value, 10);
  routine.prepSeconds = isNaN(prep) || prep < 0 ? 10 : prep;
  routine.exerciseRestSeconds = parseInt(routineExerciseRestSecondsInput.value, 10) || 90;
}

function loadRoutineExtras(routine) {
  routinePrepSecondsInput.value = routine.prepSeconds != null ? routine.prepSeconds : 10;
  routineExerciseRestSecondsInput.value = routine.exerciseRestSeconds || 90;
}

function editRoutine(index) {
  currentRoutineIndex = index;
  const routine = db.routines[currentRoutineIndex];
  if (!routine) return;

  routineNameInput.value = routine.name;
  loadRoutineExtras(routine);
  drawRoutine();
  show('routineEditor');
}

let routineDebounceTimer = null;
routineNameInput.oninput = () => {
  if (db.routines[currentRoutineIndex]) {
    db.routines[currentRoutineIndex].name = routineNameInput.value;
    clearTimeout(routineDebounceTimer);
    routineDebounceTimer = setTimeout(() => {
      save();
      renderHome();
    }, 400);
  }
};

let routineExtrasDebounceTimer = null;
function handleRoutineExtrasChange() {
  const routine = db.routines[currentRoutineIndex];
  if (!routine) return;
  saveRoutineExtras(routine);
  clearTimeout(routineExtrasDebounceTimer);
  routineExtrasDebounceTimer = setTimeout(() => save(), 400);
}
routinePrepSecondsInput.oninput = handleRoutineExtrasChange;
routineExerciseRestSecondsInput.oninput = handleRoutineExtrasChange;

function drawRoutine() {
  if (!routineExercisesList) return;
  routineExercisesList.innerHTML = '';
  const routine = db.routines[currentRoutineIndex];
  if (!routine) return;

  const items = routine.items || [];
  const supersetCount = items.filter(it => it.type === 'superset').length;
  const totalExercises = items.reduce((sum, it) => sum + (it.type === 'superset' ? (it.exerciseIds || []).length : 1), 0);
  routineExerciseCount.textContent = `${totalExercises} ${totalExercises === 1 ? 'ejercicio' : 'ejercicios'}` +
    (supersetCount ? ` • ${supersetCount} ${supersetCount === 1 ? 'superserie' : 'superseries'}` : '');

  if (items.length === 0) {
    routineExercisesList.innerHTML = `
      <div class="empty-state">
        <p>Esta rutina no tiene ejercicios todavía.</p>
        <p>Haz clic en <b>"+ Agregar ejercicios"</b> para elegirlos de tu catálogo visual.</p>
      </div>
    `;
    return;
  }

  items.forEach((item, itemIndex) => {
    // Bloque de superserie / triserie: tarjeta propia con sus 3 parámetros de descanso/vueltas
    if (item.type === 'superset') {
      routineExercisesList.appendChild(buildSupersetCard(item, itemIndex));
      return;
    }

    const exercise = ex(item.exerciseId);
    if (!exercise) return;

    const card = document.createElement('div');
    card.className = 'routine-exercise-card';

    const thumbHtml = exercise.image
      ? `<div class="routine-exercise-thumb"><img src="${exercise.image}" alt="${exercise.name}" onerror="this.parentElement.innerHTML='🏋'"></div>`
      : `<div class="routine-exercise-thumb">🏋</div>`;

    const catBadge = `<span class="cat-badge ${exercise.category || 'Push'}" style="font-size:10px; padding:2px 6px;">${exercise.category || 'Push'}</span>`;

    card.innerHTML = `
      <div class="routine-exercise-header">
        ${thumbHtml}
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
            ${catBadge}
          </div>
          <h4 style="font-size:15px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${exercise.name}</h4>
          <span style="font-size:12px; color:var(--soft);">⏱ ${exercise.duration}s por serie</span>
        </div>
      </div>
      <div class="routine-inputs-row">
        <label>
          Series
          <input type="number" min="1" max="20" value="${item.sets || 3}" class="input-sets">
        </label>
        <label>
          Reps / Tiempo
          <input type="text" value="${item.reps || '10'}" placeholder="Ej: 12 reps" class="input-reps">
        </label>
        <button class="btn-danger btn-small" style="height:42px;" onclick="removeRoutineItem(${itemIndex})" title="Quitar de la rutina">Quitar</button>
      </div>
    `;

    const setsInput = card.querySelector('.input-sets');
    const repsInput = card.querySelector('.input-reps');

    setsInput.onchange = () => {
      const val = parseInt(setsInput.value, 10);
      db.routines[currentRoutineIndex].items[itemIndex].sets = val > 0 ? val : 1;
      save();
    };

    let repsTimer = null;
    repsInput.oninput = () => {
      db.routines[currentRoutineIndex].items[itemIndex].reps = repsInput.value;
      clearTimeout(repsTimer);
      repsTimer = setTimeout(() => {
        save();
      }, 400);
    };

    routineExercisesList.appendChild(card);
  });
}

// Tarjeta del editor para un bloque de superserie / triserie
function buildSupersetCard(item, itemIndex) {
  const card = document.createElement('div');
  card.className = 'routine-exercise-card superset-card';

  const exerciseIds = item.exerciseIds || [];
  const label = exerciseIds.length >= 3 ? 'Triserie' : 'Superserie';

  const chipsHtml = exerciseIds.map((id, i) => {
    const exercise = ex(id);
    const name = exercise ? exercise.name : 'Ejercicio eliminado';
    const thumb = exercise && exercise.image
      ? `<div class="routine-exercise-thumb"><img src="${exercise.image}" alt="${name}" onerror="this.parentElement.innerHTML='🏋'"></div>`
      : `<div class="routine-exercise-thumb">🏋</div>`;
    return `${i > 0 ? '<span class="superset-connector">➜</span>' : ''}
      <div class="superset-exercise-chip">${thumb}<span>${name}</span></div>`;
  }).join('');

  const repsInputsHtml = exerciseIds.map((id, i) => {
    const exercise = ex(id);
    const reps = (Array.isArray(item.reps) && item.reps[i]) || '10';
    return `
      <label style="margin-bottom:0; font-size:12px;">
        Reps: ${exercise ? exercise.name : 'Ejercicio'}
        <input type="text" value="${reps}" class="input-superset-reps" data-idx="${i}" placeholder="Ej: 12 reps" style="margin-top:4px; padding:10px 12px; border-radius:12px; font-size:14px;">
      </label>`;
  }).join('');

  card.innerHTML = `
    <div class="superset-label">🔗 ${label} (${exerciseIds.length} ejercicios)</div>
    <div class="superset-exercises-row">${chipsHtml}</div>
    <div class="superset-inputs-row">
      <label>
        Vueltas
        <input type="number" min="1" max="20" value="${item.rounds || 3}" class="input-rounds">
      </label>
      <label>
        Desc. entre ejercicios (s)
        <input type="number" min="0" max="300" value="${item.restBetweenExercises != null ? item.restBetweenExercises : 15}" class="input-rest-short">
      </label>
      <label>
        Desc. entre vueltas (s)
        <input type="number" min="0" max="600" value="${item.restBetweenRounds != null ? item.restBetweenRounds : 90}" class="input-rest-long">
      </label>
    </div>
    <div style="display:grid; gap:10px; margin-top:10px;">${repsInputsHtml}</div>
    <div class="superset-remove-row">
      <button class="btn-danger btn-small" style="height:42px;" onclick="removeRoutineItem(${itemIndex})" title="Quitar bloque de la rutina">Quitar bloque</button>
    </div>
  `;

  const getItem = () => db.routines[currentRoutineIndex].items[itemIndex];

  const bindNumber = (selector, prop, min, fallback) => {
    const input = card.querySelector(selector);
    input.onchange = () => {
      const val = parseInt(input.value, 10);
      getItem()[prop] = isNaN(val) || val < min ? fallback : val;
      save();
    };
  };
  bindNumber('.input-rounds', 'rounds', 1, 1);
  bindNumber('.input-rest-short', 'restBetweenExercises', 0, 15);
  bindNumber('.input-rest-long', 'restBetweenRounds', 0, 90);

  let repsTimer = null;
  card.querySelectorAll('.input-superset-reps').forEach(input => {
    input.oninput = () => {
      const target = getItem();
      if (!Array.isArray(target.reps)) target.reps = [];
      target.reps[Number(input.dataset.idx)] = input.value;
      clearTimeout(repsTimer);
      repsTimer = setTimeout(() => save(), 400);
    };
  });

  return card;
}

function removeRoutineItem(itemIndex) {
  if (db.routines[currentRoutineIndex]) {
    db.routines[currentRoutineIndex].items.splice(itemIndex, 1);
    save();
    drawRoutine();
    renderHome();
    showToast('Ejercicio quitado');
  }
}

// =======================================================
// SELECCIÓN VISUAL DE EJERCICIOS (MODAL INTERACTIVO CON FILTROS)
// =======================================================
const exercisePickerModal = document.getElementById('exercisePickerModal');
const closePickerBtn = document.getElementById('closePickerBtn');
const pickerList = document.getElementById('pickerList');
const pickerSearchInput = document.getElementById('pickerSearchInput');
const confirmAddBtn = document.getElementById('confirmAddBtn');
const selectedPickerCount = document.getElementById('selectedPickerCount');
const modalCategoryFilterBar = document.getElementById('modalCategoryFilterBar');

let selectedExerciseIds = new Set(); // El Set conserva el orden de selección (A -> B -> C)
let modalCurrentFilter = 'all';
let pickerMode = 'single'; // 'single' (ejercicios sueltos) | 'superset' (bloque de 2-3 ejercicios)
const SUPERSET_MAX_EXERCISES = 3;
const SUPERSET_MIN_EXERCISES = 2;
const addSupersetBtn = document.getElementById('addSuperset');
const pickerModalTitle = document.getElementById('pickerModalTitle');
const pickerModalDesc = document.getElementById('pickerModalDesc');

if (modalCategoryFilterBar) {
  modalCategoryFilterBar.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
      modalCategoryFilterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      modalCurrentFilter = chip.dataset.cat || 'all';
      renderPickerList(pickerSearchInput.value.trim().toLowerCase());
    };
  });
}

addToRoutineBtn.onclick = () => {
  openExercisePicker('single');
};

if (addSupersetBtn) {
  addSupersetBtn.onclick = () => {
    openExercisePicker('superset');
  };
}

function openExercisePicker(mode = 'single') {
  pickerMode = mode;
  if (mode === 'superset') {
    pickerModalTitle.textContent = 'Armar superserie';
    pickerModalDesc.textContent = `Elige de ${SUPERSET_MIN_EXERCISES} a ${SUPERSET_MAX_EXERCISES} ejercicios, en el orden en que quieres hacerlos.`;
  } else {
    pickerModalTitle.textContent = 'Seleccionar ejercicios';
    pickerModalDesc.textContent = 'Selecciona los ejercicios que deseas incluir en tu rutina.';
  }
  selectedExerciseIds.clear();
  pickerSearchInput.value = '';
  modalCurrentFilter = 'all';
  if (modalCategoryFilterBar) {
    modalCategoryFilterBar.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.cat === 'all');
    });
  }
  updateSelectedCount();
  renderPickerList();
  exercisePickerModal.classList.add('active');
}

function closeExercisePicker() {
  exercisePickerModal.classList.remove('active');
}

closePickerBtn.onclick = closeExercisePicker;

exercisePickerModal.onclick = (e) => {
  if (e.target === exercisePickerModal) {
    closeExercisePicker();
  }
};

pickerSearchInput.oninput = () => {
  renderPickerList(pickerSearchInput.value.trim().toLowerCase());
};

function updateSelectedCount() {
  selectedPickerCount.textContent = selectedExerciseIds.size;
  // El texto del botón cambia según el modo (la cuenta va en el <span>, que se conserva)
  confirmAddBtn.firstChild.textContent = pickerMode === 'superset' ? 'Crear superserie (' : 'Añadir a la rutina (';
}

function renderPickerList(filterTerm = '') {
  pickerList.innerHTML = '';

  if (db.exercises.length === 0) {
    pickerList.innerHTML = `
      <div class="empty-state">
        <p>No tienes ejercicios creados en el catálogo.</p>
        <p>Crea ejercicios primero desde la sección "Catálogo de ejercicios".</p>
      </div>
    `;
    return;
  }

  const filtered = db.exercises.filter(e => {
    const matchesSearch = !filterTerm || e.name.toLowerCase().includes(filterTerm);
    const matchesCat = modalCurrentFilter === 'all' || e.category === modalCurrentFilter;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    pickerList.innerHTML = `
      <div class="empty-state">
        <p>No se encontraron ejercicios que coincidan con la búsqueda.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(exercise => {
    const isSelected = selectedExerciseIds.has(exercise.id);
    const item = document.createElement('div');
    item.className = `picker-item ${isSelected ? 'selected' : ''}`;

    const thumbHtml = exercise.image
      ? `<div class="picker-thumb"><img src="${exercise.image}" alt="${exercise.name}" onerror="this.parentElement.innerHTML='🏋'"></div>`
      : `<div class="picker-thumb">🏋</div>`;

    const catBadge = `<span class="cat-badge ${exercise.category || 'Push'}" style="font-size:10px; padding:2px 6px;">${exercise.category || 'Push'}</span>`;

    item.innerHTML = `
      <input type="checkbox" class="picker-checkbox" ${isSelected ? 'checked' : ''}>
      ${thumbHtml}
      <div class="picker-details">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
          ${catBadge}
        </div>
        <h4>${exercise.name}</h4>
        <span>⏱ Duración: ${exercise.duration}s</span>
      </div>
      <span class="picker-badge">${exercise.duration}s</span>
    `;

    // En modo superserie, una vez alcanzado el máximo los no seleccionados quedan inactivos
    const limitReached = pickerMode === 'superset' && selectedExerciseIds.size >= SUPERSET_MAX_EXERCISES;
    if (limitReached && !isSelected) {
      item.classList.add('picker-disabled');
    }

    const checkbox = item.querySelector('.picker-checkbox');

    const applySelection = (checked) => {
      if (checked) {
        selectedExerciseIds.add(exercise.id);
      } else {
        selectedExerciseIds.delete(exercise.id);
      }
      updateSelectedCount();

      if (pickerMode !== 'superset') {
        // Modo normal: alcanza con actualizar esta fila, sin repintar toda la lista
        checkbox.checked = checked;
        item.classList.toggle('selected', checked);
        return;
      }

      // Modo superserie: se repinta para reflejar el estado deshabilitado, conservando el scroll
      const scroller = pickerList.closest('.modal-content');
      const prevScroll = scroller ? scroller.scrollTop : 0;
      renderPickerList(pickerSearchInput.value.trim().toLowerCase());
      if (scroller) scroller.scrollTop = prevScroll;
    };

    item.onclick = (e) => {
      if (e.target === checkbox) return; // lo maneja checkbox.onclick
      applySelection(!selectedExerciseIds.has(exercise.id));
    };
    checkbox.onclick = (e) => {
      e.stopPropagation();
      applySelection(checkbox.checked);
    };

    pickerList.appendChild(item);
  });
}

confirmAddBtn.onclick = () => {
  const routine = db.routines[currentRoutineIndex];
  if (!routine) return;
  if (!routine.items) routine.items = [];

  if (pickerMode === 'superset') {
    if (selectedExerciseIds.size < SUPERSET_MIN_EXERCISES) {
      alert(`Una superserie necesita al menos ${SUPERSET_MIN_EXERCISES} ejercicios (máximo ${SUPERSET_MAX_EXERCISES}).`);
      return;
    }

    // Un único ítem de tipo 'superset' (liviano: solo ids y números) en vez de N ítems sueltos
    const ids = [...selectedExerciseIds].slice(0, SUPERSET_MAX_EXERCISES);
    routine.items.push({
      type: 'superset',
      exerciseIds: ids,
      rounds: 3,
      restBetweenExercises: 15,
      restBetweenRounds: 90,
      reps: ids.map(() => '10')
    });

    save();
    drawRoutine();
    renderHome();
    closeExercisePicker();
    showToast(ids.length >= 3 ? 'Triserie añadida' : 'Superserie añadida');
    return;
  }

  if (selectedExerciseIds.size === 0) {
    alert('Por favor selecciona al menos un ejercicio marcando su casilla.');
    return;
  }

  selectedExerciseIds.forEach(id => {
    const exercise = ex(id);
    if (exercise) {
      routine.items.push({
        exerciseId: exercise.id,
        sets: 3,
        reps: '10'
      });
    }
  });

  save();
  drawRoutine();
  renderHome();
  closeExercisePicker();
  showToast(`${selectedExerciseIds.size} ejercicio(s) añadido(s)`);
};

// ==========================================
// PANTALLA 5: MODO ENTRENAMIENTO (WORKOUT)
// ==========================================
let workoutRoutineIdx = 0;
let exerciseStep = 0;
let currentSet = 1;
let supersetIndex = 0; // posición (0-based) dentro del bloque de superserie actual
let supersetRound = 1; // vuelta actual del bloque de superserie (1..rounds)
let timeRemaining = 0;
let workoutInterval = null;
let isPaused = false;
let isResting = false;
let isPreparing = false;
let workoutHistory = [];

const exerciseTitle = document.getElementById('exerciseTitle');
const workoutCategoryBadge = document.getElementById('workoutCategoryBadge');
const exerciseImage = document.getElementById('exerciseImage');
const restVisual = document.getElementById('restVisual');
const timerDisplay = document.getElementById('timer');
const seriesInfo = document.getElementById('seriesInfo');
const workoutProgressBadge = document.getElementById('workoutProgressBadge');

const prevBtn = document.getElementById('prevBtn');
const pauseBtn = document.getElementById('pauseBtn');
const nextBtn = document.getElementById('nextBtn');
const exitWorkoutBtn = document.getElementById('exitWorkout');

// ==========================================
// ALERTAS SONORAS DE TEMPORIZADOR (Web Audio API)
// ==========================================
const AudioFX = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function play(freq, duration = 0.08, type = 'sine') {
    const audioCtx = getCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0.06;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  }
  return {
    beep: () => play(880, 0.08, 'square'),
    final: () => play(1320, 0.25, 'triangle')
  };
})();

// Suena un beep en los últimos 5 segundos de cualquier descanso, y un tono final al llegar a 0
function beepCountdown(secondsLeft) {
  if (secondsLeft <= 5 && secondsLeft > 0) AudioFX.beep();
  if (secondsLeft === 0) AudioFX.final();
}

// ==========================================
// DESCANSO ENTRE EJERCICIOS (pantalla completa)
// ==========================================
const TF_DEFAULT_REST_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800';
const exerciseRestOverlay = document.getElementById('exerciseRestOverlay');
const exerciseRestImage = document.getElementById('exerciseRestImage');
const exerciseRestCountdown = document.getElementById('exerciseRestCountdown');
const nextExerciseLabel = document.getElementById('nextExerciseLabel');
const skipExerciseRestBtn = document.getElementById('skipExerciseRest');

let exerciseRestSecondsLeft = 0;
let exerciseRestInterval = null;

function startExerciseRest(nextExerciseName, seconds, imageUrl) {
  if (!exerciseRestOverlay) return;
  exerciseRestImage.src = imageUrl || TF_DEFAULT_REST_IMAGE;
  nextExerciseLabel.textContent = nextExerciseName;
  exerciseRestSecondsLeft = seconds || 60;
  exerciseRestCountdown.textContent = exerciseRestSecondsLeft;
  exerciseRestOverlay.classList.remove('hidden');
  updateGlobalRoutineTimerDisplay();

  clearInterval(exerciseRestInterval);
  exerciseRestInterval = setInterval(() => {
    exerciseRestSecondsLeft--;
    exerciseRestCountdown.textContent = Math.max(exerciseRestSecondsLeft, 0);
    beepCountdown(exerciseRestSecondsLeft);
    updateGlobalRoutineTimerDisplay();
    if (exerciseRestSecondsLeft <= 0) {
      finishExerciseRest();
    }
  }, 1000);
}

function finishExerciseRest() {
  clearInterval(exerciseRestInterval);
  if (exerciseRestOverlay) exerciseRestOverlay.classList.add('hidden');
  document.dispatchEvent(new CustomEvent('toniflow:start-next-exercise'));
}

if (skipExerciseRestBtn) {
  skipExerciseRestBtn.onclick = () => finishExerciseRest();
}

// Cuando termina la última serie de un ejercicio, arranca el descanso inter-ejercicio configurado en la rutina
document.addEventListener('toniflow:exercise-finished', (e) => {
  startExerciseRest(e.detail.nextExercise, e.detail.seconds, e.detail.image);
});

// Cuando el descanso inter-ejercicio termina (o se salta), se pasa directo
// a la primera serie del nuevo ejercicio (la preparación solo ocurre una vez, al arrancar la rutina)
document.addEventListener('toniflow:start-next-exercise', () => {
  loadWorkoutStep();
});

// ==========================================
// RELOJ GLOBAL: TIEMPO TOTAL RESTANTE DE LA RUTINA (recalculado en tiempo real)
// ==========================================
const globalRoutineTimerEl = document.getElementById('globalRoutineTimer');
const globalRoutineTimerValueEl = document.getElementById('globalRoutineTimerValue');

// Suma el tiempo completo de los ítems (ejercicios individuales o bloques de superserie)
// desde fromIdx hasta el final de la rutina. includeRestBeforeFirst controla si se suma el
// descanso entre ejercicios antes del primer ítem del rango (no corresponde si ese descanso
// ya se está contando aparte, p. ej. en el overlay).
function sumRoutineTimeFrom(routine, items, fromIdx, includeRestBeforeFirst) {
  let total = 0;
  for (let idx = fromIdx; idx < items.length; idx++) {
    const item = items[idx];
    if (!isValidRoutineItem(item)) continue;

    if (idx > fromIdx || includeRestBeforeFirst) {
      total += routine.exerciseRestSeconds || 90;
    }
    total += itemDurationSeconds(item);
  }
  return total;
}

// Estima el tiempo total de la rutina completa: preparación inicial (una sola vez) +
// duración de cada serie + descansos entre series + descansos entre ejercicios
function calculateTotalRoutineSeconds(routine) {
  const items = routine.items || [];
  const prep = routine.prepSeconds != null ? routine.prepSeconds : 10;
  return prep + sumRoutineTimeFrom(routine, items, 0, false);
}

// Calcula, en base al estado ACTUAL del entrenamiento (fase, ejercicio, serie), el tiempo
// real que falta para terminar toda la rutina. Se recalcula en cada tick y ante cualquier
// salto/avance/retroceso, así que siempre refleja el tiempo exacto restante.
function calculateRemainingRoutineSeconds() {
  const routine = db.routines[workoutRoutineIdx];
  if (!routine) return 0;
  const items = routine.items || [];

  // Durante el overlay de descanso entre ejercicios, exerciseStep ya apunta al próximo
  // ejercicio (todavía no comenzado), y su propio conteo lleva el tiempo de esa fase.
  const inExerciseOverlayRest = exerciseRestOverlay && !exerciseRestOverlay.classList.contains('hidden');

  if (isPreparing) {
    return Math.max(timeRemaining, 0) + sumRoutineTimeFrom(routine, items, 0, false);
  }

  if (inExerciseOverlayRest) {
    return Math.max(exerciseRestSecondsLeft, 0) + sumRoutineTimeFrom(routine, items, exerciseStep, false);
  }

  let remaining = Math.max(timeRemaining, 0);
  const currentItem = items[exerciseStep];

  if (currentItem && currentItem.type === 'superset') {
    remaining += remainingSupersetSeconds(currentItem);
  } else if (currentItem) {
    const exercise = ex(currentItem.exerciseId);
    if (exercise) {
      const sets = currentItem.sets || 1;
      const duration = exercise.duration || 45;
      const restBetweenSets = exercise.restBetweenSetsSeconds || 45;

      if (isResting) {
        // timeRemaining ya es el descanso antes de currentSet; faltan currentSet..sets completas
        const remainingSets = Math.max(sets - currentSet + 1, 0);
        remaining += duration * remainingSets + restBetweenSets * Math.max(remainingSets - 1, 0);
      } else {
        // timeRemaining ya es lo que falta de currentSet; faltan las series posteriores completas
        const remainingSetsAfter = Math.max(sets - currentSet, 0);
        remaining += duration * remainingSetsAfter + restBetweenSets * remainingSetsAfter;
      }
    }
  }

  // Ítems completos que todavía no arrancaron (incluye el descanso inter-ejercicio previo a cada uno)
  remaining += sumRoutineTimeFrom(routine, items, exerciseStep + 1, true);

  return remaining;
}

// Tiempo restante DENTRO del bloque de superserie actual, a partir del estado real
// (supersetIndex/supersetRound), sin contar el tramo activo (eso ya está en timeRemaining).
function remainingSupersetSeconds(item) {
  const exerciseIds = item.exerciseIds || [];
  const n = exerciseIds.length;
  if (n === 0) return 0;

  const rounds = item.rounds || 1;
  const restShort = item.restBetweenExercises != null ? item.restBetweenExercises : 15;
  const restLong = item.restBetweenRounds != null ? item.restBetweenRounds : 90;
  const perRound = supersetRoundSeconds(item);

  // Si se está descansando, supersetIndex/supersetRound YA apuntan al próximo ejercicio/vuelta
  // (igual que currentSet durante el descanso entre series de un ejercicio individual), así que
  // se incluye completo. Si se está trabajando, se excluye el ejercicio en curso.
  const startIdx = isResting ? supersetIndex : supersetIndex + 1;

  let remaining = 0;

  // Trabajando un ejercicio que no es el último de la vuelta: falta el descanso corto que le
  // sigue (el que lo separa del ejercicio siguiente), que el bucle de abajo no cuenta.
  if (!isResting && supersetIndex < n - 1) remaining += restShort;

  for (let i = startIdx; i < n; i++) {
    const exercise = ex(exerciseIds[i]);
    remaining += exercise ? (exercise.duration || 45) : 0;
    if (i < n - 1) remaining += restShort;
  }

  const roundsLeft = Math.max(rounds - supersetRound, 0);
  remaining += (perRound + restLong) * roundsLeft;

  return remaining;
}

function updateGlobalRoutineTimerDisplay() {
  if (!globalRoutineTimerValueEl) return;
  const safeSeconds = Math.max(calculateRemainingRoutineSeconds(), 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  globalRoutineTimerValueEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
}

function startGlobalRoutineTimer() {
  if (globalRoutineTimerEl) globalRoutineTimerEl.classList.remove('hidden');
}

function stopGlobalRoutineTimer() {
  if (globalRoutineTimerEl) globalRoutineTimerEl.classList.add('hidden');
}

function startWorkout(routineIdx) {
  const routine = db.routines[routineIdx];
  if (!routine) return;

  const validItems = (routine.items || []).filter(isValidRoutineItem);
  if (validItems.length === 0) {
    alert('Esta rutina no tiene ejercicios. Por favor edita la rutina y añade ejercicios antes de comenzar.');
    return;
  }

  workoutRoutineIdx = routineIdx;
  exerciseStep = 0;
  currentSet = 1;
  supersetIndex = 0;
  supersetRound = 1;
  workoutHistory = [];
  isResting = false;
  isPreparing = true;
  isPaused = false;
  pauseBtn.textContent = 'Pausar';

  startGlobalRoutineTimer();
  loadWorkoutStep();
  show('workout');
}

// Arranca/reinicia el temporizador de la fase actual y ejecuta onComplete cuando llega a 0.
// Centraliza el tick, los beeps y el refresco del reloj global para las 4 fases posibles:
// preparación, trabajo (ejercicio individual o de superserie) y descanso (de cualquier tipo).
function runWorkoutTimer(onComplete) {
  updateTimerDisplay();
  clearInterval(workoutInterval);

  workoutInterval = setInterval(() => {
    if (isPaused) return;

    timeRemaining--;
    updateTimerDisplay();

    // Los beeps de los últimos 5 segundos suenan en cualquier fase: preparación, series y descansos
    beepCountdown(timeRemaining);

    if (timeRemaining <= 0) {
      clearInterval(workoutInterval);
      onComplete();
    }
  }, 1000);
}

function loadWorkoutStep() {
  const routine = db.routines[workoutRoutineIdx];
  const items = routine.items || [];

  if (exerciseStep >= items.length) {
    clearInterval(workoutInterval);
    stopGlobalRoutineTimer();
    alert('🎉 ¡Felicitaciones! Has completado todo tu entrenamiento.');
    show('home');
    return;
  }

  const currentItem = items[exerciseStep];

  if (!isValidRoutineItem(currentItem)) {
    exerciseStep++;
    loadWorkoutStep();
    return;
  }

  const isSuperset = currentItem.type === 'superset';
  workoutProgressBadge.textContent = `Ejercicio ${exerciseStep + 1} de ${items.length}`;

  if (isPreparing) {
    const firstExercise = isSuperset ? ex(currentItem.exerciseIds[0]) : ex(currentItem.exerciseId);
    const firstName = firstExercise ? firstExercise.name : 'Ejercicio';

    if (workoutCategoryBadge) workoutCategoryBadge.style.display = 'none';
    exerciseTitle.textContent = 'Prepárate';
    restVisual.style.display = 'none';
    exerciseImage.style.display = 'block';
    exerciseImage.src = db.settings.prepImageUrl || TF_DEFAULT_REST_IMAGE;
    timeRemaining = routine.prepSeconds != null ? routine.prepSeconds : 10;
    seriesInfo.textContent = isSuperset
      ? `A continuación: Superserie — ${firstName} (Ejercicio 1 de ${currentItem.exerciseIds.length})`
      : `A continuación: ${firstName} (Serie 1 de ${currentItem.sets})`;

    runWorkoutTimer(() => {
      isPreparing = false;
      loadWorkoutStep();
    });
    return;
  }

  if (isSuperset) {
    loadSupersetStep(routine, items, currentItem);
    return;
  }

  // ---- Ejercicio individual ----
  const exercise = ex(currentItem.exerciseId);

  if (isResting) {
    if (workoutCategoryBadge) workoutCategoryBadge.style.display = 'none';
    exerciseTitle.textContent = 'Descanso';
    restVisual.style.display = 'none';
    exerciseImage.style.display = 'block';
    exerciseImage.src = db.settings.restBetweenSetsImageUrl || TF_DEFAULT_REST_IMAGE;
    timeRemaining = exercise.restBetweenSetsSeconds || 45;
    seriesInfo.textContent = `Próxima serie: ${currentSet} de ${currentItem.sets} (${exercise.name})`;
    runWorkoutTimer(() => stepBackToWork());
    return;
  }

  if (workoutCategoryBadge) {
    workoutCategoryBadge.style.display = 'inline-block';
    workoutCategoryBadge.className = `cat-badge-workout ${exercise.category || 'Push'}`;
    workoutCategoryBadge.textContent = exercise.category || 'Push';
  }
  exerciseTitle.textContent = exercise.name;
  restVisual.style.display = 'none';

  if (exercise.image) {
    exerciseImage.style.display = 'block';
    exerciseImage.src = exercise.image;
  } else {
    exerciseImage.style.display = 'none';
    restVisual.style.display = 'flex';
    restVisual.innerHTML = `<span>🏋️</span><small style="color:var(--soft)">${exercise.name}</small>`;
  }

  timeRemaining = exercise.duration || 45;
  seriesInfo.textContent = `Serie ${currentSet} de ${currentItem.sets} • Objetivo: ${currentItem.reps || '10'} reps`;
  runWorkoutTimer(() => stepForward());
}

// ---- Bloque de Superserie / Triserie ----
// Secuencia: Ejercicio A -> descanso corto -> Ejercicio B -> descanso corto -> Ejercicio C ->
// descanso largo (si queda otra vuelta) -> se repite "rounds" veces -> fin del bloque.
function loadSupersetStep(routine, items, currentItem) {
  const exerciseIds = currentItem.exerciseIds || [];
  const n = exerciseIds.length;
  const rounds = currentItem.rounds || 1;
  const exercise = ex(exerciseIds[supersetIndex]);

  if (!exercise) {
    // El ejercicio de esta posición ya no existe en el catálogo: se intenta saltar al siguiente
    if (supersetIndex < n - 1) {
      supersetIndex++;
    } else {
      supersetIndex = 0;
      supersetRound++;
    }
    if (supersetRound > rounds) {
      finishCurrentRoutineItem(routine, items);
    } else {
      loadWorkoutStep();
    }
    return;
  }

  workoutCategoryBadge && (workoutCategoryBadge.style.display = 'none');

  if (isResting) {
    // supersetIndex === 0 solo puede darse tras completar una vuelta entera: es el descanso
    // LARGO entre vueltas. Cualquier otro valor es el descanso CORTO entre ejercicios del bloque.
    const isLongRest = supersetIndex === 0;
    exerciseTitle.textContent = isLongRest ? '🔗 Superserie — Descanso entre vueltas' : '🔗 Superserie — Cambio de ejercicio';
    restVisual.style.display = 'none';
    exerciseImage.style.display = 'block';
    exerciseImage.src = isLongRest
      ? (db.settings.restBetweenExercisesImageUrl || TF_DEFAULT_REST_IMAGE)
      : (db.settings.restBetweenSetsImageUrl || TF_DEFAULT_REST_IMAGE);
    timeRemaining = isLongRest
      ? (currentItem.restBetweenRounds != null ? currentItem.restBetweenRounds : 90)
      : (currentItem.restBetweenExercises != null ? currentItem.restBetweenExercises : 15);
    seriesInfo.textContent = isLongRest
      ? `Próxima vuelta: ${supersetRound} de ${rounds} • Siguiente: ${exercise.name}`
      : `Próximo: ${exercise.name} (Ejercicio ${supersetIndex + 1} de ${n}) • Vuelta ${supersetRound} de ${rounds}`;
    runWorkoutTimer(() => stepBackToWork());
    return;
  }

  if (workoutCategoryBadge) {
    workoutCategoryBadge.style.display = 'inline-block';
    workoutCategoryBadge.className = `cat-badge-workout ${exercise.category || 'Push'}`;
    workoutCategoryBadge.textContent = exercise.category || 'Push';
  }
  exerciseTitle.textContent = `🔗 Superserie: ${exercise.name}`;
  restVisual.style.display = 'none';

  if (exercise.image) {
    exerciseImage.style.display = 'block';
    exerciseImage.src = exercise.image;
  } else {
    exerciseImage.style.display = 'none';
    restVisual.style.display = 'flex';
    restVisual.innerHTML = `<span>🏋️</span><small style="color:var(--soft)">${exercise.name}</small>`;
  }

  const repsForThis = (Array.isArray(currentItem.reps) && currentItem.reps[supersetIndex]) || '10';
  timeRemaining = exercise.duration || 45;
  seriesInfo.textContent = `Superserie (Ejercicio ${supersetIndex + 1} de ${n}) • Vuelta ${supersetRound} de ${rounds} • Objetivo: ${repsForThis} reps`;
  runWorkoutTimer(() => stepForward());
}

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  timerDisplay.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  updateGlobalRoutineTimerDisplay();
}

function stepBackToWork() {
  workoutHistory.push({ exerciseStep, currentSet, isResting, isPreparing, supersetIndex, supersetRound });
  isResting = false;
  loadWorkoutStep();
}

function stepForward() {
  const routine = db.routines[workoutRoutineIdx];
  const items = routine.items || [];
  const currentItem = items[exerciseStep];

  if (currentItem.type === 'superset') {
    stepForwardSuperset(routine, items, currentItem);
    return;
  }

  workoutHistory.push({ exerciseStep, currentSet, isResting, isPreparing, supersetIndex, supersetRound });

  if (currentSet < currentItem.sets) {
    currentSet++;
    isResting = true;
    loadWorkoutStep();
    return;
  }

  // Se completaron todas las series de este ejercicio
  finishCurrentRoutineItem(routine, items);
}

function stepForwardSuperset(routine, items, currentItem) {
  workoutHistory.push({ exerciseStep, currentSet, isResting, isPreparing, supersetIndex, supersetRound });

  const exerciseIds = currentItem.exerciseIds || [];
  const n = exerciseIds.length;
  const rounds = currentItem.rounds || 1;

  if (supersetIndex < n - 1) {
    // Pasamos al siguiente ejercicio del bloque, con el descanso corto configurado
    supersetIndex++;
    isResting = true;
    loadWorkoutStep();
    return;
  }

  // Era el último ejercicio de la vuelta
  if (supersetRound < rounds) {
    // Queda otra vuelta completa: descanso largo entre vueltas
    supersetRound++;
    supersetIndex = 0;
    isResting = true;
    loadWorkoutStep();
    return;
  }

  // Última vuelta completada: el bloque de superserie terminó
  finishCurrentRoutineItem(routine, items);
}

// Marca el ítem actual (ejercicio individual o bloque de superserie) como terminado y pasa al
// siguiente ítem de la rutina, mostrando el descanso inter-ejercicio configurado en la rutina
// (con la imagen global correspondiente) o finalizando el entrenamiento si era el último.
function finishCurrentRoutineItem(routine, items) {
  const nextIndex = exerciseStep + 1;
  currentSet = 1;
  supersetIndex = 0;
  supersetRound = 1;
  isResting = false;

  if (nextIndex < items.length) {
    exerciseStep = nextIndex;
    document.dispatchEvent(new CustomEvent('toniflow:exercise-finished', {
      detail: {
        nextExercise: routineItemLabel(items[nextIndex]),
        seconds: routine.exerciseRestSeconds || 90,
        image: db.settings.restBetweenExercisesImageUrl || ''
      }
    }));
    return; // loadWorkoutStep() se llama al terminar/saltar el descanso
  }

  // Era el último ítem: terminamos el entrenamiento
  exerciseStep = nextIndex;
  loadWorkoutStep();
}

pauseBtn.onclick = () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? 'Reanudar' : 'Pausar';
};

nextBtn.onclick = () => {
  clearInterval(workoutInterval);
  if (isPreparing) {
    isPreparing = false;
    loadWorkoutStep();
  } else if (isResting) {
    stepBackToWork();
  } else {
    stepForward();
  }
};

prevBtn.onclick = () => {
  clearInterval(workoutInterval);
  const previousState = workoutHistory.pop();
  if (previousState) {
    exerciseStep = previousState.exerciseStep;
    currentSet = previousState.currentSet;
    isResting = previousState.isResting;
    isPreparing = previousState.isPreparing || false;
    supersetIndex = previousState.supersetIndex || 0;
    supersetRound = previousState.supersetRound || 1;
  }
  loadWorkoutStep();
};

exitWorkoutBtn.onclick = () => {
  if (confirm('¿Deseas salir del entrenamiento en curso?')) {
    clearInterval(workoutInterval);
    stopGlobalRoutineTimer();
    show('home');
  }
};

// Exportar funciones al objeto window para compatibilidad con onclick inline
window.startWorkout = startWorkout;
window.editRoutine = editRoutine;
window.deleteRoutine = deleteRoutine;
window.openExerciseEditor = openExerciseEditor;
window.deleteExercise = deleteExercise;
window.removeRoutineItem = removeRoutineItem;

// Render inicial
renderHome();

// ==========================================
// PWA: registro del Service Worker (soporte offline e instalación como app)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Service Worker registrado:', registration.scope);
      })
      .catch((err) => {
        console.error('Error registrando el Service Worker:', err);
      });
  });
}

