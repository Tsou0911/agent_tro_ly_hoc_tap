from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from backend.app.main import app


def test_health_checks_database_and_disposes_engine():
    engine = MagicMock()
    with patch("backend.app.main.create_engine", return_value=engine):
        with TestClient(app) as client:
            response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
    connection = engine.connect.return_value.__enter__.return_value
    assert str(connection.execute.call_args.args[0]) == "SELECT 1"
    engine.dispose.assert_called_once()


def test_health_recovers_after_database_failure():
    engine = MagicMock()
    engine.connect.side_effect = OperationalError(
        "SELECT 1", {}, Exception("private connection details")
    )
    with patch("backend.app.main.create_engine", return_value=engine):
        with TestClient(app) as client:
            response = client.get("/health")
            assert response.status_code == 503
            assert response.json() == {
                "status": "degraded", "database": "unavailable"
            }
            assert "private connection details" not in response.text

            engine.connect.side_effect = None
            assert client.get("/health").status_code == 200
