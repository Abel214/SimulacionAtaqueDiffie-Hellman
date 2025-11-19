import socket
import json

HOST = "localhost"
PUERTO_PUBLICO = 12345
PUERTO_PRIVADO = 12346   # Solo se usa si MITM está activo

print("="*60)
print("BOB - Diffie-Hellman")
print("="*60)

b = int(input("\nBob, ingrese secreto (3–10): "))

# Intentar abrir puerto público
servidor = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
modo_mitm = False

try:
    servidor.bind((HOST, PUERTO_PUBLICO))
    servidor.listen(1)
    print(f"\nBob escuchando en puerto {PUERTO_PUBLICO}")
except OSError:
    print("\n[BOB] Puerto público ocupado → Mallory activo (MITM).")
    modo_mitm = True

if modo_mitm:
    # Bob abre puerto privado para Mallory
    servidor = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    servidor.bind((HOST, PUERTO_PRIVADO))
    servidor.listen(1)
    print(f"[BOB] Bob escuchando en puerto privado {PUERTO_PRIVADO}…")

# Aceptar conexión (Alice o Mallory)
cliente, addr = servidor.accept()
print(f"Conexión establecida desde {addr}")

# Recibir A
datos = json.loads(cliente.recv(1024).decode())
A = datos["valor"]
p = datos["parametros"]["p"]
g = datos["parametros"]["g"]

print(f"Bob recibe A = {A}")

# Calcular B
B = pow(g, b, p)
cliente.send(json.dumps({"tipo": "valor_publico", "valor": B}).encode())

# Calcular clave
K_B = pow(A, b, p)
print(f"Clave secreta (Bob): {K_B}")

# Verificación
cliente.recv(1024)
cliente.send(json.dumps({"match": True}).encode())

# Chat
print("\nFASE DE MENSAJERÍA CIFRADA")

while True:
    msg = input("\nBob → Alice: ")
    if msg == "salir":
        cliente.send(json.dumps({"tipo": "fin"}).encode())
        break

    cif = ''.join(chr(ord(c) ^ K_B) for c in msg)
    cliente.send(json.dumps({
        "tipo": "mensaje",
        "contenido_cifrado": [ord(c) for c in cif]
    }).encode())

    # recibir
    r = json.loads(cliente.recv(2048).decode())
    if r["tipo"] == "fin":
        print("Alice terminó.")
        break

    cif2 = ''.join(chr(c) for c in r["contenido_cifrado"])
    desc = ''.join(chr(ord(c) ^ K_B) for c in cif2)
    print(f"Alice → Bob: {desc}")

cliente.close()
servidor.close()
