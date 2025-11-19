import socket
import json

HOST = "localhost"
PUERTO = 12345

p = 23
g = 5

print("="*60)
print("ALICE - Simulación Diffie-Hellman")
print("="*60)
print(f"p = {p}, g = {g}")

a = int(input("\nAlice, ingrese secreto privado (3–10): "))

A = pow(g, a, p)
print(f"Alice genera A = {A}")

cliente = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
print("\nConectando con Bob/Mallory…")
cliente.connect((HOST, PUERTO))
print("Conectada.")

# Enviar A
cliente.send(json.dumps({
    "tipo": "valor_publico",
    "nombre": "Alice",
    "valor": A,
    "parametros": {"p": p, "g": g}
}).encode())

# Recibir B
resp = json.loads(cliente.recv(1024).decode())
B = resp["valor"]
print(f"Alice recibe B = {B}")

# Calcular clave
K_A = pow(B, a, p)
print(f"Clave secreta (Alice): {K_A}")

# Verificación
input("\nEnter para verificar clave...")
cliente.send(json.dumps({"tipo": "verificacion", "clave": K_A}).encode())
cliente.recv(1024)

# Chat cifrado
print("\nFASE DE MENSAJERÍA CIFRADA\n")

while True:
    datos = cliente.recv(2048).decode()
    json_msg = json.loads(datos)

    if json_msg["tipo"] == "fin":
        print("Bob terminó la conversación.")
        break

    cif = ''.join(chr(c) for c in json_msg["contenido_cifrado"])
    desc = ''.join(chr(ord(c) ^ K_A) for c in cif)
    print(f"Bob → Alice: {desc}")

    resp = input("Alice → Bob: ")

    if resp.lower() == "salir":
        cliente.send(json.dumps({"tipo": "fin"}).encode())
        break

    cif2 = ''.join(chr(ord(c) ^ K_A) for c in resp)
    paquete = {
        "tipo": "mensaje",
        "contenido_cifrado": [ord(c) for c in cif2]
    }
    cliente.send(json.dumps(paquete).encode())

cliente.close()
