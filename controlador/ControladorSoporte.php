<?php
require_once "../modelo/ModeloSoporte.php";

class ControladorSoporte {
    static public function ctrMostrarSoporte() {
        $respuesta = ModeloSoporte::mdlObtenerSoporte();
        echo json_encode($respuesta);
    }
}

// Ejecutar el método si se llama al archivo directamente
$soporte = new ControladorSoporte();
$soporte->ctrMostrarSoporte();