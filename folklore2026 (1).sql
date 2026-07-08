-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 29-06-2026 a las 00:28:21
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `folklore2026`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `bloqueos_temporales`
--

CREATE TABLE `bloqueos_temporales` (
  `id` int(11) NOT NULL,
  `titulo_noche` varchar(100) NOT NULL,
  `sector` varchar(50) NOT NULL,
  `butaca` varchar(50) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `fecha_expiracion` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `entradas`
--

CREATE TABLE `entradas` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `numero_factura` varchar(20) NOT NULL,
  `codigo_ticket` varchar(100) DEFAULT NULL,
  `estado_ticket` varchar(20) DEFAULT 'valido',
  `estado_pago` varchar(20) DEFAULT 'pendiente',
  `titulo_noche` varchar(100) NOT NULL,
  `fecha_evento` varchar(100) NOT NULL DEFAULT '',
  `lugar` varchar(100) DEFAULT 'Único Estadio Municipal',
  `sector` varchar(50) NOT NULL,
  `butacas` varchar(100) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `fecha_emision` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `entradas`
--

INSERT INTO `entradas` (`id`, `usuario_id`, `numero_factura`, `codigo_ticket`, `estado_ticket`, `estado_pago`, `titulo_noche`, `fecha_evento`, `lugar`, `sector`, `butacas`, `total`, `fecha_emision`) VALUES
(150, 21, 'FAC-619936', 'RT-6a4191255f800', 'usado', 'pagado', 'anda', 'Jueves 11 de junio', 'Único Estadio Municipal', 'Mayores - Sector A (Platea VIP)', 'A-F1-B1', 15000.00, '2026-06-28 21:24:53'),
(151, 19, 'FAC-325814', 'RT-6a41917601056', 'valido', 'pendiente', 'anda', 'Jueves 11 de junio', 'Único Estadio Municipal', 'Mayores - Sector B (Platea Media)', 'B-F1-B4, B-F1-B5', 24000.00, '2026-06-28 21:26:14'),
(152, 21, 'FAC-542563', 'RT-6a41948d7451a', 'usado', 'pagado', 'anda2', 'Jueves 11 de junio', 'Único Estadio Municipal', 'Mayores - Sector A (Platea VIP)', 'A-F1-B2, A-F1-B3, A-F2-B5', 40500.00, '2026-06-28 21:39:25');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `noches`
--

CREATE TABLE `noches` (
  `id` int(11) NOT NULL,
  `titulo` varchar(150) NOT NULL,
  `fecha` date NOT NULL,
  `horario` varchar(100) NOT NULL,
  `artistas` varchar(255) NOT NULL,
  `precio_base` decimal(10,2) NOT NULL,
  `descuento_anticipada` tinyint(1) NOT NULL DEFAULT 0,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `noches`
--

INSERT INTO `noches` (`id`, `titulo`, `fecha`, `horario`, `artistas`, `precio_base`, `descuento_anticipada`, `creado_en`) VALUES
(12, 'rwq', '2026-06-20', '34', 'asf', 342342.00, 1, '2026-06-28 13:11:45'),
(13, '34erwer', '2026-06-12', '325 235 23', 'gsdgs', 10000.00, 0, '2026-06-28 13:12:33'),
(14, 'anda', '2026-06-11', 'anda', 'anda', 10000.00, 0, '2026-06-28 13:14:29'),
(15, 'anda2', '2026-06-11', 'anda2', 'anda2', 10000.00, 1, '2026-06-28 13:17:14');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `soporte`
--

CREATE TABLE `soporte` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `telefono` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `soporte`
--

INSERT INTO `soporte` (`id`, `email`, `telefono`) VALUES
(1, 'ayuda@raices.com.ar', '+54 11 1234-5678');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `dni` varchar(15) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('usuario','vendedor','admin','superadmin') NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp(),
  `codigo_2fa` varchar(6) DEFAULT NULL,
  `codigo_2fa_expira` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `dni`, `telefono`, `email`, `password_hash`, `rol`, `activo`, `fecha_registro`, `codigo_2fa`, `codigo_2fa_expira`) VALUES
(19, 'Portero', '11111111', '22222222222', 'totodeambrogi@gmail.com', '$2y$10$AsKJntbT0kt3QtGJKOxope8iHEHw5YmWKmOZY7W6Dc4ThlvxKW1OS', 'usuario', 1, '2026-06-24 22:46:25', NULL, NULL),
(21, 'Tomas Deambrogi', '12345122', '12345678', 'tomas.deambrogi.236@alu.tecnica29de6.edu.ar', '$2y$10$r57t72TEucANgi1iIpqyRubX2Kzpc3yI3OlJv68iW5UqOyZAWY4vq', 'vendedor', 1, '2026-06-25 23:57:07', NULL, NULL),
(22, 'Alan Ezequiel Usedo', '23232323', '123123123123', 'alan.usedo.961@alu.tecnica29de6.edu.ar', '$2y$10$bkbj0eQXT0D/V7/WGX3h8.SgvmQdBPFveW5/RWBQcaXyISoUhiYxu', 'admin', 1, '2026-06-28 12:19:23', NULL, NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `bloqueos_temporales`
--
ALTER TABLE `bloqueos_temporales`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `entradas`
--
ALTER TABLE `entradas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_factura` (`numero_factura`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `noches`
--
ALTER TABLE `noches`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `soporte`
--
ALTER TABLE `soporte`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `dni` (`dni`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `bloqueos_temporales`
--
ALTER TABLE `bloqueos_temporales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=530;

--
-- AUTO_INCREMENT de la tabla `entradas`
--
ALTER TABLE `entradas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=153;

--
-- AUTO_INCREMENT de la tabla `noches`
--
ALTER TABLE `noches`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de la tabla `soporte`
--
ALTER TABLE `soporte`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `entradas`
--
ALTER TABLE `entradas`
  ADD CONSTRAINT `entradas_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
