import socket
import json
import time
import threading

HOST = "localhost"
PUERTO_ALICE = 12345      # Puerto público (Alice → Mallory)
PUERTO_BOB = 12346        # Puerto privado (Mallory → Bob)

print("=" * 60)
print("MALLORY - ATAQUE MAN-IN-THE-MIDDLE (UN PUERTO PÚBLICO)")
print("=" * 60)

# Intentar capturar el puerto público (12345)
mallory_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

try:
    mallory_server.bind((HOST, PUERTO_ALICE))
    mallory_server.listen(1)
    print(f"[MALLORY] Puerto {PUERTO_ALICE} capturado. MITM ACTIVADO.")
except OSError:
    print("\n[MALLORY] ERROR: Bob ya está escuchando. No se puede realizar MITM.")
    exit()

# Parámetros Diffie-Hellman
p = 23
g = 5

m = int(input("\n[MALLORY] Ingrese su número secreto privado (3–10): "))
M = pow(g, m, p)
print(f"[MALLORY] Valor público M = {M}")

# -------------------------------------------------------------
# 1. Esperar a Alice
# -------------------------------------------------------------
print("\n[MALLORY] Esperando conexión de Alice...")
alice_conn, addr = mallory_server.accept()
print(f"[MALLORY] Alice conectada desde {addr}")

# Recibir A de Alice
datos_alice = json.loads(alice_conn.recv(1024).decode())
A = datos_alice["valor"]
print(f"[MALLORY] Alice envió A = {A}")

# -------------------------------------------------------------
# 2. Conectar con Bob (Bob aún no ha iniciado)
# -------------------------------------------------------------
bob_conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

print("\n[MALLORY] Esperando que Bob abra el puerto privado 12346...")

while True:
    try:
        bob_conn.connect((HOST, PUERTO_BOB))
        print("[MALLORY] Conectado a Bob.")
        break
    except ConnectionRefusedError:
        print("[MALLORY] Bob aún no está listo. Reintentando en 1 segundo...")
        time.sleep(1)

# Enviar valor público a Bob (Alice→Bob)
bob_conn.send(json.dumps({
    "tipo": "valor_publico",
    "valor": M,
    "parametros": {"p": p, "g": g}
}).encode())

# Recibir B de Bob
datos_bob = json.loads(bob_conn.recv(1024).decode())
B = datos_bob["valor"]
print(f"[MALLORY] Bob envió B = {B}")

# Enviar valor público M a Alice (Bob→Alice)
alice_conn.send(json.dumps({
    "tipo": "valor_publico",
    "valor": M
}).encode())

# -------------------------------------------------------------
# 3. Calcular claves MITM
# -------------------------------------------------------------
K_A_M = pow(A, m, p)   # Clave Alice → Mallory
K_M_B = pow(B, m, p)   # Clave Mallory → Bob

print("\n" + "=" * 60)
print(" CLAVES ESTABLECIDAS (MITM)")
print("=" * 60)
print(f"Clave Alice–Mallory: {K_A_M}")
print(f"Clave Mallory–Bob:   {K_M_B}")
print("=" * 60)

# -------------------------------------------------------------
# 4. FUNCIONES DE INTERCEPTACIÓN BIDIRECCIONAL
# -------------------------------------------------------------
def proxy_alice_to_bob():
    """Intercepta mensajes de Alice → Mallory → Bob"""
    global alice_conn, bob_conn, K_A_M, K_M_B

    while True:
        data = alice_conn.recv(2048).decode()
        if not data:
            break

        try:
            msg = json.loads(data)
        except:
            continue

        tipo = msg.get("tipo")

        # FIN
        if tipo == "fin":
            bob_conn.send(json.dumps(msg).encode())
            break

        # Verificación
        if tipo == "verificacion":
            print("[MALLORY] Pasando verificación Alice→Bob sin alterar.")
            bob_conn.send(data.encode())
            continue

        # MENSAJE NORMAL
        if tipo == "mensaje":
            contenido = msg["contenido_cifrado"]
            cif = ''.join(chr(c) for c in contenido)
            original = ''.join(chr(ord(c) ^ K_A_M) for c in cif)

            print(f"\n[Alice → Bob INTERCEPTADO] {original}")

            # Mallory puede modificarlo
            mod = input("[MALLORY] Modificar mensaje (Enter = sin cambios): ")
            if mod.strip() == "":
                mod = original

            # Re-cifrar hacia Bob
            cif2 = ''.join(chr(ord(c) ^ K_M_B) for c in mod)
            bob_conn.send(json.dumps({
                "tipo": "mensaje",
                "contenido_cifrado": [ord(c) for c in cif2]
            }).encode())

            print(f"[MALLORY] Enviado a Bob: {mod}")
            continue

        # Otros tipos
        bob_conn.send(data.encode())


def proxy_bob_to_alice():
    """Intercepta mensajes de Bob → Mallory → Alice"""
    global alice_conn, bob_conn, K_A_M, K_M_B

    while True:
        data = bob_conn.recv(2048).decode()
        if not data:
            break

        try:
            msg = json.loads(data)
        except:
            continue

        tipo = msg.get("tipo")

        # FIN
        if tipo == "fin":
            alice_conn.send(json.dumps(msg).encode())
            break

        # Verificación
        if tipo == "verificacion":
            print("[MALLORY] Pasando verificación Bob→Alice sin alterar.")
            alice_conn.send(data.encode())
            continue

        # MENSAJE NORMAL
        if tipo == "mensaje":
            contenido = msg["contenido_cifrado"]
            cif = ''.join(chr(c) for c in contenido)
            original = ''.join(chr(ord(c) ^ K_M_B) for c in cif)

            print(f"\n[Bob → Alice INTERCEPTADO] {original}")

            # Modificar
            mod = input("[MALLORY] Modificar mensaje (Enter = sin cambios): ")
            if mod.strip() == "":
                mod = original

            # Re-cifrar hacia Alice
            cif2 = ''.join(chr(ord(c) ^ K_A_M) for c in mod)
            alice_conn.send(json.dumps({
                "tipo": "mensaje",
                "contenido_cifrado": [ord(c) for c in cif2]
            }).encode())

            print(f"[MALLORY] Enviado a Alice: {mod}")
            continue

        # Otros tipos
        alice_conn.send(data.encode())

# -------------------------------------------------------------
# 5. LANZAR LOS DOS HILOS
# -------------------------------------------------------------
print("\n[MALLORY] Interceptando mensajes en ambas direcciones...\n")

t1 = threading.Thread(target=proxy_alice_to_bob)
t2 = threading.Thread(target=proxy_bob_to_alice)

t1.start()
t2.start()

t1.join()
t2.join()

print("\n[MALLORY] Sesión terminada.")
alice_conn.close()
bob_conn.close()
mallory_server.close()
