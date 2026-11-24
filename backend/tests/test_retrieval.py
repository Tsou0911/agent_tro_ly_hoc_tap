import warnings

from qdrant_client import QdrantClient, models

from backend.app.config import Settings
from backend.app.retrieval import Retriever
from backend.app.retrieval import LocalEmbedder


class FixedEmbedder:
    def query(self, text):
        return [1.0, 0.0, 0.0]

    def documents(self, texts):
        return [[1.0, 0.0, 0.0] for _ in texts]


def test_real_qdrant_filters_course_active_and_includes_syllabus(chunk):
    settings = Settings(_env_file=None, database_url="postgresql+pg8000://x:x@localhost/test")
    client = QdrantClient(":memory:")
    retriever = Retriever(settings, client=client, embedder=FixedEmbedder())
    foreign = chunk.model_copy(update={"course_id": "c2", "id": "private"})
    material = chunk.model_copy(update={"id": "material", "kind": "material"})
    inactive = chunk.model_copy(update={"id": "old"})
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        retriever.ingest([chunk, foreign, material, inactive])
    client.set_payload(settings.qdrant_collection, {"active": False},
        points=models.Filter(must=[models.FieldCondition(key="id", match=models.MatchValue(value="old"))]))
    found = retriever.retrieve("c1", "while")
    assert {c.id for c in found} == {chunk.id, "material"}
    retriever.close()


def test_e5_query_and_passage_use_distinct_required_prefixes():
    from unittest.mock import Mock
    import numpy as np

    model = Mock()
    model.embed.side_effect = lambda texts: iter([np.array([1., 0.]) for _ in texts])
    embedder = LocalEmbedder("intfloat/multilingual-e5-small")
    embedder._model = model
    embedder.query("điều kiện dừng")
    embedder.documents(["while", "for"])
    assert model.embed.call_args_list[0].args[0] == ["query: điều kiện dừng"]
    assert model.embed.call_args_list[1].args[0] == ["passage: while", "passage: for"]
