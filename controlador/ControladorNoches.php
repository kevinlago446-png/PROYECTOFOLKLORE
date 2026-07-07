<?php
/**
 * RAÍCES TICKETS — Controlador de Noches
 * Archivo: controlador/ControladorNoches.php
 */

session_start();

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

ini_set('display_errors', 0);
error_reporting(E_ALL);

$host = "localhost";
$dbname = "folklore2026";
$username = "root";
$password = "";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    echo json_encode(["exito" => false, "mensaje" => "Error de conexión de BD: " . $e->getMessage()]);
    exit;
}

function exigirAdmin(): void {
    if (empty($_SESSION['usuario_rol']) || !in_array($_SESSION['usuario_rol'], ['admin', 'superadmin'])) {
        echo json_encode(["exito" => false, "mensaje" => "Acceso restringido al personal autorizado."]);
        exit;
    }
}
/** Permite borrar noches SOLO al superadmin */
function exigirSuperAdmin(): void {
    if (empty($_SESSION['usuario_rol']) || $_SESSION['usuario_rol'] !== 'superadmin') {
        echo json_encode(["exito" => false, "mensaje" => "Acceso restringido. Se requieren permisos de Super Administrador."]);
        exit;
    }
}


$jsonInput = file_get_contents("php://input");
$datos = json_decode($jsonInput, true);

if (!$datos || !isset($datos['accion'])) {
    echo json_encode(["exito" => false, "mensaje" => "Petición no válida o faltan datos."]);
    exit;
}
error_log('SESSION en Noches: ' . print_r($_SESSION, true));
switch ($datos['accion']) {
    
    // ACCIÓN: EL ADMIN CARGA UNA NOCHE NUEVA
    case 'crear_noche':
        exigirAdmin();

        $titulo    = trim($datos['titulo'] ?? '');
        $fecha     = trim($datos['fecha'] ?? '');
        $horario   = trim($datos['horario'] ?? '');
        $artistas  = trim($datos['artistas'] ?? '');
        $precioBase = $datos['precio_base'] ?? null;
        $descuentoAnticipada = !empty($datos['descuento_anticipada']) ? 1 : 0;

        if (empty($titulo) || empty($fecha) || empty($horario) || empty($artistas) || !is_numeric($precioBase) || $precioBase <= 0) {
            echo json_encode(["exito" => false, "mensaje" => "Completá todos los campos correctamente."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO noches (titulo, fecha, horario, artistas, precio_base, descuento_anticipada)
                                   VALUES (:titulo, :fecha, :horario, :artistas, :precio_base, :descuento_anticipada)");
            $stmt->execute([
                ':titulo'    => $titulo,
                ':fecha'     => $fecha,
                ':horario'   => $horario,
                ':artistas'  => $artistas,
                ':precio_base' => floatval($precioBase),
                ':descuento_anticipada' => $descuentoAnticipada
            ]);
            echo json_encode(["exito" => true, "mensaje" => "Noche cargada con éxito.", "id" => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error al guardar: " . $e->getMessage()]);
        }
        break;

    // ACCIÓN: LISTAR TODAS LAS NOCHES (lo usa la grilla pública y el panel admin)
    case 'listar_noches':
        try {
            $stmt = $pdo->query("SELECT * FROM noches ORDER BY fecha ASC");
            echo json_encode(["exito" => true, "noches" => $stmt->fetchAll()]);
        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error al listar: " . $e->getMessage()]);
        }
        break;

    // ACCIÓN: OBTENER UNA NOCHE PUNTUAL (lo usa la pantalla de reserva)
    case 'obtener_noche':
        if (empty($datos['id'])) {
            echo json_encode(["exito" => false, "mensaje" => "Falta el id de la noche."]);
            exit;
        }
        try {
            $stmt = $pdo->prepare("SELECT * FROM noches WHERE id = ?");
            $stmt->execute([intval($datos['id'])]);
            $noche = $stmt->fetch();

            if (!$noche) {
                echo json_encode(["exito" => false, "mensaje" => "Esa noche no existe."]);
                exit;
            }
            echo json_encode(["exito" => true, "noche" => $noche]);
        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error al consultar: " . $e->getMessage()]);
        }
        break;
    case 'eliminar_noche':
        exigirSuperAdmin(); // Verifica que el rol sea exactamente 'superadmin'
        
        if (empty($datos['id'])) {
            echo json_encode(["exito" => false, "mensaje" => "Falta el id de la noche a eliminar."]);
            exit;
        }
        
        try {
            $stmt = $pdo->prepare("DELETE FROM noches WHERE id = ?");
            $stmt->execute([intval($datos['id'])]);
            echo json_encode(["exito" => true, "mensaje" => "Noche eliminada correctamente."]);
        } catch (PDOException $e) {
            echo json_encode(["exito" => false, "mensaje" => "Error al eliminar: " . $e->getMessage()]);
        }
        break;
    default:
        echo json_encode(["exito" => false, "mensaje" => "Acción desconocida."]);
        break;
}