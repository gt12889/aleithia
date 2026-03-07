"""Graph endpoints for city graph and Supermemory graph views."""
from __future__ import annotations

import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from modal_app.api.services.graph import load_city_graph, load_full_graph, transform_doc_for_graph

router = APIRouter()


@router.get("/graph/full")
async def graph_full():
    return await load_full_graph()


@router.get("/graph")
async def graph(page: int = 1, limit: int = 500):
    empty: dict = {"documents": [], "edges": [], "pagination": {"currentPage": 1, "totalPages": 0}}
    api_key = os.environ.get("SUPERMEMORY_API_KEY", "")
    if not api_key:
        return JSONResponse(empty, status_code=200)

    import httpx

    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            viewport = {"minX": 0, "maxX": 1000000, "minY": 0, "maxY": 1000000}
            try:
                bounds_resp = await client.get(
                    "https://api.supermemory.ai/v3/graph/bounds",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if bounds_resp.is_success:
                    bounds_data = bounds_resp.json()
                    if bounds_data.get("bounds"):
                        viewport = bounds_data["bounds"]
            except Exception:
                pass

            resp = await client.post(
                "https://api.supermemory.ai/v3/graph/viewport",
                headers=headers,
                json={"viewport": viewport, "limit": min(limit, 500)},
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_docs = data.get("documents", [])
                docs = [transform_doc_for_graph(doc) for doc in raw_docs]
                total = data.get("totalCount", len(docs))
                out = {
                    "documents": docs,
                    "edges": data.get("edges", []),
                    "pagination": {
                        "currentPage": page,
                        "totalPages": max(1, (total + limit - 1) // limit),
                        "totalItems": total,
                    },
                }
                return JSONResponse(out, status_code=200)
        except Exception as exc:
            print(f"Supermemory graph/viewport: {exc}")

        for url in ["https://api.supermemory.ai/v3/documents/list", "https://api.supermemory.ai/v3/documents/documents"]:
            try:
                resp = await client.post(
                    url,
                    headers=headers,
                    json={"page": page, "limit": min(limit, 500), "sort": "createdAt", "order": "desc"},
                )
                if resp.status_code in (401, 403):
                    continue
                resp.raise_for_status()
                data = resp.json()
                raw_docs = data.get("documents") or data.get("memories") or []
                docs = [transform_doc_for_graph(doc) for doc in raw_docs]
                return JSONResponse({"documents": docs, "pagination": data.get("pagination", {})}, status_code=200)
            except Exception as exc:
                print(f"Supermemory {url}: {exc}")
                continue
    return JSONResponse(empty, status_code=200)


@router.get("/graph/neighborhood/{name}")
async def get_neighborhood_graph(name: str):
    data = load_city_graph()
    nb_id = f"nb:{name}"
    connected = {nb_id}
    for edge in data["edges"]:
        if edge["source"] == nb_id or edge["target"] == nb_id:
            connected.add(edge["source"])
            connected.add(edge["target"])
    nodes = [node for node in data["nodes"] if node["id"] in connected]
    edges = [edge for edge in data["edges"] if edge["source"] in connected and edge["target"] in connected]
    return {"nodes": nodes, "edges": edges, "center": nb_id}


@router.get("/graph/stats")
async def get_graph_stats():
    return load_city_graph().get("stats", {})
