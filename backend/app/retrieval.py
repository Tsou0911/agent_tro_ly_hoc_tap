from threading import Lock
from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient, models

from .config import Settings
from .contracts import Chunk


class RetrievalUnavailable(RuntimeError):
    pass


class LocalEmbedder:
    """Lazy local CPU inference; downloads public model weights on first use."""
    _initialization_lock = Lock()

    def __init__(self, name: str):
        self.name = name
        self._model = None

    @property
    def model(self):
        with self._initialization_lock:
            if self._model is None:
                from fastembed import TextEmbedding
                # E5-small is a custom model in FastEmbed, not a built-in in all releases.
                if self.name == "intfloat/multilingual-e5-small" and self.name not in {
                    entry["model"] for entry in TextEmbedding.list_supported_models()
                }:
                    from fastembed.common.model_description import ModelSource, PoolingType
                    TextEmbedding.add_custom_model(
                        model=self.name, pooling=PoolingType.MEAN, normalization=True,
                        sources=ModelSource(hf=self.name), dim=384, model_file="onnx/model.onnx",
                    )
                self._model = TextEmbedding(model_name=self.name, providers=["CPUExecutionProvider"])
        return self._model

    def query(self, text: str) -> list[float]:
        if self.name == "intfloat/multilingual-e5-small":
            return next(iter(self.model.embed(["query: " + text]))).tolist()
        return next(iter(self.model.query_embed(text))).tolist()

    def documents(self, texts: list[str]) -> list[list[float]]:
        if self.name == "intfloat/multilingual-e5-small":
            return [v.tolist() for v in self.model.embed(["passage: " + text for text in texts])]
        return [v.tolist() for v in self.model.passage_embed(texts)]


class Retriever:
    def __init__(self, settings: Settings, client=None, embedder=None):
        self.settings = settings
        self.client = client or QdrantClient(url=settings.qdrant_url, timeout=10, check_compatibility=False)
        self.embedder = embedder or LocalEmbedder(settings.embedding_model)

    def close(self):
        self.client.close()

    def retrieve(self, course_id: str, question: str) -> list[Chunk]:
        """Two semantic queries: syllabus context plus relevant teaching material."""
        try:
            vector = self.embedder.query(question)
            chunks = {}
            for kind in ("syllabus", "material"):
                result = self.client.query_points(
                    collection_name=self.settings.qdrant_collection,
                    query=vector,
                    query_filter=models.Filter(must=[
                        models.FieldCondition(key="course_id", match=models.MatchValue(value=course_id)),
                        models.FieldCondition(key="kind", match=models.MatchValue(value=kind)),
                        models.FieldCondition(key="active", match=models.MatchValue(value=True)),
                    ]),
                    limit=self.settings.retrieval_limit,
                    # Low semantic score is NOT a reliable out-of-scope decision.
                    score_threshold=None if kind == "syllabus" else self.settings.retrieval_score_threshold,
                    with_payload=True,
                )
                for point in result.points:
                    payload = dict(point.payload or {})
                    active = payload.pop("active", False)
                    chunk = Chunk.model_validate(payload)
                    if chunk.course_id != course_id or chunk.kind != kind or not active:
                        raise ValueError("Invalid retrieval boundary")
                    if chunk.id in chunks and chunks[chunk.id] != chunk:
                        raise ValueError("Ambiguous chunk ID")
                    chunks[chunk.id] = chunk
            return list(chunks.values())
        except Exception as exc:
            raise RetrievalUnavailable("Course retrieval unavailable") from exc

    def ingest(self, chunks: list[Chunk]) -> None:
        """Trusted CLI input only. Chunk IDs must be unique within each course."""
        if not chunks or len({(c.course_id, c.id) for c in chunks}) != len(chunks):
            raise ValueError("Nonempty, unique chunks required")
        vectors = self.embedder.documents([c.text for c in chunks])
        if len(vectors) != len(chunks):
            raise ValueError("Missing embeddings")
        if not self.client.collection_exists(self.settings.qdrant_collection):
            self.client.create_collection(self.settings.qdrant_collection,
                vectors_config=models.VectorParams(size=len(vectors[0]), distance=models.Distance.COSINE))
            for key in ("course_id", "kind"):
                self.client.create_payload_index(self.settings.qdrant_collection, key, models.PayloadSchemaType.KEYWORD)
            self.client.create_payload_index(self.settings.qdrant_collection, "active", models.PayloadSchemaType.BOOL)
        self.client.upsert(self.settings.qdrant_collection, wait=True, points=[
            models.PointStruct(id=str(uuid5(NAMESPACE_URL, f"{c.course_id}:{c.id}")), vector=v,
                               payload={**c.model_dump(), "active": True})
            for c, v in zip(chunks, vectors, strict=True)
        ])
