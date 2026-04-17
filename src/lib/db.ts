import fs from "node:fs";
import path from "node:path";
import type {
  BindParams,
  Database as SqlJsDatabase,
  Statement as SqlJsStatement,
} from "sql.js";
import initSqlJs from "sql.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "shiryouku.db");

let _db: WrappedDatabase | null = null;
let _initPromise: Promise<WrappedDatabase> | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistToDisk(db: SqlJsDatabase) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

class Statement {
  private stmt: SqlJsStatement;

  constructor(
    db: SqlJsDatabase,
    sql: string,
    private onMutate: () => void,
  ) {
    this.stmt = db.prepare(sql);
  }

  run(...params: unknown[]) {
    if (params.length > 0) {
      this.stmt.bind(params as BindParams);
    }
    this.stmt.step();
    this.stmt.free();
    this.onMutate();
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    if (params.length > 0) {
      this.stmt.bind(params as BindParams);
    }
    if (this.stmt.step()) {
      const row = this.stmt.getAsObject() as Record<string, unknown>;
      this.stmt.free();
      return row;
    }
    this.stmt.free();
    return undefined;
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    if (params.length > 0) {
      this.stmt.bind(params as BindParams);
    }
    const rows: Record<string, unknown>[] = [];
    while (this.stmt.step()) {
      rows.push(this.stmt.getAsObject() as Record<string, unknown>);
    }
    this.stmt.free();
    return rows;
  }
}

class WrappedDatabase {
  private db: SqlJsDatabase;
  private _inTransaction = false;
  private persist: () => void;

  constructor(db: SqlJsDatabase) {
    this.db = db;
    this.persist = () => persistToDisk(db);
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql, () => {
      if (!this._inTransaction) {
        this.persist();
      }
    });
  }

  exec(sql: string) {
    this.db.run(sql);
    if (!this._inTransaction) {
      this.persist();
    }
  }

  transaction(fn: () => void) {
    this._inTransaction = true;
    this.db.run("BEGIN TRANSACTION");
    try {
      fn();
      this.db.run("COMMIT");
    } catch (err) {
      this.db.run("ROLLBACK");
      throw err;
    } finally {
      this._inTransaction = false;
      this.persist();
    }
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doc_contents (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL UNIQUE REFERENCES docs(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doc_chunks (
  chunk_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_index INTEGER,
  end_index INTEGER,
  token_count INTEGER,
  prev_chunk_id TEXT,
  next_chunk_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_contents_doc_id ON doc_contents(doc_id);
CREATE INDEX IF NOT EXISTS idx_docs_updated_at ON docs(updated_at);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_id ON doc_chunks(doc_id);
`;

async function initialize(): Promise<WrappedDatabase> {
  ensureDataDir();

  const SQL = await initSqlJs();

  let db: SqlJsDatabase;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON;");
  db.run(SCHEMA);
  persistToDisk(db);

  _db = new WrappedDatabase(db);
  return _db;
}

export async function getDb(): Promise<WrappedDatabase> {
  if (_db) return _db;
  if (!_initPromise) _initPromise = initialize();
  return _initPromise;
}
