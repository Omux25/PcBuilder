import os
import requests
import zlib

def plantuml_encode(puml_text):
    """
    Official PlantUML encoding algorithm:
    1. UTF-8
    2. Deflate
    3. Custom Base64
    """
    def encode_6bit(b):
        if b < 10: return chr(48 + b)
        b -= 10
        if b < 26: return chr(65 + b)
        b -= 26
        if b < 26: return chr(97 + b)
        b -= 26
        if b == 0: return '-'
        if b == 1: return '_'
        return '?'

    def append_3bytes(b1, b2, b3):
        c1 = b1 >> 2
        c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
        c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
        c4 = b3 & 0x3F
        return encode_6bit(c1) + encode_6bit(c2) + encode_6bit(c3) + encode_6bit(c4)

    # 1. UTF-8
    data = puml_text.encode('utf-8')
    # 2. Deflate
    compressed = zlib.compress(data, level=9)[2:-4] # Raw deflate
    
    # 3. Custom Base64
    res = ""
    i = 0
    while i < len(compressed):
        b1 = compressed[i]
        b2 = compressed[i+1] if i+1 < len(compressed) else 0
        b3 = compressed[i+2] if i+2 < len(compressed) else 0
        res += append_3bytes(b1, b2, b3)
        i += 3
    return res

def render_diagrams(directory, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
        
    puml_files = [f for f in os.listdir(directory) if f.endswith('.puml')]
    
    print(f"Found {len(puml_files)} diagrams to render...")
    
    for filename in puml_files:
        file_path = os.path.join(directory, filename)
        with open(file_path, 'r', encoding='utf-8') as f:
            puml_content = f.read()
            
        encoded = plantuml_encode(puml_content)
        # Using the official server
        url = f"https://www.plantuml.com/plantuml/png/{encoded}"
        
        print(f"Rendering {filename}...", end=' ', flush=True)
        response = requests.get(url)
        if response.status_code == 200:
            # Check if it's an error image (they usually have a specific size/content, 
            # but checking for 200 is a start. Some servers return 200 with an error image).
            output_path = os.path.join(output_dir, filename.replace('.puml', '.png'))
            with open(output_path, 'wb') as out:
                out.write(response.content)
            print("Done.")
        else:
            print(f"Failed (Status {response.status_code})")

if __name__ == "__main__":
    target_dir = r'C:\Headquarters\Studies\notes\diagrams'
    out_dir = os.path.join(target_dir, 'rendered')
    render_diagrams(target_dir, out_dir)
