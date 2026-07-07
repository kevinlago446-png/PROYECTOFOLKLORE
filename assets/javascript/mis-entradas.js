document.addEventListener('DOMContentLoaded', () => {
  cargarEntradasDesdeServidor();
});

// ──────────────────────────────────────────────
// Pide al backend SOLO las entradas del usuario logueado.
// Si una entrada no existe en la BD, nunca llega aquí,
// por lo que automáticamente no se muestra (se "borra" de la vista).
// ──────────────────────────────────────────────
async function cargarEntradasDesdeServidor() {
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');

  if (!datosSesion) {
    window.location.href = 'index.html';
    return;
  }

  const usuario = JSON.parse(datosSesion);
  if (!usuario.id) {
    renderizarHistorialEntradas([]);
    return;
  }

  try {
    const respuesta = await fetch('/PROYECTO%20FOLKLORE/controlador/ControladorReserva.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'listar_entradas',
        usuario_id: usuario.id
      })
    });

    const resultado = await respuesta.json();

    if (resultado.exito) {
      renderizarHistorialEntradas(resultado.entradas);
    } else {
      console.error("No se pudieron cargar las entradas:", resultado.mensaje);
      renderizarHistorialEntradas([]);
    }

  } catch (error) {
    console.error("Error al conectar con el servidor:", error);
    renderizarHistorialEntradas([]);
  }
}

function renderizarHistorialEntradas(historial) {
  const seccionVacia = document.getElementById('seccionVacia');
  const seccionEntradas = document.getElementById('seccionEntradas');
  const listaEntradas = document.getElementById('listaEntradas');
  const contador = document.getElementById('contador-entradas');

  contador.textContent = `(${historial.length})`;

  if (historial.length === 0) {
    seccionVacia.style.display = 'block';
    seccionEntradas.style.display = 'none';
    return;
  }

  seccionVacia.style.display = 'none';
  seccionEntradas.style.display = 'flex';
  listaEntradas.innerHTML = '';

  // El backend ya devuelve lo más reciente primero (ORDER BY id DESC),
  // así que no hace falta invertir el array acá.
  historial.forEach(entrada => {
    const card = document.createElement('div');
    card.className = 'entrada-historial-card';

    // Convertimos el objeto en un string seguro para pasarlo al onclick
    const entradaData = encodeURIComponent(JSON.stringify(entrada));

    card.innerHTML = `
      <div class="entrada-card-header">
        <span class="comprobante-txt">COMPROBANTE ${entrada.factura}</span>
        <span class="sector-badge">${entrada.sector.split(' ')[0]}</span>
      </div>
      <h3 class="entrada-card-titulo">${entrada.titulo}</h3>
      
      <div class="entrada-card-detalles">
        ${entrada.fechaEvento ? `<p>📅 ${entrada.fechaEvento}</p>` : ''}
        <p>📍 ${entrada.lugar} - Butacas: ${entrada.butacas}</p>
        <p>💳 Pagado Contado Efectivo: ${entrada.total}</p>
      </div>

      <button class="btn-ver-factura" onclick="abrirFactura('${entradaData}')">
        👁 Ver Entrada / Factura
      </button>
    `;
    listaEntradas.appendChild(card);
  });
}

function abrirFactura(entradaDataCodificada) {
  const entrada = JSON.parse(decodeURIComponent(entradaDataCodificada));

  // Llenamos el modal con los datos
  document.getElementById('modal-titulo').textContent = entrada.titulo;
  document.getElementById('modal-factura').textContent = entrada.factura;
  document.getElementById('modal-lugar').textContent = entrada.lugar;
  document.getElementById('modal-sector').textContent = entrada.sector;
  document.getElementById('modal-butacas').textContent = entrada.butacas;
  document.getElementById('modal-total').textContent = entrada.total;
  document.getElementById('modal-emision').textContent = entrada.fechaEmision;

  // Usamos la sesión real (sessionStorage), igual que en el resto del sitio
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
  if (datosSesion) {
    const usuario = JSON.parse(datosSesion);
    document.getElementById('modal-cliente').textContent = `${usuario.nombre} - DNI: ${usuario.dni || 'S/N'}`;
  } else {
    document.getElementById('modal-cliente').textContent = `Consumidor Final`;
  }

  // MAGIA DEL QR: Inyectamos el código en la imagen
  const qrImagen = document.getElementById('modal-qr');
  const codigoTexto = document.getElementById('modal-codigo-texto');

  if (entrada.codigo_ticket) {
    qrImagen.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${entrada.codigo_ticket}`;
    qrImagen.style.display = 'block';
    codigoTexto.textContent = entrada.codigo_ticket;
  } else {
    // Por si es una entrada muy vieja que se compró antes de inventar el QR
    qrImagen.style.display = 'none';
    codigoTexto.textContent = "TICKET ANTIGUO SIN QR";
  }
  // Llenar las etiquetas de color
  const bPago = document.getElementById('modal-badge-pago');
  if (entrada.estado_pago === 'pagado') {
    bPago.textContent = '✅ Abonada';
    bPago.style.background = '#dcfce7'; bPago.style.color = '#166534';
  } else {
    bPago.textContent = '⏳ Pendiente de Pago';
    bPago.style.background = '#fef08a'; bPago.style.color = '#854d0e';
  }

  const bEstado = document.getElementById('modal-badge-estado');
  if (entrada.estado_ticket === 'usado') {
    bEstado.textContent = '🎟️ Entrada Usada';
    bEstado.style.background = '#fee2e2'; bEstado.style.color = '#991b1b';
  } else {
    bEstado.textContent = '🎟️ Entrada Válida';
    bEstado.style.background = '#d1fae5'; bEstado.style.color = '#065f46';
  }
  // Mostramos el modal
  document.getElementById('modalFactura').style.display = 'flex';
}

function cerrarFactura() {
  document.getElementById('modalFactura').style.display = 'none';
}