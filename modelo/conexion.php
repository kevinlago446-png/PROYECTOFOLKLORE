<?php
class Conexion {
    public static function conectar() {
        try {
            // Conexión a tu base de datos 'folklore2026' en XAMPP
            $link = new PDO("mysql:host=localhost;dbname=folklore2026;charset=utf8mb4", "root", "");
            
            // Le decimos a PDO que nos muestre los errores si algo falla
            $link->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            return $link;
        } catch (PDOException $e) {
            die("Error de conexión: " . $e->getMessage());
        }
    }
}