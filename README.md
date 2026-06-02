# Matematicas Interactivas: Resolucion de Problemas con Gamificacion

Prototipo funcional de curso virtual mediado por tecnologias para educacion media o primeros semestres universitarios. Incluye presentacion del curso, resultados de aprendizaje, modulos, actividades, quices, juego matematico, foros, evaluacion, rubricas, progreso, gamificacion y reflexion pedagogica final.

## Ejecucion

Desde esta carpeta:

```bash
npm run dev
```

Luego abre:

```txt
http://localhost:5173
```

## Arquitectura

- `index.html`: entrada principal del prototipo.
- `src/app.js`: aplicacion SPA con navegacion simulada, quices, juego, foros y progreso.
- `src/styles.css`: estilos responsivos, accesibilidad basica y diseno visual del ambiente.
- `public/db.json`: base de datos local con curso, modulos, actividades, quices, preguntas, foros, rubricas, insignias, ranking, progreso y retroalimentaciones.

## Alcance pedagogico

El prototipo alinea resultados de aprendizaje, actividades activas, evaluacion formativa, retroalimentacion y gamificacion. La experiencia simula una plataforma LMS donde el estudiante puede navegar por unidades, resolver quices con retroalimentacion inmediata, participar en foros simulados, consultar rubricas y revisar su avance.
