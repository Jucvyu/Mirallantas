-- =========================================================================
-- 0024 · Notificaciones que se pueden borrar
--
-- Los avisos del personal son compartidos (cada uno es de un módulo): si
-- un usuario borra uno, solo deja de verlo él. Aquí se guarda qué avisos
-- borró cada usuario. Los avisos del cliente son solo suyos y se borran de
-- verdad. En los dos casos, los de más de 7 días se borran solos (lo hace
-- la API al consultarlos).
-- =========================================================================

CREATE TABLE notificacion_personal_borrada (
  usuario_id      INTEGER NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  notificacion_id INTEGER NOT NULL REFERENCES notificacion_personal (id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, notificacion_id)
);
