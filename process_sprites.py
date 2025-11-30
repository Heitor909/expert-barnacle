# process_sprites.py
# Executar: python process_sprites.py
import os, json
from PIL import Image

# Ajuste o caminho se necessário
ROOT = r"C:\Users\famil\Downloads\sprites_animais"
OUT = os.path.join(os.getcwd(), "processed_json")

if not os.path.exists(OUT):
    os.makedirs(OUT)

for animal in os.listdir(ROOT):
    folder = os.path.join(ROOT, animal)
    if not os.path.isdir(folder):
        continue
    frames = []
    # ordenar por nome (assumindo macaco_1.png ... )
    files = sorted([f for f in os.listdir(folder) if f.lower().endswith(('.png','.jpg','.jpeg'))])
    for fname in files:
        fpath = os.path.join(folder, fname)
        try:
            w,h = Image.open(fpath).size
        except Exception:
            w,h = None,None
        frames.append({
            "file": fname,
            "w": w,
            "h": h
        })
    json_path = os.path.join(OUT, f"{animal}_sprites.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"animal":animal, "frames": frames}, f, indent=2, ensure_ascii=False)
    print("Gerado:", json_path)

print("Concluído.")
