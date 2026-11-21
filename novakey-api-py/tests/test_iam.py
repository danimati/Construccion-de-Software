"""Pruebas de integración del módulo IAM (RF01), equivalentes a las de la versión Spring."""

from tests.conftest import requiere_bd

# Todo el módulo requiere PostgreSQL; se omite si no está disponible.
pytestmark = requiere_bd


def _reiniciar(cliente, auth, admin):
    r = cliente.post("/api/demo/reiniciar", headers=auth(admin))
    assert r.status_code == 200, r.text


def test_sin_token_responde_401(cliente):
    assert cliente.get("/api/usuarios").status_code == 401
    r = cliente.get("/api/usuarios", headers={"Authorization": "Bearer falso"})
    assert r.status_code == 401


def test_credenciales_incorrectas_responden_401(cliente):
    assert cliente.post(
        "/api/auth/login", json={"username": "mquintero", "password": "mala"}
    ).status_code == 401
    assert cliente.post(
        "/api/auth/login", json={"username": "nadie", "password": "novakey"}
    ).status_code == 401


def test_login_devuelve_token_y_permisos(cliente, token):
    r = cliente.post("/api/auth/login", json={"username": "ecampos", "password": "novakey"})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["token"]
    assert cuerpo["usuario"]["permisos"]["ventas"] == "editar"
    assert cuerpo["usuario"]["permisos"]["rh"] is None


def test_cada_rol_solo_accede_a_sus_modulos(cliente, token, auth):
    comercial = token("ecampos")
    assert cliente.get("/api/usuarios", headers=auth(comercial)).status_code == 403
    assert cliente.get("/api/roles", headers=auth(comercial)).status_code == 403
    admin = token("slinares")
    assert cliente.get("/api/usuarios", headers=auth(admin)).status_code == 200


def test_me_devuelve_la_sesion(cliente, token, auth):
    admin = token("slinares")
    r = cliente.get("/api/auth/me", headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["username"] == "slinares"


def test_desactivar_usuario_invalida_su_token_de_inmediato(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    admin = token("slinares")
    comercial = token("ecampos")
    assert cliente.get("/api/auth/me", headers=auth(comercial)).status_code == 200
    # Localiza el id del usuario comercial.
    usuarios = cliente.get("/api/usuarios", headers=auth(admin)).json()
    uid = next(u["id"] for u in usuarios if u["username"] == "ecampos")
    r = cliente.put(f"/api/usuarios/{uid}/activo", json={"activo": False}, headers=auth(admin))
    assert r.status_code == 200
    assert cliente.get("/api/auth/me", headers=auth(comercial)).status_code == 401


def test_cambiar_permiso_surte_efecto_sin_nuevo_login(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    admin = token("slinares")
    comercial = token("ecampos")
    assert cliente.get("/api/usuarios", headers=auth(comercial)).status_code == 403
    # Da al rol Comercial (id 2) el permiso de ver accesos.
    r = cliente.put("/api/roles/2/permisos/accesos", json={"nivel": "ver"}, headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["permisos"]["accesos"] == "ver"
    assert cliente.get("/api/usuarios", headers=auth(comercial)).status_code == 200
    # Retira el permiso.
    r = cliente.put("/api/roles/2/permisos/accesos", json={"nivel": None}, headers=auth(admin))
    assert r.json()["permisos"]["accesos"] is None
    assert cliente.get("/api/usuarios", headers=auth(comercial)).status_code == 403


def test_administrador_no_puede_bloquearse(cliente, token, auth):
    admin = token("slinares")
    r = cliente.put("/api/roles/6/permisos/accesos", json={"nivel": None}, headers=auth(admin))
    assert r.status_code == 409


def test_la_api_nunca_expone_contrasenas(cliente, token, auth):
    admin = token("slinares")
    r = cliente.get("/api/usuarios", headers=auth(admin))
    assert "password" not in r.text
    assert "argon2" not in r.text


def test_usuario_nuevo_puede_entrar_con_su_contrasena(cliente, token, auth):
    admin = token("slinares")
    _reiniciar(cliente, auth, admin)
    admin = token("slinares")
    nuevo = {
        "username": "nuevo",
        "email": "nuevo@novakey.example",
        "password": "clave-larga-1",
        "rol_id": 2,
    }
    assert cliente.post("/api/usuarios", json=nuevo, headers=auth(admin)).status_code == 201
    assert cliente.post(
        "/api/auth/login", json={"username": "nuevo", "password": "clave-larga-1"}
    ).status_code == 200
    corto = {**nuevo, "username": "corto", "email": "corto@novakey.example", "password": "123"}
    r = cliente.post("/api/usuarios", json=corto, headers=auth(admin))
    assert r.status_code == 422
