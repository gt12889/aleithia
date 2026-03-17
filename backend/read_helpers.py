"""Pure document filtering and transformation helpers for backend routes."""

from __future__ import annotations


def filter_docs_by_neighborhood(docs: list[dict], neighborhood: str) -> list[dict]:
    """Filter documents that match a neighborhood using existing backend heuristics."""
    nb = neighborhood.lower()
    results = []
    for doc in docs:
        geo = doc.get("geo", {})
        doc_nb = (geo.get("neighborhood") or "").lower()
        doc_ca = (geo.get("community_area_name") or "").lower()
        content = (doc.get("content") or "").lower()
        raw = doc.get("metadata", {}).get("raw_record", {})
        address = (raw.get("address") or "").lower()
        title = (doc.get("title") or "").lower()
        community = (raw.get("community_area_name") or "").lower()
        if nb in doc_nb or nb in doc_ca or nb in content or nb in address or nb in title or nb in community:
            results.append(doc)
    return results


def filter_public_data_by_dataset(docs: list[dict], dataset: str) -> list[dict]:
    """Filter public_data docs by dataset type (for example food_inspections)."""
    return [doc for doc in docs if doc.get("metadata", {}).get("dataset") == dataset]


def transform_doc_for_graph(doc: dict) -> dict:
    """Normalize document payloads for graph responses while preserving current fields."""
    memories = doc.get("memories", doc.get("memoryEntries", []))
    memory_entries = []
    for memory in memories:
        rels = memory.get("memoryRelations")
        if isinstance(rels, dict):
            rels = [
                {"targetMemoryId": key, "relationType": value}
                for key, value in rels.items()
                if value in ("updates", "extends", "derives")
            ]
        entry = {
            "id": memory.get("id", ""),
            "documentId": doc.get("id", ""),
            "content": memory.get("memory", memory.get("content")),
            "summary": memory.get("summary"),
            "title": memory.get("title"),
            "createdAt": memory.get("createdAt", memory.get("created_at")),
            "updatedAt": memory.get("updatedAt", memory.get("updated_at")),
            "isLatest": memory.get("isLatest", True),
            "isForgotten": memory.get("isForgotten"),
            "forgetAfter": memory.get("forgetAfter"),
            "relation": memory.get("relation") or memory.get("changeType"),
            "memoryRelations": rels if isinstance(rels, list) else memory.get("memoryRelations"),
            "updatesMemoryId": memory.get("updatesMemoryId"),
            "nextVersionId": memory.get("nextVersionId"),
            "parentMemoryId": memory.get("parentMemoryId"),
            "rootMemoryId": memory.get("rootMemoryId"),
            "metadata": memory.get("metadata"),
            "spaceId": memory.get("spaceId"),
            "spaceContainerTag": memory.get("spaceContainerTag"),
        }
        memory_entries.append(entry)

    out = {
        "id": doc.get("id", ""),
        "customId": doc.get("customId"),
        "title": doc.get("title"),
        "content": doc.get("content"),
        "summary": doc.get("summary"),
        "url": doc.get("url"),
        "source": doc.get("source"),
        "type": doc.get("type", doc.get("documentType")),
        "status": doc.get("status", "done"),
        "metadata": doc.get("metadata"),
        "createdAt": doc.get("createdAt", doc.get("created_at")),
        "updatedAt": doc.get("updatedAt", doc.get("updated_at")),
        "memoryEntries": memory_entries,
    }
    if doc.get("x") is not None:
        out["x"] = doc["x"]
    if doc.get("y") is not None:
        out["y"] = doc["y"]
    if doc.get("summaryEmbedding") is not None:
        out["summaryEmbedding"] = doc["summaryEmbedding"]
    return out
