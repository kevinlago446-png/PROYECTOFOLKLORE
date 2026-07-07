/**
 * RAÍCES TICKETS — Módulo de Autenticación
 * Maneja login, registro y sesión de usuario (prototipo)
 */


// ──────────────────────────────────────────────
// UTILIDADES DE VALIDACIÓN VISUAL
// ──────────────────────────────────────────────
function mostrarError(idCampo, idError, mostrar) {
  const campo = document.getElementById(idCampo);
  const errorMsg = document.getElementById(idError);
  
  if (!campo || !errorMsg) return; // Evita que se rompa si no encuentra el ID

  if (mostrar) {
    // Si hay error, le ponemos borde rojo al input y mostramos el texto
    campo.style.borderColor = 'var(--error, #ef4444)';
    errorMsg.style.display = 'block';
    errorMsg.style.color = 'var(--error, #ef4444)';
    errorMsg.style.fontSize = '0.85rem';
    errorMsg.style.marginTop = '4px';
  } else {
    // Si está todo bien, lo dejamos normal
    campo.style.borderColor = '';
    errorMsg.style.display = 'none';
  }
}
// ──────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────

/**
 * Muestra u oculta un mensaje de error junto a un campo
 * @param {string} idCampo  - id del input
 * @param {string} idError  - id del span de error
 * @param {boolean} mostrar - true = mostrar, false = ocultar
 */
function toggleError(idCampo, idError, mostrar) {
  const campo = document.getElementById(idCampo);
  const msg   = document.getElementById(idError);
  if (!campo || !msg) return;

  if (mostrar) {
    campo.classList.add('error-campo');
    msg.classList.add('visible');
  } else {
    campo.classList.remove('error-campo');
    msg.classList.remove('visible');
  }
}

/** Validación básica de email */
function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Guarda el usuario en sessionStorage (simula sesión activa) */
function guardarSesion(usuario) {
  sessionStorage.setItem('usuarioActivo', JSON.stringify(usuario));
}

/** Obtiene el usuario de la sesión activa */
function obtenerSesion() {
  const datos = sessionStorage.getItem('usuarioActivo');
  return datos ? JSON.parse(datos) : null;
}

/** Cierra la sesión (servidor + cliente) y redirige al login */
async function cerrarSesion() {
  try {
    await fetch('../../controlador/ControladorAuth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'logout' })
    });
  } catch (error) {
    console.error("No se pudo avisar al servidor del logout:", error);
  }
  sessionStorage.removeItem('usuarioActivo');
  window.location.href = 'index.html';
}

// ──────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// ACCIÓN: LOGIN DE USUARIO (Conectado a PHP)
// ──────────────────────────────────────────────
async function manejarLogin() {
  const email = document.getElementById('emailLogin').value.trim();
  const password = document.getElementById('passwordLogin').value.trim();

  // (Mantenemos tus validaciones visuales)
  mostrarError('emailLogin', 'errorEmailLogin', email === '');
  mostrarError('passwordLogin', 'errorPasswordLogin', password === '');

  if (email === '' || password === '') return;

  try {
    // 1. Enviamos los datos al Controlador PHP
    const respuesta = await fetch('../../controlador/ControladorAuth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        accion: 'login',
        email: email,
        password: password
      })
    });

    // 2. Leemos la respuesta del servidor
    const datos = await respuesta.json();

    if (datos.exito && datos.requiere_2fa) {
      // Contraseña correcta: mostramos el paso 2 (código de correo)
      document.getElementById('formLogin').style.display = 'none';
      document.getElementById('formVerificacion2FA').style.display = 'block';
    } else if (datos.exito) {
      // (No debería pasar más con 2FA activo, pero por si acaso)
      sessionStorage.setItem('usuarioActivo', JSON.stringify(datos.usuario));
      window.location.href = 'menu.html';
    } else {
      // El PHP nos devolvió un error (ej: contraseña incorrecta)
      alert(datos.mensaje); 
    }

  } catch (error) {
    console.error("Error al conectar con el servidor:", error);
    alert("Hubo un problema de conexión con el servidor.");
  }
}

// ──────────────────────────────────────────────
// ACCIÓN: VERIFICAR CÓDIGO 2FA (Paso 2 del login)
// ──────────────────────────────────────────────
async function manejarVerificacion2FA() {
  const codigo = document.getElementById('codigo2FA').value.trim();

  mostrarError('codigo2FA', 'errorCodigo2FA', codigo === '');
  if (codigo === '') return;

  try {
    const respuesta = await fetch('../../controlador/ControladorAuth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        accion: 'verificar_2fa',
        codigo: codigo
      })
    });

    const datos = await respuesta.json();

    if (datos.exito) {
      sessionStorage.setItem('usuarioActivo', JSON.stringify(datos.usuario));
      window.location.href = 'menu.html';
    } else {
      alert(datos.mensaje);
    }

  } catch (error) {
    console.error("Error al conectar con el servidor:", error);
    alert("Hubo un problema de conexión con el servidor.");
  }
}

// ──────────────────────────────────────────────
// REGISTRO
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// ACCIÓN: REGISTRO DE USUARIO (Conectado a PHP)
// ──────────────────────────────────────────────
async function manejarRegistro() {
  // 1. Capturamos con los IDs EXACTOS de tu registro.html
  const nombre = document.getElementById('nombreCompleto').value.trim();
  const dni = document.getElementById('dniRegistro').value.trim();
  const telefono = document.getElementById('telefonoRegistro').value.trim();
  const email = document.getElementById('emailRegistro').value.trim();
  const password = document.getElementById('passwordRegistro').value.trim();

  // 2. Validaciones visuales (también con los IDs de error correctos)
  mostrarError('nombreCompleto', 'errorNombre', nombre === '');
  mostrarError('dniRegistro', 'errorDni', dni === '');
  mostrarError('emailRegistro', 'errorEmailReg', email === '');
  mostrarError('passwordRegistro', 'errorPassword', password === '');

  // Frenar si falta algo
  if (nombre === '' || dni === '' || email === '' || password === '') return;

  try {
    // 3. Enviamos los datos al Controlador PHP
    const respuesta = await fetch('../../controlador/ControladorAuth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'registro',
        nombre: nombre,
        dni: dni,
        telefono: telefono,
        email: email,
        password: password
      })
    });

    // 4. Leemos la respuesta del servidor
    const datos = await respuesta.json();

    if (datos.exito) {
      alert("¡Registro exitoso! Ahora puedes iniciar sesión.");
      // Redirigimos al index para que inicie sesión
      window.location.href = 'index.html'; 
    } else {
      // El PHP nos devuelve error (ej: el email ya existe)
      const alertaEl = document.getElementById('alertaRegistro');
      if (alertaEl) {
        alertaEl.textContent = datos.mensaje;
        alertaEl.classList.add('visible');
      } else {
        alert(datos.mensaje);
      }
    }

  } catch (error) {
    console.error("Error al conectar con el servidor:", error);
    alert("Hubo un problema de conexión con el servidor.");
  }
}

// ──────────────────────────────────────────────
// PROTECCIÓN DE PÁGINAS
// Llamar al inicio de páginas que requieren login
// ──────────────────────────────────────────────

function requiereLogin() {
  if (!obtenerSesion()) {
    window.location.href = 'index.html';
  }
}

// ──────────────────────────────────────────────
// ACTUALIZAR NAVBAR GLOBAL
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // AHORA SÍ: Buscamos en sessionStorage
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
  
  if (datosSesion) {
    const usuario = JSON.parse(datosSesion);
    const navName = document.getElementById('nav-user-name');
    const navAvatar = document.getElementById('nav-user-avatar');
    
    if (navName) navName.textContent = usuario.nombre;
    if (navAvatar) navAvatar.textContent = usuario.nombre.charAt(0).toUpperCase();
  }
});