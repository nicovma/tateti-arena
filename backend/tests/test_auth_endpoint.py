from unittest.mock import patch, AsyncMock
import pytest


@pytest.mark.asyncio
async def test_google_login_returns_401_with_invalid_token(client):
    response = await client.post("/auth/google", json={"token": "invalid-token"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid Google token"


@pytest.mark.asyncio
async def test_google_login_returns_jwt_with_valid_token(client):
    mock_idinfo = {
        "email": "test@example.com",
        "name": "Test User",
        "picture": "https://example.com/avatar.jpg",
    }
    with patch(
        "app.api.auth.verify_google_token",
        new=AsyncMock(return_value=mock_idinfo),
    ):
        response = await client.post("/auth/google", json={"token": "valid-token"})

    assert response.status_code == 200
    data = response.json()
    assert "jwt" in data
    assert data["user"]["email"] == "test@example.com"
