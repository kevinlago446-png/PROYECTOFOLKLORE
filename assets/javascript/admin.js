/**
 * RAÍCES TICKETS — Panel Admin (carga de noches)
 */

document.addEventListener('DOMContentLoaded', () => {
  requiereLogin();

  const usuario = obtenerSesion();
  if (!usuario) return;

  // Protección visual: si no es admin, lo mandamos de vuelta (la protección
  // real está en el servidor — exigirAdmin() en ControladorNoches.php)
  if (usuario.rol !== 'admin' && usuario.rol !== 'superadmin') {
    alert('No tenés permisos para acceder a esta sección.');
    window.location.href = 'menu.html';
    return;
  }

  cargarListadoNoches();
});

async function manejarCargaNoche() {
  const titulo    = document.getElementById('nocheTitulo').value.trim();
  const fecha     = document.getElementById('nocheFecha').value.trim();
  const horario   = document.getElementById('nocheHorario').value.trim();
  const artistas  = document.getElementById('nocheArtistas').value.trim();
  const precioBase = document.getElementById('nochePrecioBase').value.trim();
  const descuentoAnticipada = document.getElementById('nocheDescuentoAnticipada').checked;

  const alerta = document.getElementById('alertaAdmin');
  alerta.style.display = 'none';

  if (!titulo || !fecha || !horario || !artistas || !precioBase || Number(precioBase) <= 0) {
    alerta.textContent = 'Completá todos los campos correctamente antes de enviar.';
    alerta.style.display = 'block';
    return;
  }

  try {
    const respuesta = await fetch('../../controlador/ControladorNoches.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        accion: 'crear_noche',
        titulo,
        fecha,
        horario,
        artistas,
        precio_base: Number(precioBase),
        descuento_anticipada: descuentoAnticipada
      })
    });

    const datos = await respuesta.json();

    if (datos.exito) {
      alert('¡Noche cargada con éxito!');
      document.getElementById('nocheTitulo').value = '';
      document.getElementById('nocheFecha').value = '';
      document.getElementById('nocheHorario').value = '';
      document.getElementById('nocheArtistas').value = '';
      document.getElementById('nochePrecioBase').value = '';
      document.getElementById('nocheDescuentoAnticipada').checked = false;
      cargarListadoNoches();
    } else {
      alerta.textContent = datos.mensaje;
      alerta.style.display = 'block';
    }

  } catch (error) {
    console.error('Error al conectar con el servidor:', error);
    alerta.textContent = 'Hubo un problema de conexión con el servidor.';
    alerta.style.display = 'block';
  }
}

async function cargarListadoNoches() {
  const contenedor = document.getElementById('listaNoches');
  const usuarioSesion = obtenerSesion(); // Obtenemos la sesión actual para saber el rol

  try {
    const respuesta = await fetch('../../controlador/ControladorNoches.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accion: 'listar_noches' })
    });
    const datos = await respuesta.json();

    if (!datos.exito || datos.noches.length === 0) {
      contenedor.innerHTML = '<p style="color:#71717a;">Todavía no hay noches cargadas.</p>';
      return;
    }

    contenedor.innerHTML = datos.noches.map(noche => {
      // Si el rol es superadmin, renderizamos un botón de borrar
      const botonBorrar = (usuarioSesion && usuarioSesion.rol === 'superadmin') 
        ? `<button onclick="eliminarNoche(${noche.id})" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-top:10px; font-weight:bold; font-size:0.85rem;">Eliminar Noche</button>` 
        : '';

      return `
        <div style="background:white; border:1px solid #e4e4e7; border-radius:12px; padding:16px; margin-bottom:12px;">
          <strong>${noche.titulo}</strong> — ${noche.fecha}<br>
          <span style="color:#71717a; font-size:0.9rem;">${noche.artistas}</span><br>
          <span style="color:#71717a; font-size:0.9rem;">Precio base: $ ${Number(noche.precio_base).toLocaleString('es-AR')}
          ${noche.descuento_anticipada === '1' || noche.descuento_anticipada === 1 ? ' · Con descuento anticipada' : ''}</span><br>
          ${botonBorrar}
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error al listar noches:', error);
    contenedor.innerHTML = '<p style="color:#ef4444;">No se pudo cargar el listado.</p>';
  }
}
async function eliminarNoche(idNoche) {
  // Pedimos confirmación para evitar borrados accidentales
  const confirmar = confirm("¿Estás seguro de que querés borrar esta noche del festival? Esta acción no se puede deshacer.");
  if (!confirmar) return;

  try {
    const respuesta = await fetch('../../controlador/ControladorNoches.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        accion: 'eliminar_noche',
        id: idNoche
      })
    });

    const datos = await respuesta.json();

    if (datos.exito) {
      alert('¡Noche eliminada con éxito!');
      cargarListadoNoches(); // Recargamos el listado visual
    } else {
      alert('No se pudo borrar: ' + datos.mensaje);
    }

  } catch (error) {
    console.error('Error al conectar con el servidor:', error);
    alert('Hubo un problema al intentar eliminar la noche.');
  }
}