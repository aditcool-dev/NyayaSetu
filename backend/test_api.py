import urllib.request
import json

try:
    with urllib.request.urlopen('http://127.0.0.1:8000/api/v1/cases/') as response:
        print("Cases:", response.read().decode())
    with urllib.request.urlopen('http://127.0.0.1:8000/api/v1/dashboard/stats') as response:
        print("Stats:", response.read().decode())
except Exception as e:
    print("Error:", e)
