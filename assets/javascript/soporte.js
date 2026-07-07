document.addEventListener("DOMContentLoaded", function() {
    cargarDatosSoporte();
});

function cargarDatosSoporte() {
    // Apuntamos al controlador que devuelve el JSON
    fetch('../../controlador/ControladorSoporte.php')
        .then(response => response.json())
        .then(data => {
            if(data) {
                // Inyectamos los datos en la vista
                document.getElementById('soporte-email').textContent = data.email;
                document.getElementById('soporte-telefono').textContent = data.telefono;
                
                // Opcional: hacer que el mail y teléfono sean clickeables
                document.getElementById('soporte-email').innerHTML = `<a href="mailto:${data.email}">${data.email}</a>`;
                document.getElementById('soporte-telefono').innerHTML = `<a href="tel:${data.telefono}">${data.telefono}</a>`;
            } else {
                console.error("No se encontraron datos de soporte.");
            }
        })
        .catch(error => console.error("Error al cargar el soporte:", error));
}