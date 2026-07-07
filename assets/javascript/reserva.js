// ──────────────────────────────────────────────
// ESTADO GLOBAL DE LA RESERVA
// ──────────────────────────────────────────────
let sectorActual = null;
let categoriaActual = 'mayores'; // 'mayores' | 'menores' | 'jubilados'
let precioSector = 0;
let butacasSeleccionadas = [];
let totalConfirmadoServidor = null; // total real, verificado por el servidor (no el del navegador)
const LIMITE_BUTACAS = 4;

// Debe coincidir EXACTO con DESCUENTO_CATEGORIA del servidor (ControladorReserva.php)
const DESCUENTO_CATEGORIA = { mayores: 0, menores: 0.30, jubilados: 0.30 };

// Multiplicador de cada sector sobre la tarifa base (igual que en sectores.html)
const MULTIPLICADOR_SECTOR = { 'C': 1, 'B': 1.2, 'A': 1.5 };

// Tarifa base y descuento anticipada de la noche actual (se fijan al cargar,
// pidiéndole los datos reales al servidor — antes venían de una tabla fija)
let precioBaseNocheActual = 12000;
let descuentoAnticipadaActiva = false;

const MESES_LARGOS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_SEMANA = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

/** Convierte "2026-11-20" en "Viernes 20 de Noviembre" */
function formatearFechaLarga(fechaISO) {
  const fechaObj = new Date(fechaISO + 'T00:00:00');
  const diaSemana = DIAS_SEMANA[fechaObj.getDay()];
  const mes = MESES_LARGOS[fechaObj.getMonth()];
  const texto = `${diaSemana} ${fechaObj.getDate()} de ${mes}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Pide al servidor los datos reales de la noche (título, fecha, precio, descuento) */
async function cargarNocheDesdeServidor(nocheId) {
  try {
    const respuesta = await fetch('../../controlador/ControladorNoches.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'obtener_noche', id: nocheId })
    });
    const datos = await respuesta.json();
    return datos.exito ? datos.noche : null;
  } catch (error) {
    console.error('Error al pedir la noche al servidor:', error);
    return null;
  }
}

// ──────────────────────────────────────────────
// PASO 1: SELECCIÓN
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Mostrar la noche correcta según la URL (título, fecha y precio reales)
  const params = new URLSearchParams(window.location.search);
  const nocheId = params.get('noche');

  if (nocheId) {
    const noche = await cargarNocheDesdeServidor(nocheId);

    if (noche) {
      const tituloNocheEl = document.querySelector('.reserva-info-noche h1');
      if (tituloNocheEl) tituloNocheEl.textContent = noche.titulo;

      const fechaNocheEl = document.querySelector('.reserva-info-noche p');
      if (fechaNocheEl) fechaNocheEl.innerHTML = `🗓 ${formatearFechaLarga(noche.fecha)} &nbsp;&nbsp; 📍 Estadio Municipal`;

      precioBaseNocheActual = Number(noche.precio_base);
      descuentoAnticipadaActiva = noche.descuento_anticipada === '1' || noche.descuento_anticipada === 1;

      const tarifaBaseEl = document.getElementById('tarifa-base-monto');
      if (tarifaBaseEl) tarifaBaseEl.textContent = `$ ${precioBaseNocheActual.toLocaleString('es-AR')}`;
    } else {
      alert('No se pudo cargar la información de esta noche.');
    }
  }

  // AHORA SÍ: Buscamos en sessionStorage
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
  
  if (datosSesion) {
    const usuario = JSON.parse(datosSesion);

    const checkoutNombre = document.getElementById('checkout-nombre');
    const checkoutDni = document.getElementById('checkout-dni');
    if (checkoutNombre) checkoutNombre.textContent = usuario.nombre;
    if (checkoutDni) checkoutDni.textContent = usuario.dni || 'Sin DNI';

    const ticketCliente = document.getElementById('ticket-cliente');
    if (ticketCliente) ticketCliente.textContent = `${usuario.nombre} - DNI: ${usuario.dni || 'S/N'}`;
    
  } else {
    const checkoutNombre = document.getElementById('checkout-nombre');
    const checkoutDni = document.getElementById('checkout-dni');
    if (checkoutNombre) checkoutNombre.textContent = 'Consumidor Final';
    if (checkoutDni) checkoutDni.textContent = '00.000.000';
  }
});

// Genera siempre el mismo texto de sector+categoría que se guarda en la BD
// (ver irAPaso2). Así el filtro de "ocupadas" y el cálculo de precio del
// servidor buscan/leen exactamente lo mismo que se insertó en `entradas`.
function obtenerDescripcionSector(letra) {
  const desc = letra === 'A' ? '(Platea VIP)' : letra === 'B' ? '(Platea Media)' : '(General)';
  const categoriaCapitalizada = categoriaActual.charAt(0).toUpperCase() + categoriaActual.slice(1);
  return `${categoriaCapitalizada} - Sector ${letra} ${desc}`;
}

function seleccionarCategoria(categoria, elementoDOM) {
  categoriaActual = categoria;

  // Solo afecta a las tarjetas de categoría, no a las de sector
  document.querySelectorAll('#categoria-container .sector-card').forEach(card => card.classList.remove('active'));
  elementoDOM.classList.add('active');

  // Si ya había un sector elegido, recalculamos el resumen con la nueva categoría
  if (sectorActual) {
    actualizarResumen();
  }
}

async function seleccionarSector(letraSector) {
  // Si había butacas bloqueadas en el servidor del sector anterior, las liberamos
  if (butacasSeleccionadas.length > 0 && sectorActual) {
    const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
    if (datosSesion) {
      const usuario = JSON.parse(datosSesion);
      const tituloNoche = document.querySelector('.reserva-info-noche h1').textContent;
      const sectorAnteriorCompleto = obtenerDescripcionSector(sectorActual);
      await Promise.all(butacasSeleccionadas.map(idButaca =>
        fetch('/PROYECTO%20FOLKLORE/controlador/ControladorReserva.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'toggle_bloqueo',
            titulo_noche: tituloNoche,
            sector: sectorAnteriorCompleto,
            butaca: idButaca,
            usuario_id: usuario.id
          })
        }).catch(() => {})
      ));
    }
  }

  sectorActual = letraSector;
  // Precio unitario = tarifa base de la noche actual × multiplicador del sector
  // (el descuento de categoría se aplica más adelante, sobre el total, en actualizarResumen)
  precioSector = Math.round(precioBaseNocheActual * MULTIPLICADOR_SECTOR[letraSector]);
  butacasSeleccionadas = []; // Reiniciamos selección al cambiar de sector

  // 1. Limpiar UI de clases activas (solo entre las tarjetas de sector, no las de categoría)
  document.querySelectorAll('#sector-container .sector-card').forEach(card => card.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // 2. CORRECCIÓN: Actualizar el subtítulo del bloque 2
  const subtitulo = document.querySelector('.subtitulo-bloque');
  subtitulo.textContent = `Sector ${letraSector} - Fila 1 a 4. Límite: 4 butacas.`;

  // 3. Renderizar mapa (ahora espera la respuesta real del servidor) y limpiar resumen
  document.getElementById('bloque-mapa').style.display = 'block';
  await renderizarMapaButacas();
  actualizarResumen();
}

async function renderizarMapaButacas() {
  const grilla = document.getElementById('grilla-butacas');
  grilla.innerHTML = '';

  // 1. Leemos el título de la noche actual desde el HTML
  const tituloNoche = document.querySelector('.reserva-info-noche h1').textContent;

  // 2. Traemos la lista de asientos ocupados para esta noche y este sector,
  //    consultando directamente al backend (ya no a localStorage).
  const sectorCompleto = obtenerDescripcionSector(sectorActual);
  const ocupadas = await obtenerButacasOcupadasDesdeServidor(tituloNoche, sectorCompleto);

  for (let f = 1; f <= 4; f++) {
    const filaDiv = document.createElement('div');
    filaDiv.className = 'fila-butacas';
    
    // Labels de las filas (izq)
    const labelIzq = document.createElement('span');
    labelIzq.className = 'fila-label';
    labelIzq.textContent = `F${f}`;
    filaDiv.appendChild(labelIzq);
    
    for (let b = 1; b <= 8; b++) {
      // Tu código ya generaba este ID perfecto (ej: "A-F1-B1")
      const idButaca = `${sectorActual}-F${f}-B${b}`; 
      
      const butacaEl = document.createElement('div');
      butacaEl.className = 'butaca';
      butacaEl.textContent = b;
      
      // AGREGAMOS ESTO: El atributo invisible para identificarla
      butacaEl.setAttribute('data-numero', idButaca);

      // ──────────────────────────────────────────────
      // MAGIA: VERIFICAMOS SI ESTÁ OCUPADA AL DIBUJARLA
      // ──────────────────────────────────────────────
      if (ocupadas.includes(idButaca)) {
        // Si está vendida, le clavamos la clase de ocupada y anulamos el clic
        butacaEl.classList.add('butaca-ocupada');
        butacaEl.onclick = null;
        // Pintado gris directo (sin modificar el archivo CSS)
        butacaEl.style.backgroundColor = '#d1d5db';
        butacaEl.style.borderColor = '#9ca3af';
        butacaEl.style.color = '#6b7280';
        butacaEl.style.cursor = 'not-allowed';
        butacaEl.style.opacity = '0.7'; 
      } else {
        // Si está libre, vemos si el usuario la tiene seleccionada ahora mismo
        if (butacasSeleccionadas.includes(idButaca)) {
          butacaEl.classList.add('selected');
        }
        // Le asignamos el clic normal para comprar
        butacaEl.onclick = () => toggleButaca(idButaca, butacaEl);
      }

      filaDiv.appendChild(butacaEl);
    }
    
    // Labels de las filas (der)
    const labelDer = document.createElement('span');
    labelDer.className = 'fila-label';
    labelDer.textContent = `F${f}`;
    filaDiv.appendChild(labelDer);
    
    grilla.appendChild(filaDiv);
  }
}

// --- REEMPLAZAR toggleButaca ---
async function toggleButaca(idButaca, elementoDOM) {
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
  if (!datosSesion) {
    alert("Iniciá sesión para seleccionar butacas.");
    return;
  }
  const usuario = JSON.parse(datosSesion);
  const tituloNoche = document.querySelector('.reserva-info-noche h1').textContent;
  const sectorCompleto = obtenerDescripcionSector(sectorActual);

  const index = butacasSeleccionadas.indexOf(idButaca);

  // Validación de límite antes de contactar al servidor
  if (index === -1 && butacasSeleccionadas.length >= LIMITE_BUTACAS) {
    alert(`El límite es de ${LIMITE_BUTACAS} butacas por compra.`);
    return;
  }

  // Desactivamos el botón temporalmente para que no hagan doble clic rápido
  elementoDOM.style.pointerEvents = 'none';
  elementoDOM.style.opacity = '0.5';

  try {
    const respuesta = await fetch('/PROYECTO%20FOLKLORE/controlador/ControladorReserva.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'toggle_bloqueo',
        titulo_noche: tituloNoche,
        sector: sectorCompleto,
        butaca: idButaca,
        usuario_id: usuario.id
      })
    });

    const resultado = await respuesta.json();

    if (resultado.exito) {
      if (resultado.accion_realizada === 'bloqueada') {
        butacasSeleccionadas.push(idButaca);
        elementoDOM.classList.add('selected');
      } else if (resultado.accion_realizada === 'liberada') {
        butacasSeleccionadas.splice(index, 1);
        elementoDOM.classList.remove('selected');
      }
      actualizarResumen();
    } else {
      // El servidor rechazó el bloqueo (se lo acaba de ganar otro)
      alert(resultado.mensaje);
      elementoDOM.classList.remove('selected');
      elementoDOM.classList.add('butaca-ocupada');
      elementoDOM.style.backgroundColor = '#d1d5db';
      elementoDOM.style.borderColor = '#9ca3af';
      elementoDOM.onclick = null;
    }
  } catch (error) {
    alert("Error de conexión al seleccionar la butaca.");
  } finally {
    // Restauramos el botón
    elementoDOM.style.pointerEvents = 'auto';
    elementoDOM.style.opacity = '1';
  }
}

function actualizarResumen() {
  const vacioUI = document.getElementById('resumen-vacio');
  const llenoUI = document.getElementById('resumen-lleno');
  const listaUI = document.getElementById('lista-resumen');
  
  if (butacasSeleccionadas.length === 0) {
    vacioUI.style.display = 'block';
    llenoUI.style.display = 'none';
    return;
  }

  vacioUI.style.display = 'none';
  llenoUI.style.display = 'block';
  
  // Llenar lista
  listaUI.innerHTML = '';
  butacasSeleccionadas.forEach(id => {
    listaUI.innerHTML += `
      <li class="item-butaca-resumen">
        <span><span class="dot">●</span> ${id}</span>
        <span>$ ${precioSector.toLocaleString('es-AR')}</span>
      </li>
    `;
  });

  // Cálculos (mismo orden que calcularTotalReserva() en el servidor:
  // 1° descuento anticipada -solo si esta noche lo tiene activo-, 2° categoría)
  const subtotal = butacasSeleccionadas.length * precioSector;
  const descuentoAnticipada = descuentoAnticipadaActiva ? subtotal * 0.10 : 0;
  const totalConAnticipada = subtotal - descuentoAnticipada;

  const porcentajeCategoria = DESCUENTO_CATEGORIA[categoriaActual] || 0;
  const descuentoCategoria = totalConAnticipada * porcentajeCategoria;
  const total = totalConAnticipada - descuentoCategoria;

  document.getElementById('txt-subtotal').textContent = `Subtotal (${butacasSeleccionadas.length} entradas)`;
  document.getElementById('monto-subtotal').textContent = `$ ${subtotal.toLocaleString('es-AR')}`;
  document.getElementById('monto-descuento').textContent = `- $ ${descuentoAnticipada.toLocaleString('es-AR')}`;

  const filaAnticipada = document.getElementById('fila-descuento-anticipada');
  filaAnticipada.style.display = descuentoAnticipadaActiva ? 'flex' : 'none';

  const filaCategoria = document.getElementById('fila-descuento-categoria');
  if (porcentajeCategoria > 0) {
    document.getElementById('txt-descuento-categoria').textContent = `Descuento Categoría (${porcentajeCategoria * 100}%)`;
    document.getElementById('monto-descuento-categoria').textContent = `- $ ${descuentoCategoria.toLocaleString('es-AR')}`;
    filaCategoria.style.display = 'flex';
  } else {
    filaCategoria.style.display = 'none';
  }

  document.getElementById('monto-total').textContent = `$ ${total.toLocaleString('es-AR')}`;
}

// ──────────────────────────────────────────────
// NAVEGACIÓN Y PASO 2 / PASO 3
// ──────────────────────────────────────────────
// Extrae solo el texto de la fecha desde el header de la noche
// (ej: "🗓 Viernes 20 de Noviembre  📍 Estadio Municipal" → "Viernes 20 de Noviembre")
function obtenerFechaEventoTexto() {
  const infoNocheP = document.querySelector('.reserva-info-noche p');
  if (!infoNocheP) return '';
  return infoNocheP.textContent.split('📍')[0].replace('🗓', '').trim();
}

function irAPaso2() {
  // Llenar datos de Checkout
  const stringButacas = butacasSeleccionadas.join(', ');
  const totalStr = document.getElementById('monto-total').textContent;
  const tituloNocheActual = document.querySelector('.reserva-info-noche h1').textContent;

  document.getElementById('checkout-titulo-noche').textContent = tituloNocheActual;
  document.getElementById('checkout-butacas').textContent = stringButacas;
  document.getElementById('checkout-sector').textContent = obtenerDescripcionSector(sectorActual);
  document.getElementById('checkout-monto-total').textContent = totalStr;

  document.getElementById('paso-1-seleccion').style.display = 'none';
  document.getElementById('paso-2-checkout').style.display = 'block';
  window.scrollTo(0,0);
}

function volverAPaso1() {
  document.getElementById('paso-2-checkout').style.display = 'none';
  document.getElementById('paso-1-seleccion').style.display = 'block';
}
async function irAPaso3() {
  // 1. Intentamos guardar en la base de datos MySQL mediante PHP (y ahora recibimos el código)
  const codigoGenerado = await guardarEntradaEnBaseDeDatos();
  
  // Si hubo un error (no hay sesión, falló la red, etc.), frenamos aquí
  if (!codigoGenerado) return;

  // 2. Si el servidor respondió con éxito, transferimos datos finales al ticket visible
  document.getElementById('ticket-titulo-noche').textContent = document.getElementById('checkout-titulo-noche').textContent;
  document.getElementById('ticket-fecha-noche').textContent = `${obtenerFechaEventoTexto()} - 20:00 hs`;
  document.getElementById('ticket-sector').textContent = document.getElementById('checkout-sector').textContent;
  document.getElementById('ticket-butacas').textContent = document.getElementById('checkout-butacas').textContent;
  document.getElementById('ticket-monto-total').textContent = totalConfirmadoServidor !== null
    ? `$ ${Number(totalConfirmadoServidor).toLocaleString('es-AR')}`
    : document.getElementById('checkout-monto-total').textContent;
  
  // 3. MAGIA DEL QR: Usamos la API gratuita para generar la imagen al instante
  const qrImagen = document.getElementById('ticket-qr');
  if (qrImagen) {
    qrImagen.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${codigoGenerado}`;
    qrImagen.style.display = 'block';
  }
  
  // También escribimos el código en texto abajo
  const textoCodigo = document.getElementById('ticket-codigo-texto');
  if (textoCodigo) {
    textoCodigo.textContent = codigoGenerado;
  }

  // 4. Hacemos el cambio de pantallas al Paso 3 (Éxito)
  document.getElementById('paso-2-checkout').style.display = 'none';
  document.getElementById('paso-3-exito').style.display = 'block';
  window.scrollTo(0, 0);
}
async function guardarEntradaEnBaseDeDatos() {
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
  if (!datosSesion) {
    alert("Sesión expirada o no iniciada. Por favor, vuelve a iniciar sesión para reservar.");
    window.location.href = 'index.html';
    return false;
  }
  
  const usuario = JSON.parse(datosSesion);
  if (!usuario.id) {
    alert("Error de sesión: No se encontró el ID del usuario. Re-inicia sesión.");
    return false;
  }

  const sectorCompleto = document.getElementById('checkout-sector') ? document.getElementById('checkout-sector').textContent : 'Sector';
  const butacasStr = document.getElementById('checkout-butacas') ? document.getElementById('checkout-butacas').textContent : '';
  const totalStr = document.getElementById('checkout-monto-total') ? document.getElementById('checkout-monto-total').textContent : '$0';
  const tituloNoche = document.querySelector('.reserva-info-noche h1') ? document.querySelector('.reserva-info-noche h1').textContent : 'Noche de Festival';

  // Extraemos solo la parte de la fecha del texto "🗓 Viernes 20 de Noviembre  📍 Estadio Municipal"
  const fechaEvento = obtenerFechaEventoTexto();

  const totalLimpio = parseFloat(totalStr.replace(/[^0-9,.]/g, '').replace('.', '').replace(',', '.'));
  const numFactura = 'FAC-' + Math.floor(Math.random() * 900000 + 100000);

  const facturaEl = document.querySelector('.ticket-factura-info strong');
  if (facturaEl) facturaEl.textContent = numFactura;

  try {
    // RUTA CORREGIDA ACÁ ABAJO:
    const respuesta = await fetch('/PROYECTO%20FOLKLORE/controlador/ControladorReserva.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'crear_reserva',
        usuario_id: usuario.id,
        numero_factura: numFactura,
        titulo_noche: tituloNoche,
        fecha_evento: fechaEvento,
        lugar: 'Único Estadio Municipal',
        sector: sectorCompleto,
        butacas: butacasStr,
        total: totalLimpio
      })
    });

    const resultado = await respuesta.json();

    if (resultado.exito) {
      console.log(resultado.mensaje);
      // Guardamos el total que calculó y verificó el servidor (nunca el del navegador)
      if (typeof resultado.total_real !== 'undefined') {
        totalConfirmadoServidor = resultado.total_real;
      }
      // En vez de true, devolvemos el código (lo usa el QR)
      return resultado.codigo_ticket; 
    } else {
      alert("Error al procesar reserva: " + resultado.mensaje);
      return false;
    }

  } catch (error) {
    console.error("Error al conectar con el servidor de reservas:", error);
    alert("Hubo un problema de conexión para procesar tu ticket.");
    return false;
  }
}
// Consulta real al backend (ControladorReserva.php → accion: 'obtener_ocupadas')
// Reemplaza la antigua versión que leía localStorage/sessionStorage.
// --- REEMPLAZAR obtenerButacasOcupadasDesdeServidor ---
async function obtenerButacasOcupadasDesdeServidor(tituloNoche, sectorCompleto) {
  const datosSesion = sessionStorage.getItem('usuarioLogueado') || sessionStorage.getItem('usuarioActivo');
  if (!datosSesion) return [];
  const usuario = JSON.parse(datosSesion);

  try {
    const respuesta = await fetch('/PROYECTO%20FOLKLORE/controlador/ControladorReserva.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'obtener_ocupadas',
        titulo_noche: tituloNoche,
        sector: sectorCompleto,
        usuario_id: usuario.id // <-- Ahora enviamos quién somos
      })
    });

    const resultado = await respuesta.json();
    if (resultado.exito) {
      return resultado.ocupadas; 
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error al consultar butacas ocupadas:", error);
    return [];
  }
}