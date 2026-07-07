<?php
/**
 * RAÍCES TICKETS — Controlador de Autenticación
 * Archivo: controlador/ControladorAuth.php
 */

// La sesión PHP es la fuente real de verdad de "quién está logueado".
// A partir de ahora, el backend NO confía en el usuario_id que manda el JS.

session_start();

// DEBUG TEMPORAL
header("Access-Control-Allow-Origin: *");
error_log("SESSION ID: " . session_id());
error_log("SESSION DATA: " . print_r($_SESSION, true));
error_log("ACCION: " . (json_decode(file_get_contents('php://input'), true)['accion'] ?? 'ninguna'));


// Cabeceras para responder en formato JSON de forma correcta
header("Content-Type: application/json; charset=UTF-8");

// ─────────────────────────────────────────────
// Configuración de conexión a base de datos
// ─────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'folklore2026');
define('DB_USER', 'root');
define('DB_PASS', '');

/**
 * Devuelve una conexión PDO a la base de datos.
 */
function obtenerConexion(): PDO {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8';
    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

/**
 * Helper para responder al Frontend en formato JSON estructurado
 */
function respuestaJSON(bool $exito, string $mensaje, array $datos = []): void {
    echo json_encode([
        'exito' => $exito,
        'mensaje' => $mensaje,
        'usuario' => $datos // JavaScript espera leer datos.usuario
    ]);
    exit;
}

// ─────────────────────────────────────────────
// Configuración de envío de correo (2FA) — Gmail SMTP + PHPMailer
// COMPLETAR con tu cuenta y la "contraseña de aplicación" de 16 caracteres
// (no la contraseña normal de Gmail).
// ─────────────────────────────────────────────
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_USERNAME', 'raicestickets@gmail.com');      // <-- COMPLETAR
define('SMTP_PASSWORD', 'bahn esft cvfj ulut');       // <-- COMPLETAR (contraseña de aplicación)
define('SMTP_PORT', 587);
define('SMTP_FROM_NAME', 'Raíces Tickets');

require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

/**
 * Genera un código de 6 dígitos, lo guarda en la BD con vencimiento (10 min)
 * y lo manda por correo. Devuelve true/false según si se pudo enviar.
 */
function generarYEnviarCodigo2FA(PDO $pdo, int $usuarioId, string $email, string $nombre): bool {
    $codigo = strval(random_int(100000, 999999));

    $upd = $pdo->prepare('UPDATE usuarios SET codigo_2fa = :codigo, codigo_2fa_expira = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = :id');
    $upd->execute([':codigo' => $codigo, ':id' => $usuarioId]);

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USERNAME;
        $mail->Password   = SMTP_PASSWORD;
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom(SMTP_USERNAME, SMTP_FROM_NAME);
        $mail->addAddress($email, $nombre);

        $mail->isHTML(true);
        $mail->Subject = 'Tu código de verificación — Raíces Tickets';
        $mail->Body    = "Hola {$nombre},<br><br>Tu código de verificación es:<br>"
                        . "<h2 style='letter-spacing:4px;'>{$codigo}</h2>"
                        . "Vence en 10 minutos. Si no fuiste vos, ignorá este correo.";

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('Error enviando código 2FA: ' . $mail->ErrorInfo);
        return false;
    }
}

// 1. Capturamos los datos en formato JSON crudo enviados por el JavaScript (fetch)
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    respuestaJSON(false, 'No se recibieron datos válidos en el servidor.');
}

$accion = $data['accion'] ?? '';

// ─────────────────────────────────────────────
// ACCIÓN: REGISTRO DE USUARIOS
// ─────────────────────────────────────────────
if ($accion === 'registro') {
    $nombre   = trim($data['nombre'] ?? '');
    $dni      = trim($data['dni'] ?? '');
    $telefono = trim($data['telefono'] ?? '');
    $email    = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($nombre) || empty($dni) || empty($email) || empty($password)) {
        respuestaJSON(false, 'Por favor, completá todos los campos obligatorios.');
    }
    if (strlen($password) < 8) {
        respuestaJSON(false, 'La contraseña debe tener al menos 8 caracteres.');
    }

    try {
        $pdo = obtenerConexion();

        // 1. Verificar si el correo ya existe en la Base de Datos
        $check = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email LIMIT 1');
        $check->execute([':email' => $email]);
        if ($check->fetch()) {
            respuestaJSON(false, 'El correo electrónico ya está registrado.');
        }

        // 2. Encriptamos la contraseña con BCRYPT antes de guardarla
        $hash = password_hash($password, PASSWORD_BCRYPT);

        // 3. Insertar el usuario real en MySQL
        $ins = $pdo->prepare('
            INSERT INTO usuarios (nombre, dni, telefono, email, password_hash, rol, activo)
            VALUES (:nombre, :dni, :telefono, :email, :hash, "usuario", 1)
        ');
        
        $ins->execute([
            ':nombre'   => $nombre,
            ':dni'      => $dni,
            ':telefono' => $telefono,
            ':email'    => $email,
            ':hash'     => $hash,
        ]);

        respuestaJSON(true, '¡Registro completado con éxito!');

    } catch (PDOException $e) {
        respuestaJSON(false, 'Error crítico en la Base de Datos: ' . $e->getMessage());
    }
}

// ─────────────────────────────────────────────
// ACCIÓN: LOGIN DE USUARIOS
// ─────────────────────────────────────────────
if ($accion === 'login') {
    $email    = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        respuestaJSON(false, 'Debés ingresar tu correo y contraseña.');
    }

    try {
        $pdo = obtenerConexion();

        // 1. Buscamos al usuario por correo electrónico
        $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $usuario = $stmt->fetch();

        // 2. Validamos si el usuario existe y si la contraseña coincide con el hash encriptado
        if ($usuario && password_verify($password, $usuario['password_hash'])) {

            // La contraseña es correcta, pero la sesión REAL todavía no se abre.
            // Mandamos el código por correo y dejamos una sesión "pendiente"
            // que solo sirve para saber a quién hay que validar el código.
            $_SESSION['pendiente_2fa_usuario_id'] = $usuario['id'];

            $enviado = generarYEnviarCodigo2FA($pdo, $usuario['id'], $usuario['email'], $usuario['nombre']);

            if (!$enviado) {
                respuestaJSON(false, 'No pudimos enviar el código a tu correo. Probá de nuevo en un momento.');
            }

            echo json_encode([
                'exito' => true,
                'mensaje' => 'Te enviamos un código de verificación a tu correo.',
                'requiere_2fa' => true
            ]);
            exit;
        } else {
            respuestaJSON(false, 'El correo electrónico o la contraseña son incorrectos.');
        }

    } catch (PDOException $e) {
        respuestaJSON(false, 'Error crítico en la Base de Datos: ' . $e->getMessage());
    }
}

// ─────────────────────────────────────────────
// ACCIÓN: VERIFICAR CÓDIGO 2FA — recién acá se abre la sesión real
// ─────────────────────────────────────────────
if ($accion === 'verificar_2fa') {
    $codigoIngresado = trim($data['codigo'] ?? '');


    // DEBUG TEMPORAL — borrarlo después
    error_log('SESSION al verificar: ' . print_r($_SESSION, true));
    error_log('Código ingresado: ' . $codigoIngresado);


    if (empty($_SESSION['pendiente_2fa_usuario_id'])) {
        respuestaJSON(false, 'Tu sesión de verificación expiró. Volvé a iniciar sesión.');
    }
    if (empty($codigoIngresado)) {
        respuestaJSON(false, 'Ingresá el código que te enviamos por correo.');
    }

    try {
        $pdo = obtenerConexion();
        $usuarioId = (int) $_SESSION['pendiente_2fa_usuario_id'];

        $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $usuarioId]);
        $usuario = $stmt->fetch();


        $stmtExp = $pdo->prepare('SELECT codigo_2fa_expira > NOW() AS vigente FROM usuarios WHERE id = :id');
        $stmtExp->execute([':id' => $usuarioId]);
        $vigente = $stmtExp->fetchColumn();

        $codigoValido = $usuario
            && $usuario['codigo_2fa'] === $codigoIngresado
            && $vigente;

        if (!$codigoValido) {
            respuestaJSON(false, 'El código es incorrecto o ya venció.');
        }

        // Código correcto: ahora sí abrimos la sesión real y borramos el código usado.
        unset($_SESSION['pendiente_2fa_usuario_id']);
        $_SESSION['usuario_id']     = $usuario['id'];
        $_SESSION['usuario_rol']    = $usuario['rol'];
        $_SESSION['usuario_nombre'] = $usuario['nombre'];

        $pdo->prepare('UPDATE usuarios SET codigo_2fa = NULL, codigo_2fa_expira = NULL WHERE id = :id')
            ->execute([':id' => $usuario['id']]);

        $datosUsuario = [
            'id'       => $usuario['id'],
            'nombre'   => $usuario['nombre'],
            'email'    => $usuario['email'],
            'dni'      => $usuario['dni'] ?? '',
            'telefono' => $usuario['telefono'] ?? '',
            'rol'      => $usuario['rol']
        ];

        respuestaJSON(true, '¡Login exitoso!', $datosUsuario);

    } catch (PDOException $e) {
        respuestaJSON(false, 'Error crítico en la Base de Datos: ' . $e->getMessage());
    }
}
// ─────────────────────────────────────────────
// ACCIÓN: VERIFICAR SESIÓN — fuente de verdad real (server-side)
// La usan las páginas protegidas (portero.html, admin.html, etc.)
// para saber si hay sesión activa y con qué rol, sin confiar en el cliente.
// ─────────────────────────────────────────────
if ($accion === 'verificar_sesion') {
    if (empty($_SESSION['usuario_id'])) {
        respuestaJSON(false, 'No hay sesión activa.');
    }

    respuestaJSON(true, 'Sesión activa.', [
        'id'     => $_SESSION['usuario_id'],
        'nombre' => $_SESSION['usuario_nombre'],
        'rol'    => $_SESSION['usuario_rol'],
    ]);
}
// ─────────────────────────────────────────────
// ACCIÓN: LOGOUT — destruye la sesión real del servidor
// ─────────────────────────────────────────────
if ($accion === 'logout') {
    $_SESSION = [];
    session_destroy();
    respuestaJSON(true, 'Sesión cerrada.');
}

// Si llega acá y no entró en ninguna de las acciones anteriores
respuestaJSON(false, 'Acción no válida en el sistema.');