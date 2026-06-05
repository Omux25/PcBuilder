import os
import requests
import zlib

def plantuml_encode(puml_text):
    """Encodes PlantUML text for the official server API."""
    utf8_data = puml_text.encode('utf-8')
    compressed = zlib.compress(utf8_data)[2:-4] 
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
    
    res = ""
    for i in range(0, len(compressed), 3):
        chunk = compressed[i:i+3]
        if len(chunk) == 3:
            res += alphabet[chunk[0] >> 2]
            res += alphabet[((chunk[0] & 0x03) << 4) | (chunk[1] >> 4)]
            res += alphabet[((chunk[1] & 0x0F) << 2) | (chunk[2] >> 6)]
            res += alphabet[chunk[2] & 0x3F]
        elif len(chunk) == 2:
            res += alphabet[chunk[0] >> 2]
            res += alphabet[((chunk[0] & 0x03) << 4) | (chunk[1] >> 4)]
            res += alphabet[((chunk[1] & 0x0F) << 2)]
            res += "0"
        elif len(chunk) == 1:
            res += alphabet[chunk[0] >> 2]
            res += alphabet[((chunk[0] & 0x03) << 4)]
            res += "00"
    return res

def render_diagrams(directory, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    puml_files = [f for f in os.listdir(directory) if f.endswith('.puml')]
    
    print(f"Found {len(puml_files)} diagrams to render...")
    
    for filename in puml_files:
        file_path = os.path.join(directory, filename)
        with open(file_path, 'r', encoding='utf-8') as f:
            puml_content = f.read()
            
        encoded = plantuml_encode(puml_content)
        url = f"https://www.plantuml.com/plantuml/png/~1{encoded}"
        
        print(f"Rendering {filename}...", end=' ', flush=True)
        response = requests.get(url)
        if response.status_code == 200:
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
