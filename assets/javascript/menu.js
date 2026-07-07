/**
 * RAÍCES TICKETS — Módulo del Menú Principal
 * Muestra el contenido del menú según el usuario logueado
 */

// ────────────────────────────────────────────────────────────────
// Noches del festival: ya NO están hardcodeadas. Se piden al
// servidor (tabla `noches`, cargada desde el panel admin).
// ────────────────────────────────────────────────────────────────
let NOCHES_FESTIVAL = [];

const MESES_ABREV = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

/** Pide las noches reales al servidor y las deja en el formato que ya usa renderizarGrilla() */
async function cargarNochesDesdeServidor() {
  try {
    const respuesta = await fetch('../../controlador/ControladorNoches.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accion: 'listar_noches' })
    });
    const datos = await respuesta.json();

    if (!datos.exito) {
      console.error('No se pudieron cargar las noches:', datos.mensaje);
      NOCHES_FESTIVAL = [];
      return;
    }

    NOCHES_FESTIVAL = datos.noches.map(noche => {
      const fechaObj = new Date(noche.fecha + 'T00:00:00');
      const tieneAnticipada = noche.descuento_anticipada === '1' || noche.descuento_anticipada === 1;

      return {
        id: String(noche.id),
        mes: MESES_ABREV[fechaObj.getMonth()],
        dia: String(fechaObj.getDate()),
        titulo: noche.titulo,
        estadoTag: tieneAnticipada ? 'DESCUENTO ANTICIPADA' : '',
        tagClase: tieneAnticipada ? 'tag-exito' : '',
        artistas: noche.artistas,
        horario: noche.horario,
        precio: Number(noche.precio_base).toLocaleString('es-AR')
      };
    });

  } catch (error) {
    console.error('Error al conectar con el servidor:', error);
    NOCHES_FESTIVAL = [];
  }
}

function renderizarNoches() {
  const contenedor = document.getElementById('contenedor-noches');
  if (!contenedor) return;

  contenedor.innerHTML = ''; // Limpia el contenedor por si había algo antes

  NOCHES_FESTIVAL.forEach(noche => {
    const card = document.createElement('div');
    card.className = 'card-noche';
    
    // Al hacer clic en la tarjeta, nos lleva a la reserva de esa noche específica
    card.onclick = () => irA('reserva', noche.id); 
    
    card.innerHTML = `
      <h3>${noche.titulo}</h3>
      <p>${noche.horario}</p>
      <button>Reservar</button>
    `;
    
    contenedor.appendChild(card);
  });
}
// ────────────────────────────────────────────────────────────────
// Inicialización del DOM y Controladores de Eventos
// ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await cargarNochesDesdeServidor();
  renderizarGrilla('todas'); // Render inicial muestra todo
  configurarFiltros();
  // NUEVA MAGIA: Buscamos si el usuario es vendedor (o admin)
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
  
  if (datosSesion) {
    const usuario = JSON.parse(datosSesion);
    
    // Verificamos si en la base de datos le pusimos el rol de "vendedor"
    if (usuario.rol === 'vendedor') {
      const btnPortero = document.getElementById('btn-portero');
      if (btnPortero) {
        // Como es el jefe, le hacemos aparecer el botón
        btnPortero.style.display = 'inline-block'; 
      }
    }

    // Si es admin, le mostramos el acceso al panel de carga de noches
    if (usuario.rol === 'admin' || usuario.rol === 'superadmin') {
      const btnAdmin = document.getElementById('btn-admin');
      if (btnAdmin) {
        btnAdmin.style.display = 'inline-block';
      }
    }
  }
});

function configurarFiltros() {
  const botonesFiltro = document.querySelectorAll('.filtro-pill');
  
  botonesFiltro.forEach(boton => {
    boton.addEventListener('click', (e) => {
      // Remover clase activa de todos los botones
      botonesFiltro.forEach(btn => btn.classList.remove('active'));
      // Agregar activa al botón cliqueado
      e.target.classList.add('active');
      
      // Filtrar y volver a renderizar
      const filtroSeleccionado = e.target.getAttribute('data-filtro');
      renderizarGrilla(filtroSeleccionado);
    });
  });
}

function renderizarGrilla(filtro) {
  const contenedor = document.getElementById('nochesContainer');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  // Filtrar el array según la píldora activa
  const nochesFiltradas = NOCHES_FESTIVAL.filter(noche => {
    if (filtro === 'todas') return true;
    if (filtro === '4-5') return noche.id === '4' || noche.id === '5';
    return noche.id === filtro;
  });

  // Crear las tarjetas con la estructura vertical exacta de la foto
  nochesFiltradas.forEach(noche => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'presentacion-card';
    tarjeta.innerHTML = `
      <div class="card-header-row">
        <div class="card-badge-fecha">
          <span class="fecha-mes">${noche.mes}</span>
          <span class="fecha-dia">${noche.dia}</span>
        </div>
        <div class="card-header-info">
          <h3 class="card-noche-titulo">${noche.titulo}</h3>
          ${noche.estadoTag ? `<span class="status-pill-tag ${noche.tagClase}">${noche.estadoTag}</span>` : ''}
        </div>
      </div>

      <div class="card-cuerpo-artistas">
        <span class="artistas-label">ARTISTAS CONFIRMADOS</span>
        <p class="artistas-lista">${noche.artistas}</p>
      </div>

      <div class="card-reloj-bar">
        <span class="icono-reloj">🕒</span>
        <span class="reloj-texto">${noche.horario}</span>
      </div>

      <div class="card-footer-row">
        <div class="precio-bloque">
          <span class="precio-label">DESDE</span>
          <span class="precio-monto">$ ${noche.precio}</span>
        </div>
        <button class="btn-seleccionar-butaca" onclick="irA('reserva', '${noche.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px; vertical-align:middle;">
            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            <path d="M16 8h.01M12 8h.01M8 8h.01M16 12h.01M12 12h.01M8 12h.01"></path>
          </svg>
          Seleccionar Butaca y reservar
        </button>
      </div>
    `;
    contenedor.appendChild(tarjeta);
  });
}

// ──────────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  // Verificar sesión activa
  requiereLogin();

  const usuario = obtenerSesion();
  if (!usuario) return;

  // Actualizar nombre en navbar
  const navNombre = document.getElementById('nombreUsuarioNav');
  if (navNombre) {
    navNombre.textContent = usuario.nombre.split(' ')[0]; // Solo primer nombre
  }

  // Mostrar cards según rol
  configurarCardsPorRol(usuario.rol);

  // Renderizar noches del festival
  renderizarNoches();
});

// ──────────────────────────────────────────────
// CONFIGURACIÓN POR ROL
// ──────────────────────────────────────────────

function configurarCardsPorRol(rol) {
  const cardAdmin    = document.getElementById('cardAdmin');
  const cardVendedor = document.getElementById('cardVendedor');

  if (rol === 'admin' || rol === 'superadmin') {
    if (cardAdmin)    cardAdmin.style.display    = 'block';
    if (cardVendedor) cardVendedor.style.display = 'block';
  } else if (rol === 'vendedor') {
    if (cardVendedor) cardVendedor.style.display = 'block';
  }
}

// ──────────────────────────────────────────────────────────────
// MODIFICACIÓN: Redirección real al módulo de reserva
// ──────────────────────────────────────────────────────────────
function irA(modulo, numNoche = null) {
  if (modulo === 'reserva') {
    // Si pasamos numNoche, lo enviamos por URL
    const url = numNoche ? `reserva.html?noche=${numNoche}` : 'reserva.html';
    window.location.href = url;
    return;
  }

  // Mantener lógica para otras rutas (admin, ventas, etc.)
  const RUTAS_MODULOS = {
    compra:     'compra.html',
    cartelera:  'cartelera.html',
    butacas:    'butacas.html',
    misEntradas:'mis-entradas.html',
    admin:      'admin.html',
    ventas:     'ventas.html',
    acceso:     'acceso.html',
  };

  if (RUTAS_MODULOS[modulo]) {
    window.location.href = RUTAS_MODULOS[modulo];
  } else {
    console.error("Módulo no encontrado:", modulo);
  }
}

// ──────────────────────────────────────────────
// MODAL CIERRE DE SESIÓN
// ──────────────────────────────────────────────
function abrirModalCierreSesion() {
  const modal = document.getElementById('modalCierreSesion');
  if (modal) modal.style.display = 'flex'; // Lo muestra centrado
}

function cerrarModal() {
  const modal = document.getElementById('modalCierreSesion');
  if (modal) modal.style.display = 'none'; // Lo vuelve a ocultar
}

function confirmarCierreSesion() {
  cerrarModal();
  cerrarSesion(); // Esta función ya está en tu autenticacion.js
}
// Cerrar modal al click fuera
document.addEventListener('click', function (e) {
  const modal = document.getElementById('modalCierreSesion');
  if (modal && e.target === modal) {
    cerrarModal();
  }
});