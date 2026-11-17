'use strict';

module.exports = {
  async up(queryInterface) {
    // No se altera ninguna tabla ni dato previo; la nueva relación se valida con una clave foránea.
    await queryInterface.sequelize.query(`
      CREATE TABLE document_chunks (
        id CHAR(36) PRIMARY KEY,
        document_id CHAR(36) NOT NULL,
        drive_file_id VARCHAR(255) NOT NULL,
        title VARCHAR(250) NOT NULL,
        content TEXT NOT NULL,
        section VARCHAR(250),
        page_number INT,
        chunk_index INT NOT NULL,
        version VARCHAR(32) NOT NULL,
        source_url TEXT,
        category ENUM('POLITICA','PROCEDIMIENTO','DOCUMENTO_PUBLICO') NOT NULL,
        effective_date DATE,
        content_hash CHAR(64) NOT NULL,
        embedding_model VARCHAR(80) NOT NULL,
        embedding JSON NOT NULL,
        metadata JSON NOT NULL,
        validation_status ENUM('PENDIENTE','VALIDADO','ELIMINADO') NOT NULL DEFAULT 'PENDIENTE',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_chunks_documento FOREIGN KEY (document_id) REFERENCES documentos(id) ON DELETE RESTRICT,
        CONSTRAINT ck_chunk_index CHECK (chunk_index >= 0),
        CONSTRAINT ck_chunk_page CHECK (page_number IS NULL OR page_number > 0),
        CONSTRAINT ck_chunk_embedding CHECK (JSON_TYPE(embedding) = 'ARRAY' AND JSON_LENGTH(embedding) = 768),
        CONSTRAINT ck_chunk_model CHECK (embedding_model = 'gemini-embedding-001'),
        CONSTRAINT ck_chunk_active CHECK (is_active = 0 OR validation_status = 'VALIDADO'),
        UNIQUE KEY uq_document_version_chunk (document_id, version, chunk_index),
        INDEX idx_chunks_activos (is_active, validation_status, category, document_id),
        INDEX idx_chunks_drive (drive_file_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
  async down() {
    throw new Error('La eliminación de documentos está deshabilitada; prepare una migración revisada.');
  }
};
