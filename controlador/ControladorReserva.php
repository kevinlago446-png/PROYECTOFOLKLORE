<?php
/**
 * RAÍCES TICKETS — Controlador de Reservas
 * Archivo: controlador/ControladorReserva.php
 */

// La sesión PHP (creada en el login) es la fuente real de identidad.
session_start();

// Configurar cabeceras para responder en formato JSON limpio
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Evitar mostrar errores HTML que rompan el JSON, pero registrarlos en el servidor
ini_set('display_errors', 0);
error_reporting(E_ALL);

/**
 * Corta la ejecución si no hay una sesión de login real.
 * Devuelve el usuario_id REAL (nunca el que mande el JS).
 */
function exigirSesion(): int {
    if (empty($_SESSION['usuario_id'])) {
        echo json_encode(["exito" => false, "mensaje" => "Tu sesión expiró. Volvé a iniciar sesión."]);
        exit;
    }
    return (int) $_SESSION['usuario_id'];
}

/**
 * Corta la ejecución si el rol de la sesión no está en la lista permitida.
 * Para usar en operaciones de portero/admin.
 */
function exigirRol(array $rolesPermitidos): void {
    if (empty($_SESSION['usuario_rol']) || !in_array($_SESSION['usuario_rol'], $rolesPermitidos, true)) {
        echo json_encode(["exito" => false, "mensaje" => "Acceso restringido al personal autorizado."]);
        exit;
    }
}

// ─────────────────────────────────────────────
// TABLA DE PRECIOS OFICIAL — única fuente de verdad.
// El total de una reserva SIEMPRE se calcula acá; el total que mande
// el navegador se ignora por completo (nunca se usa para guardar en la BD).
// El precio base y si tiene descuento anticipada ahora vienen de la
// tabla `noches` (cargada desde el panel admin), no de un array fijo.
// ─────────────────────────────────────────────

// Multiplicador de cada sector sobre la tarifa base (igual que en sectores.html)
const MULTIPLICADOR_SECTOR = ['C' => 1, 'B' => 1.2, 'A' => 1.5];

// Descuento adicional por categoría de público, sobre el precio ya con
// el descuento anticipada aplicado -si esa noche lo tiene- (menores y jubilados)
const DESCUENTO_CATEGORIA = [
    'mayores'   => 0,
    'menores'   => 0.30,
    'jubilados' => 0.30,
];

const PORCENTAJE_DESCUENTO_ANTICIPADA = 0.10;

/**
 * Calcula el total REAL de una reserva (precio_base_noche × multiplicador_sector
 * × cantidad_butacas, con descuento anticipada -si la noche lo tiene activo-
 * + descuento de categoría). Lanza una excepción si la noche o el sector no son válidos.
 */
function calcularTotalReserva(PDO $pdo, string $tituloNoche, string $sectorLetra, int $cantidadButacas, string $categoria): float {
    $stmtNoche = $pdo->prepare('SELECT precio_base, descuento_anticipada FROM noches WHERE titulo = ? LIMIT 1');
    $stmtNoche->execute([$tituloNoche]);
    $noche = $stmtNoche->fetch();

    if (!$noche) {
        throw new InvalidArgumentException('Noche desconocida: ' . $tituloNoche);
    }
    if (!isset(MULTIPLICADOR_SECTOR[$sectorLetra])) {
        throw new InvalidArgumentException('Sector desconocido: ' . $sectorLetra);
    }
    if ($cantidadButacas < 1) {
        throw new InvalidArgumentException('Cantidad de butacas inválida.');
    }

    $categoria = strtolower($categoria);
    if (!isset(DESCUENTO_CATEGORIA[$categoria])) {
        $categoria = 'mayores'; // valor seguro por defecto
    }

    $precioUnitario = ((float) $noche['precio_base']) * MULTIPLICADOR_SECTOR[$sectorLetra];
    $subtotal = $precioUnitario * $cantidadButacas;

    if ((int) $noche['descuento_anticipada'] === 1) {
        $subtotal -= $subtotal * PORCENTAJE_DESCUENTO_ANTICIPADA;
    }
    $subtotal -= $subtotal * DESCUENTO_CATEGORIA[$categoria];  // 30% menores/jubilados (si aplica)

    return round($subtotal, 2);
}

/**
 * Extrae la letra de sector y la categoría desde el texto que ya viajaba
 * en 'sector' (ej: "Mayores - Sector A (Platea VIP)"). Hoy siempre es
 * "Mayores" porque la UI todavía no tiene selector de categoría.
 */
function parsearSectorYCategoria(string $textoSector): array {
    $categoria = 'mayores';
    $letra = null;

    if (preg_match('/^([^-]+)-/u', $textoSector, $m)) {
        $categoria = strtolower(trim($m[1]));
    }
    if (preg_match('/Sector\s+([ABC])/u', $textoSector, $m)) {
        $letra = $m[1];
    }
    return [$letra, $categoria];
}

// ─────────────────────────────────────────────
// TABLA OFICIAL DE PRECIOS — única fuente de verdad del lado del servidor.
// Tarifa "Mayores" en Sector C (base) por noche. Sector B = +20%, Sector A = +50%.
// (Si en el futuro se agrega categoría Menor/Jubilado, va un multiplicador más acá: 0.70)
// ─────────────────────────────────────────────
const PRECIOS_BASE_POR_NOCHE = [
    'Noche 1: Gran Apertura'  => 12000,
    'Noche 2: Pura Tradición'  => 15000,
    'Noche 3: Voces Jóvenes'   => 18000,
    'Noche 4: Fiesta Norteña'  => 12000,
    'Noche 5: Cierre de Oro'   => 15000,
];

const MULTIPLICADOR_SECTOR = ['C' => 1, 'B' => 1.2, 'A' => 1.5];

const DESCUENTO_ANTICIPADA = 0.10; // 10%, igual al que ya muestra el frontend

/**
 * Recalcula el precio real de una reserva en el servidor, ignorando
 * cualquier monto que haya mandado el navegador.
 * Devuelve el total correcto, o lanza una excepción si los datos no son válidos.
 */
function calcularPrecioReal(string $tituloNoche, string $sectorTexto, string $butacasStr): float {
    $tituloNoche = trim($tituloNoche);
    if (!array_key_exists($tituloNoche, PRECIOS_BASE_POR_NOCHE)) {
        throw new InvalidArgumentException("Noche del festival no reconocida.");
    }

    // El texto de sector llega como "Mayores - Sector A (Platea VIP)"; extraemos la letra.
    if (!preg_match('/Sector\s+([ABC])/', $sectorTexto, $m)) {
        throw new InvalidArgumentException("Sector no reconocido.");
    }
    $letraSector = $m[1];

    $cantidadButacas = count(array_filter(array_map('trim', explode(',', $butacasStr))));
    if ($cantidadButacas < 1) {
        throw new InvalidArgumentException("No se especificaron butacas válidas.");
    }

    $precioBase   = PRECIOS_BASE_POR_NOCHE[$tituloNoche];
    $multiplicador = MULTIPLICADOR_SECTOR[$letraSector];

    $subtotal  = $precioBase * $multiplicador * $cantidadButacas;
    $descuento = $subtotal * DESCUENTO_ANTICIPADA;

    return round($subtotal - $descuento, 2);
}

// 1. Conexión a la Base de Datos
$host = "localhost";
$dbname = "folklore2026";
$username = "root";
$password = ""; // Cambia esto si tu MySQL tiene contraseña

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    echo json_encode(["exito" => false, "mensaje" => "Error de conexión de BD: " . $e->getMessage()]);
    exit;
}

// 2. Leer los datos enviados por JavaScript
$jsonInput = file_get_contents("php://input");
$datos = json_decode($jsonInput, true);

if (!$datos || !isset($datos['accion'])) {
    echo json_encode(["exito" => false, "mensaje" => "Petición no válida o faltan datos."]);
    exit;
}

$accion = $datos['accion'];

// 3. Manejar Acciones

// MAGIA: Antes de cualquier acción, borramos automáticamente los bloqueos vencidos
// Así no necesitas tareas programadas ni nada complejo.
$pdo->exec("DELETE FROM bloqueos_temporales WHERE fecha_expiracion < NOW()");

switch ($accion) {
    
    // ACCIÓN NUEVA: BLOQUEAR O DESBLOQUEAR UNA BUTACA TEMPORALMENTE
    case 'toggle_bloqueo':
        $usuarioIdReal = exigirSesion();

        if (empty($datos['titulo_noche']) || empty($datos['sector']) || empty($datos['butaca'])) {
            echo json_encode(["exito" => false, "mensaje" => "Faltan datos para el bloqueo."]);
            exit;
        }

        // La butaca es física: la categoría (Mayores/Menores/Jubilados) no debe
        // afectar si está ocupada o no. Usamos la letra real del sector para
        // comparar, sin importar qué categoría haya elegido cada comprador.
        [$sectorLetraBloqueo, ] = parsearSectorYCategoria($datos['sector']);
        if (!$sectorLetraBloqueo) {
            echo json_encode(["exito" => false, "mensaje" => "No se pudo determinar el sector."]);
            exit;
        }

        try {
            // 1. Verificar si ya fue comprada por alguien (en la tabla principal).
            //    Solo por noche + butaca: el texto de 'sector' puede variar por categoría.
            $sqlVendidas = "SELECT * FROM entradas WHERE titulo_noche = ? AND butacas LIKE ?";
            $stmtVendidas = $pdo->prepare($sqlVendidas);
            // Usamos LIKE para buscar la butaca dentro del texto "A-F1-B1, A-F1-B2"
            $stmtVendidas->execute([$datos['titulo_noche'], '%' . $datos['butaca'] . '%']);
            if ($stmtVendidas->fetch()) {
                echo json_encode(["exito" => false, "mensaje" => "¡Uy! Alguien acaba de comprar esta butaca."]);
                exit;
            }

            // 2. Revisar si está en la tabla de bloqueos temporales (guardamos la letra física)
            $stmtBloqueo = $pdo->prepare("SELECT * FROM bloqueos_temporales WHERE titulo_noche = ? AND sector = ? AND butaca = ?");
            $stmtBloqueo->execute([$datos['titulo_noche'], $sectorLetraBloqueo, $datos['butaca']]);
            $bloqueo = $stmtBloqueo->fetch();

            if ($bloqueo) {
                if ($bloqueo['usuario_id'] == $usuarioIdReal) {
                    // El bloqueo es MÍO. Significa que le volví a hacer clic para deseleccionarla.
                    $del = $pdo->prepare("DELETE FROM bloqueos_temporales WHERE id = ?");
                    $del->execute([$bloqueo['id']]);
                    echo json_encode(["exito" => true, "accion_realizada" => "liberada"]);
                } else {
                    // El bloqueo es de OTRO.
                    echo json_encode(["exito" => false, "mensaje" => "Esta butaca está siendo reservada por otra persona ahora mismo."]);
                }
            } else {
                // Antes de bloquear una butaca nueva, chequeamos cuántas tiene
                // ESTE usuario ya bloqueadas para esta noche (sin confiar en el
                // contador de JS, que se resetea al cambiar de sector).
                $stmtConteo = $pdo->prepare("SELECT COUNT(*) AS total FROM bloqueos_temporales WHERE titulo_noche = ? AND usuario_id = ?");
                $stmtConteo->execute([$datos['titulo_noche'], $usuarioIdReal]);
                $conteo = (int) $stmtConteo->fetch()['total'];

                if ($conteo >= 4) {
                    echo json_encode(["exito" => false, "mensaje" => "Ya tenés el máximo de 4 butacas bloqueadas para esta noche. Liberá alguna antes de elegir otra."]);
                    exit;
                }

                // Está 100% libre y no superaste el límite. La bloqueo para mí por 5 MINUTOS.
                $ins = $pdo->prepare("INSERT INTO bloqueos_temporales (titulo_noche, sector, butaca, usuario_id, fecha_expiracion) 
                                      VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))");
                $ins->execute([$datos['titulo_noche'], $sectorLetraBloqueo, $datos['butaca'], $usuarioIdReal]);
                echo json_encode(["exito" => true, "accion_realizada" => "bloqueada"]);
            }
        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error al bloquear: " . $e->getMessage()]);
        }
        break;

// ACCIÓN A: GUARDAR UNA NUEVA RESERVA (COMPRA)
    case 'crear_reserva':
        $usuarioIdReal = exigirSesion();

        if (empty($datos['numero_factura']) || empty($datos['titulo_noche']) || empty($datos['sector']) || empty($datos['butacas'])) {
            echo json_encode(["exito" => false, "mensaje" => "Faltan campos obligatorios para registrar la reserva."]);
            exit;
        }

        // Cantidad real de butacas: se cuenta del propio string "A-F1-B1, A-F1-B2",
        // nunca de un número que mande el cliente aparte.
        $listaButacas = array_filter(array_map('trim', explode(',', $datos['butacas'])));
        $cantidadButacas = count($listaButacas);

        [$sectorLetra, $categoria] = parsearSectorYCategoria($datos['sector']);

        if (!$sectorLetra) {
            echo json_encode(["exito" => false, "mensaje" => "No se pudo determinar el sector de la reserva."]);
            exit;
        }

        try {
            // El total SIEMPRE se calcula acá. El que mande el navegador se ignora por completo.
            $totalReal = calcularTotalReserva($pdo, $datos['titulo_noche'], $sectorLetra, $cantidadButacas, $categoria);
        } catch (InvalidArgumentException $e) {
            echo json_encode(["exito" => false, "mensaje" => "No se pudo calcular el precio: " . $e->getMessage()]);
            exit;
        }

        try {
            // MAGIA: Generamos un código único oficial en el servidor
            $codigoUnico = uniqid('RT-');

            // Insertamos la reserva incluyendo el codigo_ticket y poniéndolo como 'valido'
            $sql = "INSERT INTO entradas (usuario_id, numero_factura, codigo_ticket, estado_ticket, titulo_noche, fecha_evento, lugar, sector, butacas, total) 
                    VALUES (:usuario_id, :numero_factura, :codigo_ticket, 'valido', :titulo_noche, :fecha_evento, :lugar, :sector, :butacas, :total)";
            $stmt = $pdo->prepare($sql);
            $lugarDefault = !empty($datos['lugar']) ? $datos['lugar'] : "Único Estadio Municipal";
            
            $stmt->execute([
                ':usuario_id'     => $usuarioIdReal,
                ':numero_factura' => $datos['numero_factura'],
                ':codigo_ticket'  => $codigoUnico, // Acá guardamos el código en MySQL
                ':titulo_noche'   => $datos['titulo_noche'],
                ':fecha_evento'   => $datos['fecha_evento'] ?? '',
                ':lugar'          => $lugarDefault,
                ':sector'         => $datos['sector'],
                ':butacas'        => $datos['butacas'], 
                ':total'          => $totalReal
            ]);

            // Como la compra se completó, liberamos la "sala de espera" borrando los bloqueos
            $delBloqueos = $pdo->prepare("DELETE FROM bloqueos_temporales WHERE usuario_id = ?");
            $delBloqueos->execute([$usuarioIdReal]);

            // Le respondemos al JavaScript y le pasamos el código oficial + el total ya verificado
            echo json_encode([
                "exito" => true, 
                "mensaje" => "¡Reserva guardada!", 
                "id_reserva" => $pdo->lastInsertId(),
                "codigo_ticket" => $codigoUnico,
                "total_real" => $totalReal
            ]);

        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error al insertar en la BD: " . $e->getMessage()]);
        }
        break;

    // ACCIÓN B: OBTENER BUTACAS OCUPADAS Y BLOQUEADAS
    case 'obtener_ocupadas':
        $usuarioIdReal = exigirSesion();

        if (empty($datos['titulo_noche']) || empty($datos['sector'])) {
            echo json_encode(["exito" => false, "mensaje" => "Faltan datos de la noche o sector."]);
            exit;
        }

        // La butaca es física: no debe importar qué categoría eligió cada
        // comprador. Usamos la letra real del sector para los bloqueos.
        [$sectorLetraConsulta, ] = parsearSectorYCategoria($datos['sector']);

        try {
            $listaOcupadas = [];

            // 1. Buscar las ya VENDIDAS en entradas (toda la noche; el ID de butaca
            //    ya incluye la letra de sector, ej. "A-F1-B3", así que no hace
            //    falta filtrar por el texto de sector con categoría)
            $sqlVendidas = "SELECT butacas FROM entradas WHERE titulo_noche = ?";
            $stmtVendidas = $pdo->prepare($sqlVendidas);
            $stmtVendidas->execute([$datos['titulo_noche']]);
            $resultadosVendidas = $stmtVendidas->fetchAll();
            
            foreach ($resultadosVendidas as $fila) {
                $asientos = explode(",", $fila['butacas']);
                foreach ($asientos as $asiento) {
                    $itemLimpio = trim($asiento);
                    if (!empty($itemLimpio)) $listaOcupadas[] = $itemLimpio;
                }
            }

            // 2. Buscar las BLOQUEADAS por OTROS usuarios en este sector físico
            $sqlBloqueadas = "SELECT butaca FROM bloqueos_temporales WHERE titulo_noche = ? AND sector = ? AND usuario_id != ?";
            $stmtBloqueadas = $pdo->prepare($sqlBloqueadas);
            $stmtBloqueadas->execute([$datos['titulo_noche'], $sectorLetraConsulta, $usuarioIdReal]);
            $resultadosBloqueadas = $stmtBloqueadas->fetchAll();

            foreach ($resultadosBloqueadas as $fila) {
                $listaOcupadas[] = $fila['butaca'];
            }

            echo json_encode(["exito" => true, "ocupadas" => $listaOcupadas]);

        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error al consultar ocupación: " . $e->getMessage()]);
        }
        break;

case 'listar_entradas':
        $usuarioIdReal = exigirSesion();
        try {
            $sql = "SELECT * FROM entradas WHERE usuario_id = :usuario_id ORDER BY id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':usuario_id' => $usuarioIdReal]);
            
            $entradas = array_map(function ($fila) {
                return [
                    'factura'      => $fila['numero_factura'],
                    'codigo_ticket'=> $fila['codigo_ticket'] ?? '', 
                    'estado_ticket'=> $fila['estado_ticket'] ?? 'valido', // NUEVO
                    'estado_pago'  => $fila['estado_pago'] ?? 'pendiente', // NUEVO
                    'titulo'       => $fila['titulo_noche'],
                    'fechaEvento'  => $fila['fecha_evento'] ?? '',
                    'lugar'        => $fila['lugar'],
                    'sector'       => $fila['sector'],
                    'butacas'      => $fila['butacas'],
                    'total'        => '$ ' . number_format((float) $fila['total'], 0, ',', '.'),
                    'fechaEmision' => $fila['fecha_emision'] ?? '',
                ];
            }, $stmt->fetchAll());
            echo json_encode(["exito" => true, "entradas" => $entradas]);
        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error: " . $e->getMessage()]);
        }
        break;
    // ACCIÓN NUEVA: EL PORTERO ESCANEA UN TICKET
// EL PORTERO ESCANEA EL QR (Solo lee, no modifica nada todavía)
    case 'portero_leer_ticket':
        exigirRol(['vendedor', 'admin']);
        try {
            $stmt = $pdo->prepare("SELECT * FROM entradas WHERE codigo_ticket = ?");
            $stmt->execute([$datos['codigo_ticket']]);
            $ticket = $stmt->fetch();

            if (!$ticket) {
                echo json_encode(["exito" => false, "mensaje" => "❌ CÓDIGO NO ENCONTRADO."]);
            } else {
                echo json_encode([
                    "exito" => true,
                    "ticket" => [
                        "id" => $ticket['id'],
                        "estado_ticket" => $ticket['estado_ticket'],
                        "estado_pago" => $ticket['estado_pago'],
                        "noche" => $ticket['titulo_noche'],
                        "sector" => $ticket['sector'],
                        "butacas" => $ticket['butacas'],
                        "total" => '$ ' . number_format((float) $ticket['total'], 0, ',', '.')
                    ]
                ]);
            }
        } catch (PDOException $e) { echo json_encode(["exito" => false]); }
        break;

    // EL PORTERO HACE CLIC EN "COBRAR" O "MARCAR INGRESO"
    case 'portero_accion_ticket':
        exigirRol(['vendedor', 'admin']);
        try {
            $id = $datos['ticket_id'];
            if ($datos['tipo_accion'] === 'cobrar') {
                $pdo->prepare("UPDATE entradas SET estado_pago = 'pagado' WHERE id = ?")->execute([$id]);
                echo json_encode(["exito" => true, "mensaje" => "Pago registrado."]);
            } else if ($datos['tipo_accion'] === 'ingresar') {
                $pdo->prepare("UPDATE entradas SET estado_ticket = 'usado' WHERE id = ?")->execute([$id]);
                echo json_encode(["exito" => true, "mensaje" => "Ingreso registrado."]);
            }
        } catch (PDOException $e) { echo json_encode(["exito" => false]); }
        break;
    default:
        echo json_encode(["exito" => false, "mensaje" => "Acción desconocida."]);
        break;
}