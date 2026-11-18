'use strict';

module.exports = {
  async up(queryInterface) {
    const sql = [
      `CREATE TABLE ingestion_approvals (
        id CHAR(36) PRIMARY KEY,
        drive_file_id VARCHAR(255) NOT NULL,
        content_hash CHAR(64) NOT NULL,
        approved_by CHAR(36) NOT NULL,
        approved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ingestion_approval (drive_file_id, content_hash),
        CONSTRAINT fk_ingestion_reviewer FOREIGN KEY (approved_by) REFERENCES usuarios(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE drive_ingestion_state (
        folder_id VARCHAR(255) PRIMARY KEY,
        bootstrap_token TEXT NOT NULL,
        cursor_token TEXT,
        pilot_done BOOLEAN NOT NULL DEFAULT FALSE,
        initial_sync_done BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE vector_cache_state (
        id TINYINT PRIMARY KEY,
        revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
        CONSTRAINT ck_vector_cache_singleton CHECK (id = 1)
      ) ENGINE=InnoDB`,
      'INSERT INTO vector_cache_state (id, revision) VALUES (1, 0)'
    ];
    for (const statement of sql) await queryInterface.sequelize.query(statement);
  },
  async down() { throw new Error('La reversión destructiva está deshabilitada.'); }
};
