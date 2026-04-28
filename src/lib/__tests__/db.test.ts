import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";
import { Database } from "@/lib/db";
import { DatabaseTest, runEffect } from "./helpers";

describe("Database Service", () => {
  it("listDocs returns all documents", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const docs = yield* db.listDocs();
      expect(docs.length).toBeGreaterThanOrEqual(0);
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("getDoc fails for non-existent document", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const result = yield* Effect.either(db.getDoc("nonexistent"));
      expect(result._tag).toBe("Left");
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("createDoc creates a new document", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const doc = yield* db.createDoc({
        name: "New Doc",
        fileType: "md",
        size: 100,
        content: "Test content",
      });
      expect(doc.name).toBe("New Doc");
      expect(doc.file_type).toBe("md");
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("getDocWithContent returns doc and content", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const result = yield* db.getDocWithContent("doc1");
      expect(result.doc.id).toBe("doc1");
      expect(result.content).not.toBeNull();
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("deleteDoc removes document", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      yield* db.deleteDoc("doc2");
      const result = yield* Effect.either(db.getDoc("doc2"));
      expect(result._tag).toBe("Left");
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("updateDoc updates fields", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const updated = yield* db.updateDoc("doc1", { name: "Updated" });
      expect(updated.name).toBe("Updated");
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("getDocContent returns content for existing doc", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const content = yield* db.getDocContent("doc1");
      expect(content.doc_id).toBe("doc1");
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("getChunksForDoc returns chunks", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      const chunks = yield* db.getChunksForDoc("doc1");
      expect(chunks.length).toBeGreaterThan(0);
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });

  it("deleteChunksForDoc removes chunks", async () => {
    const effect = Effect.gen(function* () {
      const db = yield* Database;
      yield* db.deleteChunksForDoc("doc1");
      const chunks = yield* db.getChunksForDoc("doc1");
      expect(chunks.length).toBe(0);
    }).pipe(Effect.provide(DatabaseTest));

    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Success");
  });
});
