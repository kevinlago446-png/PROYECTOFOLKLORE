<?php
require_once "conexion.php";

class ModeloSoporte {
    static public function mdlObtenerSoporte() {
        // Asumiendo que tu clase en conexion.php se llama Conexion y su método conectar()
        $stmt = Conexion::conectar()->prepare("SELECT email, telefono FROM soporte LIMIT 1");
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt = null;
    }
}